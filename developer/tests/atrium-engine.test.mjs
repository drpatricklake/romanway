import assert from 'node:assert/strict';
import {createAtriumRewards, RULES, LIMITS, dayKey, ledgerId} from '../../server/atrium-engine.js';
import {createMemoryStore} from './fixtures/memory-store.mjs';

const OWNER = 'owner';
const NOON = Date.UTC(2026, 10, 20, 17, 0, 0);          // 12:00 Eastern, Friday 20 November 2026
const MIN = 60000;
const LONG = 'After a preposition ask whether there is motion toward the place; if not, use the ablative.';
const SHORT = 'Think about the case.';
const root = 'classes/pilot';

function world(opts = {}) {
  const store = createMemoryStore();
  let clock = NOON + 6 * 3600000;                         // "now" is the evening of the same day
  const rewards = createAtriumRewards({store, now: () => clock, ownerUid: OWNER, sleep: async () => {}});
  store.seed(root, opts.cls || {});
  for (const u of ['alice', 'bob', 'carol', 'dan', 'erin']) store.seed(`${root}/members/${u}`, {status: u === 'erin' ? 'declined' : 'active'});
  store.seed(`${root}/staff/teach`, {active: true});
  const prof = (mastered, extra = {}) => ({name: 'x', furthest: mastered, mastered, done: Object.fromEntries(Array.from({length: mastered}, (_, i) => [String(i + 1), 1])), clients: [], client: null, ...extra});
  store.seed(`${root}/atriumProfiles/alice`, prof(5));
  store.seed(`${root}/atriumProfiles/bob`, prof(6));
  store.seed(`${root}/atriumProfiles/carol`, prof(2));
  store.seed(`${root}/atriumProfiles/dan`, prof(6));
  store.seed(`${root}/atriumProfiles/erin`, prof(6));
  const START = NOON - 3600000;                                   // rewards start an hour before the test events
  store.seed(`${root}/socialSettings/atrium`, {approve: true, ok: {}, hidden: {}, rewardsFrom: opts.rewardsFrom === undefined ? START : opts.rewardsFrom});
  const w = {
    store, rewards, root,
    setNow: v => { clock = v; },
    q(owner, ask, over = {}) {
      const id = `${owner}_${ask}`, audience = over.audience || 'all';
      store.seed(`${root}/atriumQuestions/${id}`, {owner, audience, readers: over.hidden || over.deleted ? [] : [audience], hidden: !!over.hidden, deleted: !!over.deleted,
        value: {id: ask, lesson: over.lesson ?? 5, open: true, q: 'Why is this accusative?'}, thanks: over.legacyThanks || []}, over.createMs);
      return id;
    },
    reply(qid, author, rid, over = {}) {
      const owner = qid.split('_')[0], ask = qid.slice(owner.length + 1);
      store.seed(`${root}/atriumQuestions/${qid}/replies/${author}_${rid}`, {author, hidden: !!over.hidden,
        value: {id: rid, to: owner, ask, kind: over.kind || 'hint', text: over.text ?? LONG, t: 0}}, over.createMs ?? NOON);
    },
    thank(qid, helper, rid, createMs = NOON + MIN) { store.seed(`${root}/atriumQuestions/${qid}/thanks/${helper}`, {helper, reply: rid, t: 0}, createMs); },
    all(uid) { return store.where(`${root}/atriumLedger/${uid}|`).map(p => ({id: p.slice(`${root}/atriumLedger/`.length), ...store.data(p)})); },
    ledger(uid) { return w.all(uid).filter(e => e.xp > 0); },                 // awards that paid; capped decisions are recorded with zero XP
    xp(uid, v = 'lib') { return w.ledger(uid).filter(e => e.v === v).reduce((s, e) => s + e.xp, 0); },
    settle(uid, hints = {}, classId = 'pilot') { return rewards.settle({classId, uid, ...hints}); },
    pair(client, patron, approved = true) {
      const c = store.data(`${root}/atriumProfiles/${client}`), p = store.data(`${root}/atriumProfiles/${patron}`);
      store.write(`${root}/atriumProfiles/${client}`, {...c, client: {patron, t: 1}});
      store.write(`${root}/atriumProfiles/${patron}`, {...p, clients: [client]});
      if (approved) store.write(`${root}/socialSettings/atrium`, {...store.data(`${root}/socialSettings/atrium`), approve: true, ok: {[client]: patron}});
    },
  };
  return w;
}

