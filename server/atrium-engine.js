/* Atrium rewards engine.
   The browser only says WHICH items to look at (a few question ids, a client, a lesson). Everything that decides whether
   an award is earned is read here from the stored documents: the question, the replies, the helpful marks, enrollment,
   mastery, the pairing and its approval, and server-assigned timestamps. Nothing the browser sends is trusted as a fact.

   Awards are written one at a time inside a transaction, under a stable id, together with the helper's daily counter, so
   two tabs, a retry, or simultaneous requests can never duplicate an award or exceed a daily cap. Awards are only ever
   added: closing, reopening, or deleting a question, or a teacher hiding a reply later, leaves recorded awards in place.

   The engine talks to storage through a small interface (get, list, runTransaction) so the rules can be tested without
   Firebase; server/atrium-firestore.js adapts it to the Admin SDK.

   Store interface (paths are relative to the database root):
     get(path)              -> { exists, data, createMs }
     list(path, {where, limit}) -> [{ id, data, createMs }]      where = [field, '==', value]
     runTransaction(fn)     -> fn(tx); tx.get(path), tx.create(path, data), tx.set(path, data); reads before writes
*/

export const RULES = Object.freeze({
  minSubstantive: 50,       // characters of trimmed reply text
  maxReplyText: 1200,
  repliesPerDay: 3,         // rewarded replies per helper per local day
  xpReply: 5,
  xpHelpful: 10,            // once per question and helper
  dailyCombined: 30,        // reply + helpful XP per helper per local day
  xpPatronLesson: 15,       // once per client and lesson
  xpFollowup: 10,           // once per student and lesson, Cōnstantia
});

export const LIMITS = Object.freeze({
  questionsPerCall: 10,
  clientsPerCall: 2,
  followupsPerCall: 5,
  callsPerMinute: 20,
  repliesPerQuestion: 200,
  questionsPerStudent: 40,
  completionsPerStudent: 60,
});

const ID = /^[A-Za-z0-9_-]{1,160}$/;
const CLASS_ID = /^[a-z0-9_-]{1,40}$/;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function dayKey(ms, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  }
}
export const ledgerId = (uid, key) => `${uid}|${key}`;

