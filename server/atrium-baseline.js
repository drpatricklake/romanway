/* Migration of previously earned Atrium XP.
   Old totals were computed and stored by each student's own browser, so they are not evidence. They are neither erased nor
   trusted: this module proposes a starting balance for the instructor to review, and only what the instructor approves is
   written, as clearly labelled "baseline" entries in the server ledger. From the cutover time (rewardsFrom) on, the ledger
   pays awards, and the old arrays are no longer an XP source. */
import {RULES, dayKey} from './atrium-engine.js';

export const MAX_EVENT = Object.freeze({reply: RULES.xpReply, helpful: RULES.xpHelpful, patron: RULES.xpPatronLesson, followup: RULES.xpFollowup});
export const SANITY = Object.freeze({lib: 1000, con: 500});          // an approved figure above these needs a deliberate override
const WHY = new Set(['reply', 'helpful', 'patron', 'followup', 'legacy']);

/* what one student's recorded entries are worth under today's rules */
export function proposeForStudent(earned = [], timeZone = 'America/New_York') {
  const out = {entries: Array.isArray(earned) ? earned.length : 0, rawLib: 0, rawCon: 0, lib: 0, con: 0, legacyLib: 0, legacyCon: 0, flags: new Set()};
  if (!Array.isArray(earned)) { out.flags = ['record is not a list']; return out; }
  const seen = new Set(), days = {};
  const list = earned.filter(e => e && typeof e === 'object').slice().sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0));
  for (const e of list) {
    const v = e.v === 'con' ? 'con' : e.v === 'lib' ? 'lib' : null, xp = Number(e.xp);
    if (!v || !Number.isFinite(xp) || xp < 0) { out.flags.add('malformed entry'); continue; }
    if (v === 'lib') out.rawLib += xp; else out.rawCon += xp;
    const key = String(e.k || '');
    if (!WHY.has(e.why)) { out.flags.add('unrecognised kind of award'); continue; }
    if (key && seen.has(key)) { out.flags.add('duplicate entry'); continue; }
    if (key) seen.add(key);
    if (e.why === 'legacy') {                                         // the old local total: student-written, shown on its own
      if (v === 'lib') out.legacyLib += xp; else out.legacyCon += xp;
      continue;
    }
    let pay = Math.min(xp, MAX_EVENT[e.why]);
    if (xp > MAX_EVENT[e.why]) out.flags.add('an entry exceeds its maximum');
    if (e.why === 'reply' || e.why === 'helpful') {
      const day = typeof e.day === 'string' && e.day ? e.day : dayKey(Number(e.t) || 0, timeZone), d = (days[day] ||= {replies: 0, xp: 0});
      if (e.why === 'reply' && d.replies >= RULES.repliesPerDay) { out.flags.add('daily limit exceeded'); continue; }
      pay = Math.min(pay, RULES.dailyCombined - d.xp);
      if (pay <= 0) { out.flags.add('daily limit exceeded'); continue; }
      d.xp += pay; if (e.why === 'reply') d.replies++;
    }
    if (v === 'lib') out.lib += pay; else out.con += pay;
  }
  out.lib += out.legacyLib; out.con += out.legacyCon;                 // proposed = checkable events + the old local total
  if (out.legacyLib + out.legacyCon > 0) out.flags.add('includes the old local total');
  out.flags = [...out.flags];
  return out;
}

const CSV_COLUMNS = ['uid', 'name', 'entries', 'raw_lib', 'raw_con', 'old_local_lib', 'old_local_con', 'proposed_lib', 'proposed_con', 'flags', 'approved_lib', 'approved_con'];
const cell = v => {                                                    // quotes, and a leading quote against spreadsheet formulas
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export function reviewCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    const p = r.proposal;
    lines.push([r.uid, r.name, p.entries, p.rawLib, p.rawCon, p.legacyLib, p.legacyCon, p.lib, p.con, p.flags.join('; '), '', ''].map(cell).join(','));
  }
  return lines.join('\n') + '\n';
}

export function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}

/* the reviewed file: rows with an approved figure become baseline entries; blank means "not approved" */
export function parseReview(text, {allowAbove = false} = {}) {
  const rows = parseCsv(text), head = rows.shift() || [], col = n => head.indexOf(n);
  for (const n of ['uid', 'approved_lib', 'approved_con']) if (col(n) < 0) throw new Error(`The reviewed file needs a "${n}" column.`);
  const out = [], problems = [];
  rows.forEach((r, i) => {
    const uid = (r[col('uid')] || '').trim(), line = i + 2;
    if (!uid) return;
    const parse = (name, max) => {
      const raw = (r[col(name)] || '').trim();
      if (raw === '') return null;
      if (!/^\d+$/.test(raw)) { problems.push(`Line ${line}: ${name} must be a whole number of 0 or more (got "${raw}").`); return null; }
      const n = Number(raw);
      if (n > max && !allowAbove) { problems.push(`Line ${line}: ${name} ${n} is above ${max}. Check it, or run with --allow-above.`); return null; }
      return n;
    };
    const lib = parse('approved_lib', SANITY.lib), con = parse('approved_con', SANITY.con);
    if ((lib === null) !== (con === null)) problems.push(`Line ${line}: approve both virtues explicitly, including 0, or leave both blank.`);
    else if (lib !== null && con !== null) out.push({uid, lib, con});
  });
  const dup = out.map(x => x.uid).filter((u, i, a) => a.indexOf(u) !== i);
  if (dup.length) problems.push('A student appears more than once: ' + [...new Set(dup)].join(', '));
  return {rows: out, problems};
}

/* ledger entries for the approved balances */
export function baselineEntries(rows, {approvedBy, nowMs}) {
  const entries = [];
  for (const r of rows) for (const v of ['lib', 'con']) {
    if (r[v] > 0) entries.push({
      id: `${r.uid}|baseline:${v}`,
      data: {uid: r.uid, why: 'baseline', v, xp: r[v], day: 'baseline', t: nowMs, createdAt: nowMs, approvedBy,
             source: 'earlier XP, computed in the student\'s browser, reviewed and approved by the instructor'},
    });
  }
  return entries;
}