/* ---- 1. a substantive reply earns 5; short, hidden, own, staff, non-member, and unmastered replies earn nothing ---- */
{
  const w = world(), q = w.q('alice', 'a1');
  w.reply(q, 'bob', 'ok');
  w.reply(q, 'dan', 'short', {text: SHORT});
  w.reply(q, 'carol', 'unmastered');                          // carol has mastered Lesson II, not V
  w.reply(q, 'erin', 'declined');                             // not an active member
  w.reply(q, 'teach', 'teacher');                             // staff earn nothing
  w.reply(q, 'alice', 'self');                                // not on one's own question
  const r = await w.settle('alice', {questions: [q]});
  assert.equal(w.xp('bob'), RULES.xpReply);
  for (const u of ['dan', 'carol', 'erin', 'teach', 'alice']) assert.equal(w.ledger(u).length, 0, u + ' earns nothing');
  assert.equal(r.applied, 1);
}

/* ---- 2. hidden replies and hidden or deleted questions earn nothing new ---- */
{
  const w = world();
  const q1 = w.q('alice', 'h1'); w.reply(q1, 'bob', 'r', {hidden: true});
  const q2 = w.q('alice', 'h2', {hidden: true}); w.reply(q2, 'bob', 'r');
  const q3 = w.q('alice', 'h3', {deleted: true}); w.reply(q3, 'bob', 'r');
  await w.settle('alice', {questions: [q1, q2, q3]});
  assert.equal(w.ledger('bob').length, 0);
}

/* ---- 3. the daily cap: three replies a day, 30 XP combined with helpful marks, topped up to the ceiling ---- */
{
  const w = world(), ids = [];
  for (const n of ['a', 'b', 'c', 'd']) { const q = w.q('alice', n); w.reply(q, 'bob', 'r', {createMs: NOON + MIN * ids.length}); ids.push(q); }
  await w.settle('alice', {questions: ids.slice(0, 4)});
  assert.equal(w.ledger('bob').filter(e => e.why === 'reply').length, RULES.repliesPerDay, 'the fourth reply of the day earns nothing');
  assert.equal(w.xp('bob'), 15);
  assert.equal(w.all('bob').filter(e => e.capped).length, 1, 'the capped reply is recorded once, with zero XP');
  for (const q of ids.slice(0, 3)) w.thank(q, 'bob', 'r');   // three helpful marks: 3 x 10 = 30, but only 15 of room remain
  await w.settle('alice', {questions: ids.slice(0, 3)});
  assert.equal(w.xp('bob'), RULES.dailyCombined, 'reply and helpful XP stop at 30 a day');
  const helpful = w.ledger('bob').filter(e => e.why === 'helpful').map(e => e.xp).sort((x, y) => x - y);
  assert.deepEqual(helpful, [5, 10], 'the last mark is topped up to the ceiling, not dropped');
}

/* ---- 4. helpful marks: once per question and helper, only on a real qualifying reply; the array on the question is ignored ---- */
{
  const w = world(), q = w.q('alice', 'a1', {legacyThanks: [{helper: 'dan', reply: 'zz', t: 1}, {helper: 'bob', reply: 'r', t: 1}]});
  w.reply(q, 'bob', 'r');
  w.thank(q, 'carol', 'r');                                    // carol never replied
  w.thank(q, 'dan', 'nope');                                   // dan's named reply does not exist
  w.thank(q, 'bob', 'r');
  await w.settle('alice', {questions: [q]}); await w.settle('alice', {questions: [q]});
  assert.equal(w.ledger('bob').filter(e => e.why === 'helpful').length, 1);
  assert.equal(w.xp('bob'), 15);
  assert.equal(w.ledger('carol').length + w.ledger('dan').length, 0, 'fabricated marks earn nothing');
}