export function createAtriumRewards({ store, now = () => Date.now(), ownerUid = '', defaultTimeZone = 'America/New_York', sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  const root = classId => `classes/${classId}`;

  /* A transaction that keeps losing to other writers is retried with a short, growing pause. Every transaction here is
     idempotent (awards have stable ids and are created only if absent), so repeating one is always safe. */
  async function transact(fn) {
    for (let attempt = 0; ; attempt++) {
      try { return await store.runTransaction(fn); }
      catch (e) { if (!e.contention || attempt >= 3) throw e; await sleep(25 * (attempt + 1) + Math.floor(Math.random() * 25)); }
    }
  }

  /* ---------- who is calling, and how often ---------- */
  async function membership(classId, uid) {
    const staff = await store.get(`${root(classId)}/staff/${uid}`);
    if ((classId === 'pilot' && ownerUid && uid === ownerUid) || staff.data?.active === true) return { teacher: true };
    const member = await store.get(`${root(classId)}/members/${uid}`);
    if (member.exists && member.data?.status === 'active') return { teacher: false };
    fail(403, 'Only active members of this class can update rewards.');
  }

  async function limit(classId, uid) {
    const path = `${root(classId)}/atriumRate/${uid}`;
    try {
      await store.runTransaction(async tx => {
        const snap = await tx.get(path), t = now();
        let d = snap.exists ? snap.data : { start: t, count: 0 };
        if (t - d.start >= 60000) d = { start: t, count: 0 };
        if (d.count >= LIMITS.callsPerMinute) fail(429, 'Please wait a moment before checking rewards again.');
        tx.set(path, { start: d.start, count: d.count + 1 });
      });
    } catch (e) {
      if (e.contention) fail(429, 'Several requests arrived at once. Please try again in a moment.');   // a burst from one student is a "slow down", not an error
      throw e;
    }
  }

  /* ---------- facts about people, read once per call ---------- */
  function makeContext(classId, uid, teacher, tz, settings) {
    const from = Number(settings.rewardsFrom);
    return { classId, uid, teacher, tz, settings, from: Number.isFinite(from) && from > 0 ? from : 0, people: new Map(), awarded: [], stats: { applied: 0, duplicate: 0, capped: 0, before: 0 } };
  }
  async function person(ctx, uid) {
    if (ctx.people.has(uid)) return ctx.people.get(uid);
    const base = root(ctx.classId);
    const [member, staff, profile] = await Promise.all([
      store.get(`${base}/members/${uid}`), store.get(`${base}/staff/${uid}`), store.get(`${base}/atriumProfiles/${uid}`),
    ]);
    const p = {
      active: member.exists && member.data?.status === 'active',
      staff: (ctx.classId === 'pilot' && ownerUid && uid === ownerUid) || staff.data?.active === true,
      profile: profile.data || {},
    };
    ctx.people.set(uid, p);
    return p;
  }
  async function pairingOk(ctx, client, patron) {
    const c = (await person(ctx, client)).profile, p = (await person(ctx, patron)).profile;
    const pair = c.client;
    if (!pair || pair.patron !== patron || Object.prototype.hasOwnProperty.call(pair, 'ended')) return false;
    if (!Array.isArray(p.clients) || !p.clients.includes(client)) return false;
    return ctx.settings.approve === false || ctx.settings.ok?.[client] === patron;
  }
  const visibleTo = (q, uid, teacher) => teacher || q.owner === uid || (Array.isArray(q.readers) && (q.readers.includes('all') || q.readers.includes(uid)));

  /* a reply earns only if: not hidden, from a classmate who is an active non-staff member, 50+ characters, a valid kind,
     the helper has mastered and completed the lesson, and a private question was answered by its approved patron */
  async function replyEligible(ctx, q, reply) {
    const d = reply.data || {}, v = d.value || {}, author = d.author;
    if (d.hidden || !author || author === q.data.owner) return false;
    if (reply.id !== `${author}_${v.id}` || !['hint', 'rule', 'check'].includes(v.kind)) return false;
    const text = String(v.text || '').trim();
    if (text.length < RULES.minSubstantive || text.length > RULES.maxReplyText) return false;
    const who = await person(ctx, author);
    if (!who.active || who.staff) return false;
    const p = who.profile;
    if (!(Number(p.mastered) >= q.lesson) || !p.done || !Object.prototype.hasOwnProperty.call(p.done, String(q.lesson))) return false;
    const audience = q.data.audience;
    if (audience && audience !== 'all') {
      if (audience !== author || !(await pairingOk(ctx, q.data.owner, author))) return false;
    }
    return true;
  }

  /* ---------- writing one award, atomically ---------- */
  async function apply(ctx, ev) {
    const base = root(ctx.classId), id = ledgerId(ev.uid, ev.key), ledgerPath = `${base}/atriumLedger/${id}`;
    if (ev.tMs < ctx.from) { ctx.stats.before++; return 'before'; }   // earlier events are covered by the reviewed starting balances
    if ((await store.get(ledgerPath)).exists) { ctx.stats.duplicate++; return 'duplicate'; }   // cheap exit, no transaction
    const day = dayKey(ev.tMs, ctx.tz), dailyPath = `${base}/atriumDaily/${ev.uid}_${day}`;
    const result = await transact(async tx => {
      const existing = await tx.get(ledgerPath);
      if (existing.exists) return 'duplicate';
      let xp = ev.xp, counter = null, capped = false;
      if (ev.kind === 'reply' || ev.kind === 'helpful') {
        const snap = await tx.get(dailyPath), d = snap.exists ? snap.data : { replies: 0, xp: 0 };
        xp = ev.kind === 'reply' && d.replies >= RULES.repliesPerDay ? 0 : Math.min(ev.xp, RULES.dailyCombined - d.xp);
        if (xp <= 0) { xp = 0; capped = true; }
        else counter = { replies: d.replies + (ev.kind === 'reply' ? 1 : 0), xp: d.xp + xp };
      }
      // A capped event is recorded once, with zero XP, so later requests skip it instead of re-deciding it. Caps only
      // fill up during a day, so a capped event never becomes payable later.
      tx.create(ledgerPath, {
        uid: ev.uid, why: ev.kind, v: ev.v, xp, day, t: ev.tMs, createdAt: now(),
        ...(capped ? { capped: true } : {}),
        ...(ev.qid ? { q: ev.qid } : {}), ...(ev.rid ? { r: ev.rid } : {}),
        ...(ev.client ? { client: ev.client } : {}), ...(ev.lesson ? { lesson: ev.lesson } : {}),
      });
      if (counter) tx.set(dailyPath, counter);
      return capped ? 'capped' : 'applied:' + xp;
    });
    if (result.startsWith('applied')) { ctx.stats.applied++; ctx.awarded.push({ uid: ev.uid, kind: ev.kind, xp: Number(result.split(':')[1]), key: ev.key }); return 'applied'; }
    ctx.stats[result]++;
    return result;
  }

  /* ---------- replies and helpful marks on one question ---------- */
  async function processQuestion(ctx, qid) {
    const base = root(ctx.classId);
    const snap = await store.get(`${base}/atriumQuestions/${qid}`);
    if (!snap.exists) return;
    const qd = snap.data;
    if (!visibleTo(qd, ctx.uid, ctx.teacher)) return;          // private-question access: a caller cannot trigger work on what they cannot read
    if (qd.hidden || qd.deleted) return;                        // no new awards; recorded awards stay
    const lesson = Number(qd.value?.lesson);
    if (!Number.isInteger(lesson) || lesson < 1 || lesson > 57) return;
    const q = { id: qid, data: qd, lesson };
    const replies = (await store.list(`${base}/atriumQuestions/${qid}/replies`, { limit: LIMITS.repliesPerQuestion })).sort((a, b) => a.createMs - b.createMs);
    const thanks = (await store.list(`${base}/atriumQuestions/${qid}/thanks`, { limit: 200 })).sort((a, b) => a.createMs - b.createMs);
    const ok = new Map();
    for (const r of replies) ok.set(r.id, await replyEligible(ctx, q, r));
    for (const r of replies) {
      if (!ok.get(r.id)) continue;
      await apply(ctx, { kind: 'reply', v: 'lib', uid: r.data.author, key: `r:${qid}:${r.data.value.id}`, tMs: r.createMs, qid, rid: r.data.value.id, xp: RULES.xpReply });
    }
    for (const th of thanks) {
      const helper = th.id, reply = replies.find(r => r.id === `${helper}_${th.data?.reply}`);
      if (!reply || th.data?.helper !== helper || !ok.get(reply.id)) continue;     // a mark must point at a real, qualifying reply
      await apply(ctx, { kind: 'helpful', v: 'lib', uid: helper, key: `h:${qid}:${helper}`, tMs: th.createMs, qid, rid: th.data.reply, xp: RULES.xpHelpful });
    }
  }

  async function studentQuestions(ctx, owner) {
    return (await store.list(`${root(ctx.classId)}/atriumQuestions`, { where: ['owner', '==', owner], limit: LIMITS.questionsPerStudent }));
  }

  /* ---------- patron: a client completed a lesson after the patron's tutoring reply on it ---------- */
  async function processClient(ctx, client) {
    const base = root(ctx.classId), me = await person(ctx, client), pair = me.profile.client;
    if (!me.active || !pair || Object.prototype.hasOwnProperty.call(pair, 'ended')) return;
    const patron = pair.patron;
    if (!(ctx.teacher || ctx.uid === client || ctx.uid === patron)) return;
    const pp = await person(ctx, patron);
    if (!pp.active || pp.staff || !(await pairingOk(ctx, client, patron))) return;
    const completions = await store.list(`${base}/atriumCompletions`, { where: ['uid', '==', client], limit: LIMITS.completionsPerStudent });
    let questions = null;
    for (const c of completions) {
      const lesson = Number(c.data?.lesson);
      if (!Number.isInteger(lesson) || c.id !== `${client}_${lesson}`) continue;
      if ((await store.get(`${base}/atriumLedger/${ledgerId(patron, `pl:${client}:${lesson}`)}`)).exists) continue;
      questions ||= await studentQuestions(ctx, client);
      let tutored = false;
      for (const qs of questions) {
        if (qs.data.hidden || Number(qs.data.value?.lesson) !== lesson) continue;
        const q = { id: qs.id, data: qs.data, lesson };
        const replies = await store.list(`${base}/atriumQuestions/${qs.id}/replies`, { limit: LIMITS.repliesPerQuestion });
        for (const r of replies) {
          if (r.data?.author === patron && r.createMs < c.createMs && await replyEligible(ctx, q, r)) { tutored = true; break; }
        }
        if (tutored) break;
      }
      if (tutored) await apply(ctx, { kind: 'patron', v: 'lib', uid: patron, key: `pl:${client}:${lesson}`, tMs: c.createMs, client, lesson, xp: RULES.xpPatronLesson });
    }
  }

  /* ---------- client: follow-up practice completed after receiving help on that lesson ---------- */
  async function processFollowup(ctx, lesson) {
    const base = root(ctx.classId), uid = ctx.uid;
    const f = await store.get(`${base}/atriumFollowups/${uid}_${lesson}`);
    if (!f.exists || f.data?.uid !== uid) return;
    if ((await store.get(`${base}/atriumLedger/${ledgerId(uid, `fu:${lesson}`)}`)).exists) return;
    let helped = false;
    for (const qs of await studentQuestions(ctx, uid)) {
      if (qs.data.hidden || Number(qs.data.value?.lesson) !== lesson) continue;
      const replies = await store.list(`${base}/atriumQuestions/${qs.id}/replies`, { limit: LIMITS.repliesPerQuestion });
      const q = {id: qs.id, data: qs.data, lesson};
      for (const r of replies) {
        if (r.createMs < f.createMs && await replyEligible(ctx, q, r)) { helped = true; break; }
      }
      if (helped) break;
    }
    if (helped) await apply(ctx, { kind: 'followup', v: 'con', uid, key: `fu:${lesson}`, tMs: f.createMs, lesson, xp: RULES.xpFollowup });
  }

  /* ---------- the one entry point ---------- */
  async function settle({ classId = 'pilot', uid, questions = [], clients = [], followups = [] }) {
    if (!uid) fail(401, 'Sign in again.');
    if (!CLASS_ID.test(String(classId))) fail(400, 'Invalid class.');
    if (!Array.isArray(questions) || !Array.isArray(clients) || !Array.isArray(followups)) fail(400, 'Invalid request.');
    if (questions.length > LIMITS.questionsPerCall || clients.length > LIMITS.clientsPerCall || followups.length > LIMITS.followupsPerCall) fail(400, 'Too many items in one request.');
    for (const x of [...questions, ...clients]) if (typeof x !== 'string' || !ID.test(x)) fail(400, 'Invalid request.');
    for (const x of followups) if (!Number.isInteger(x) || x < 1 || x > 57) fail(400, 'Invalid request.');
    const { teacher } = await membership(classId, uid);
    await limit(classId, uid);
    const cls = (await store.get(root(classId))).data || {}, settings = (await store.get(`${root(classId)}/socialSettings/atrium`)).data || {};
    const ctx = makeContext(classId, uid, teacher, typeof cls.timezone === 'string' ? cls.timezone : defaultTimeZone, settings);
    // Until the instructor has reviewed the starting balances and set rewardsFrom, nothing is paid: otherwise events already
    // counted in the old totals would be paid a second time.
    if (!ctx.from) return { awarded: [], applied: 0, notStarted: true };
    for (const qid of [...new Set(questions)]) await processQuestion(ctx, qid);
    for (const c of [...new Set(clients)]) await processClient(ctx, c);
    for (const l of [...new Set(followups)]) await processFollowup(ctx, l);
    return { awarded: ctx.awarded.filter(a => a.uid === uid).map(a => ({ kind: a.kind, xp: a.xp })), applied: ctx.stats.applied };
  }

  return { settle };
}