/* ---- 5. two tabs: the same request twice at once awards once ---- */
{
  const w = world(), q = w.q('alice', 'a1'); w.reply(q, 'bob', 'r'); w.thank(q, 'bob', 'r');
  const [a, b] = await Promise.all([w.settle('bob', {questions: [q]}), w.settle('bob', {questions: [q]})]);
  assert.equal(w.ledger('bob').length, 2, 'one reply award and one helpful award');
  assert.equal(w.xp('bob'), 15);
  assert.equal(a.awarded.length + b.awarded.length, 2, 'between the two tabs each award is reported once');
}

/* ---- 6. simultaneous requests cannot exceed the daily cap ---- */
{
  // six questions from three different students, each settled by its own asker at the same moment: the contention is on
  // the helper's daily counter, and every request still completes
  const w = world(), ids = [], owners = ['alice', 'carol', 'dan'];
  let i = 0;
  for (const owner of owners) for (const n of ['x', 'y']) { const q = w.q(owner, n); w.reply(q, 'bob', 'r', {createMs: NOON + MIN * i++}); ids.push([owner, q]); }
  await Promise.all(owners.map(o => w.settle(o, {questions: ids.filter(x => x[0] === o).map(x => x[1])})));
  assert.equal(w.ledger('bob').filter(e => e.why === 'reply').length, RULES.repliesPerDay);
  assert.equal(w.store.data(`${root}/atriumDaily/bob_2026-11-20`).replies, RULES.repliesPerDay);
  assert.equal(w.store.data(`${root}/atriumDaily/bob_2026-11-20`).xp, 15);
  assert.ok(w.store.stats.retries > 0, 'the requests really did collide and retry');
}
{
  // one student firing six requests at once: each succeeds or is told to slow down; none fails with an internal error,
  // and trying again afterwards leaves the same final state as a calm sequence of calls
  const w = world(), ids = [];
  for (const n of ['a', 'b', 'c', 'd', 'e', 'f']) { const q = w.q('alice', n); w.reply(q, 'bob', 'r', {createMs: NOON + MIN * ids.length}); ids.push(q); }
  const out = await Promise.allSettled(ids.map(q => w.settle('bob', {questions: [q]})));
  for (const r of out) if (r.status === 'rejected') assert.equal(r.reason.status, 429, 'a burst is answered with 429, not an error');
  for (let k = 0; k < 8 && w.ledger('bob').filter(e => e.why === 'reply').length < 3; k++) { w.setNow(NOON + 6 * 3600000 + (k + 1) * 61000); for (const q of ids) await w.settle('bob', {questions: [q]}); }
  assert.equal(w.ledger('bob').filter(e => e.why === 'reply').length, RULES.repliesPerDay);
  assert.equal(w.store.data(`${root}/atriumDaily/bob_2026-11-20`).replies, RULES.repliesPerDay);
}

/* ---- 7. a retry after another request has already written the award, or used up the cap ---- */
{
  const w = world(), q = w.q('alice', 'a1'); w.reply(q, 'bob', 'r');
  let first = true;
  w.store.beforeCommit = async (attempt, paths) => {           // another request commits between our read and our commit
    if (!first || !paths.some(p => p.includes('/atriumLedger/'))) return; first = false;
    w.store.write(`${root}/atriumLedger/${ledgerId('bob', `r:${q}:r`)}`, {uid: 'bob', why: 'reply', v: 'lib', xp: 5, day: '2026-11-20', t: NOON});
  };
  await w.settle('alice', {questions: [q]});
  assert.equal(w.ledger('bob').length, 1, 'the retry sees the existing award and adds nothing');
  assert.ok(w.store.stats.retries >= 1);
}
{
  const w = world(), q = w.q('alice', 'a1'); w.reply(q, 'bob', 'r');
  let first = true;
  w.store.beforeCommit = async (attempt, paths) => {           // another request meanwhile uses the last of today's three replies
    if (!first || !paths.some(p => p.includes('/atriumLedger/'))) return; first = false;
    w.store.write(`${root}/atriumDaily/bob_2026-11-20`, {replies: 3, xp: 15});
  };
  await w.settle('alice', {questions: [q]});
  assert.equal(w.ledger('bob').length, 0, 'the retry re-reads the counter and honours the cap');
}

/* ---- 8. repeated and toggled marks, and moderation or deletion afterwards, never change what is recorded ---- */
{
  const w = world(), q = w.q('alice', 'a1'); w.reply(q, 'bob', 'r'); w.thank(q, 'bob', 'r');
  await w.settle('alice', {questions: [q]});
  const before = JSON.stringify(w.ledger('bob'));
  for (let i = 0; i < 4; i++) {                                // the mark disappears and returns, over and over
    w.store.remove(`${root}/atriumQuestions/${q}/thanks/bob`); await w.settle('alice', {questions: [q]});
    w.thank(q, 'bob', 'r', NOON + (i + 2) * MIN); await w.settle('alice', {questions: [q]});
  }
  assert.equal(JSON.stringify(w.ledger('bob')), before, 'no new or changed awards');
  // the owner closes and then deletes the question, and the teacher hides the reply: awards stay
  w.store.write(`${root}/atriumQuestions/${q}`, {...w.store.data(`${root}/atriumQuestions/${q}`), deleted: true, readers: []});
  w.store.write(`${root}/atriumQuestions/${q}/replies/bob_r`, {...w.store.data(`${root}/atriumQuestions/${q}/replies/bob_r`), hidden: true});
  await w.settle('alice', {questions: [q]});
  assert.equal(JSON.stringify(w.ledger('bob')), before, 'recorded awards survive deletion and moderation');
}

/* ---- 9. a private question: only its approved patron earns, and only a reader can trigger work on it ---- */
{
  const w = world();
  w.pair('alice', 'bob');                                      // approved pairing
  const q = w.q('alice', 'p1', {audience: 'bob'});
  w.reply(q, 'bob', 'r'); w.reply(q, 'dan', 'r');
  w.store.listLog.length = 0;
  await w.settle('dan', {questions: [q]});                     // dan cannot read this question
  assert.equal(w.ledger('bob').length + w.ledger('dan').length, 0, 'a non-reader triggers nothing');
  assert.ok(!w.store.listLog.some(p => p.includes('/replies')), 'and the replies are not even read');
  await w.settle('bob', {questions: [q]});
  assert.equal(w.xp('bob'), 5, 'the patron earns');
  assert.equal(w.ledger('dan').length, 0, 'another qualified student does not earn on a private question');
}
{
  const w = world();
  w.pair('alice', 'bob', false);                               // pairing not approved by the teacher
  const q = w.q('alice', 'p1', {audience: 'bob'}); w.reply(q, 'bob', 'r');
  await w.settle('bob', {questions: [q]});
  assert.equal(w.ledger('bob').length, 0, 'no reward without the teacher\'s approval');
  w.store.write(`${root}/socialSettings/atrium`, {...w.store.data(`${root}/socialSettings/atrium`), approve: false, ok: {}});
  await w.settle('bob', {questions: [q]});
  assert.equal(w.xp('bob'), 5, 'with approval switched off, the pairing stands');
}

/* ---- 10. class boundaries ---- */
{
  const w = world();
  w.store.seed('classes/other', {});
  w.store.seed('classes/other/members/carol', {status: 'active'});
  const q = w.q('alice', 'a1'); w.reply(q, 'bob', 'r');
  await assert.rejects(w.settle('bob', {questions: [q]}, 'other'), e => e.status === 403);   // bob is not in the other class
  await w.settle('carol', {questions: [q]}, 'other');          // the question is not in that class
  assert.equal(w.ledger('bob').length, 0);
  w.store.seed('classes/other/atriumQuestions/alice_x', {owner: 'alice', audience: 'all', readers: ['all'], hidden: false, deleted: false, value: {id: 'x', lesson: 5, open: true}, thanks: []});
  w.store.seed('classes/other/atriumQuestions/alice_x/replies/bob_r', {author: 'bob', hidden: false, value: {id: 'r', kind: 'hint', text: LONG, t: 0}});
  w.store.seed('classes/other/members/alice', {status: 'active'});
  await w.settle('carol', {questions: ['alice_x']}, 'other');
  assert.equal(w.store.where('classes/other/atriumLedger/').length, 0, 'bob is not a member of the other class, so he earns nothing there');
  await assert.rejects(w.settle('erin', {}), e => e.status === 403);                           // a declined member
  await assert.rejects(w.settle('nobody', {}), e => e.status === 403);
}

/* ---- 11. patron: 15 XP once per client and lesson, after a tutoring reply and before completion, with approval ---- */
{
  const w = world();
  w.pair('alice', 'bob');
  const q = w.q('alice', 'a1'); w.reply(q, 'bob', 'r', {createMs: NOON});
  w.store.seed(`${root}/atriumCompletions/alice_5`, {uid: 'alice', lesson: 5}, NOON + 5 * MIN);
  await w.settle('alice', {clients: ['alice']}); await w.settle('bob', {clients: ['alice']});
  assert.equal(w.ledger('bob').filter(e => e.why === 'patron').length, 1);
  assert.equal(w.xp('bob'), 15);
  await w.settle('alice', {questions: [q]});
  assert.equal(w.xp('bob'), 15 + 5, 'the tutoring reply itself also earns its own 5');
}
{
  const w = world();
  w.pair('alice', 'bob');
  const q = w.q('alice', 'a1'); w.reply(q, 'bob', 'r', {createMs: NOON + 10 * MIN});
  w.store.seed(`${root}/atriumCompletions/alice_5`, {uid: 'alice', lesson: 5}, NOON + 5 * MIN);   // completed BEFORE the tutoring
  await w.settle('alice', {clients: ['alice']});
  assert.equal(w.ledger('bob').length, 0, 'completion before any tutoring earns nothing');
}
{
  const w = world();
  w.pair('alice', 'bob', false);
  const q = w.q('alice', 'a1'); w.reply(q, 'bob', 'r');
  w.store.seed(`${root}/atriumCompletions/alice_5`, {uid: 'alice', lesson: 5}, NOON + 5 * MIN);
  await w.settle('alice', {clients: ['alice']});
  assert.equal(w.ledger('bob').length, 0, 'an unapproved pairing earns nothing');
  w.pair('alice', 'bob', true);
  await w.settle('dan', {clients: ['alice']});
  assert.equal(w.ledger('bob').length, 0, 'a bystander cannot trigger it');
  await w.settle('alice', {clients: ['alice']});
  assert.equal(w.xp('bob'), 15);
}

/* ---- 12. follow-up: 10 Cōnstantia to the student, once per lesson, after help was received ---- */
{
  const w = world(), q = w.q('alice', 'a1');
  w.store.seed(`${root}/atriumFollowups/alice_5`, {uid: 'alice', lesson: 5}, NOON + 10 * MIN);
  await w.settle('alice', {followups: [5]});
  assert.equal(w.ledger('alice').length, 0, 'no help received yet');
  w.reply(q, 'bob', 'help', {createMs: NOON + MIN});                 // qualifying student help counts
  await w.settle('alice', {followups: [5]}); await w.settle('alice', {followups: [5]});
  assert.equal(w.ledger('alice').length, 1);
  assert.equal(w.xp('alice', 'con'), RULES.xpFollowup);
  await w.settle('bob', {followups: [5]});
  assert.equal(w.ledger('bob').length, 0, 'a follow-up counts only for the student who did it');
}
{
  const w = world(), q = w.q('alice', 'a1'); w.reply(q, 'bob', 'late', {createMs: NOON + 20 * MIN});
  w.store.seed(`${root}/atriumFollowups/alice_5`, {uid: 'alice', lesson: 5}, NOON + 10 * MIN);   // practice done before the help arrived
  await w.settle('alice', {followups: [5]});
  assert.equal(w.ledger('alice').length, 0);
}

/* ---- 13. work is bounded: a repeat call does no award transactions; one call reads a limited number of documents ---- */
{
  const w = world(), ids = [];
  for (let i = 0; i < LIMITS.questionsPerCall; i++) { const q = w.q('alice', 'q' + i); w.reply(q, 'bob', 'r', {createMs: NOON + MIN * i}); w.reply(q, 'dan', 'r', {createMs: NOON + MIN * i}); ids.push(q); }
  w.store.stats.gets = 0; w.store.stats.lists = 0;
  await w.settle('alice', {questions: ids});
  const reads = w.store.stats.gets + w.store.stats.lists;
  assert.ok(reads < 300, `a 10-question call reads a bounded number of documents (${reads})`);
  const tx = w.store.stats.transactions;
  await w.settle('alice', {questions: ids});
  assert.equal(w.store.stats.transactions - tx, 1, 'a repeat call runs only the rate-limit transaction; no award is rewritten');
}

/* ---- 14. the rate limit ---- */
{
  const w = world();
  for (let i = 0; i < LIMITS.callsPerMinute; i++) await w.settle('alice', {});
  await assert.rejects(w.settle('alice', {}), e => e.status === 429);
  w.setNow(NOON + 6 * 3600000 + 61000);
  await w.settle('alice', {});
}

/* ---- 15. request validation ---- */
{
  const w = world();
  await assert.rejects(w.settle('alice', {questions: ['a/b']}), e => e.status === 400);
  await assert.rejects(w.settle('alice', {questions: Array(LIMITS.questionsPerCall + 1).fill('x')}), e => e.status === 400);
  await assert.rejects(w.settle('alice', {followups: [0]}), e => e.status === 400);
  await assert.rejects(w.settle('alice', {followups: ['5']}), e => e.status === 400);
  await assert.rejects(w.settle('alice', {}, 'Pilot'), e => e.status === 400);
}

/* ---- 16. the daily cap follows the class's local day, not UTC ---- */
{
  assert.equal(dayKey(Date.UTC(2026, 10, 21, 4, 30), 'America/New_York'), '2026-11-20');   // 23:30 Eastern
  assert.equal(dayKey(Date.UTC(2026, 10, 21, 5, 30), 'America/New_York'), '2026-11-21');   // 00:30 Eastern
  const w = world(), ids = [];
  const times = [-90, -60, -30, 30, 60].map(m => Date.UTC(2026, 10, 21, 5, 0) + m * MIN);   // three before and two after local midnight
  times.forEach((t, i) => { const q = w.q('alice', 'n' + i); w.reply(q, 'bob', 'r', {createMs: t}); ids.push(q); });
  await w.settle('alice', {questions: ids});
  assert.equal(w.ledger('bob').length, 5, 'three on one local day and two on the next are all rewarded');
}


/* ---- 17. the cutover: nothing is paid until rewardsFrom is set, and earlier events are left to the reviewed balances ---- */
{
  const w = world({rewardsFrom: null}), q = w.q('alice', 'a1'); w.reply(q, 'bob', 'r');
  const r = await w.settle('alice', {questions: [q]});
  assert.equal(r.notStarted, true);
  assert.equal(w.ledger('bob').length, 0, 'before the instructor starts rewards, nothing is paid');
}
{
  const w = world({rewardsFrom: NOON + 5 * MIN}), q1 = w.q('alice', 'old'), q2 = w.q('alice', 'new');
  w.reply(q1, 'bob', 'r', {createMs: NOON + MIN});               // before the cutover: covered by the old total and the baseline
  w.reply(q2, 'bob', 'r', {createMs: NOON + 10 * MIN});          // after it: paid by the ledger
  await w.settle('alice', {questions: [q1, q2]});
  assert.equal(w.ledger('bob').length, 1);
  assert.ok(w.ledger('bob')[0].id.includes('alice_new'));
}

console.log('PASS atrium-engine: eligibility from stored data, caps, once-only awards, two tabs, simultaneous requests, forced retries, repeated marks, kept awards, private questions, class boundaries, bounded work, rate limit, and local days.');
