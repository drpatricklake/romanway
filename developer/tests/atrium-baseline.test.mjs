import assert from 'node:assert/strict';
import {proposeForStudent, reviewCsv, parseCsv, parseReview, baselineEntries, SANITY} from '../../server/atrium-baseline.js';

const T = Date.UTC(2026, 10, 20, 17);
const ev = (k, why, xp, over = {}) => ({k, why, v: over.v || (why === 'followup' ? 'con' : 'lib'), xp, day: over.day || '2026-11-20', t: over.t ?? T});

// 1. the proposal re-applies today's caps to what was recorded, and keeps the raw figure beside it
{
  const earned = [
    ...['a', 'b', 'c', 'd', 'e'].map((n, i) => ev('rp:' + n, 'reply', 5, {t: T + i})),       // five replies in a day: only three count
    ev('hp:q1', 'helpful', 10, {t: T + 10}), ev('hp:q2', 'helpful', 10, {t: T + 11}),        // 15 + 10 + 10 = 35, ceiling 30
    ev('pl:x:5', 'patron', 15), ev('fu:5', 'followup', 10),
  ];
  const p = proposeForStudent(earned);
  assert.equal(p.rawLib, 25 + 20 + 15);
  assert.equal(p.lib, 30 + 15, 'replies and marks capped at 30 for the day, plus the patron award');
  assert.equal(p.con, 10);
  assert.ok(p.flags.includes('daily limit exceeded'));
}

// 2. inflated, duplicated, malformed, and unknown entries are flagged and not counted
{
  const p = proposeForStudent([ev('rp:1', 'reply', 500), ev('rp:1', 'reply', 5), ev('rp:2', 'mystery', 5), {k: 'x', xp: 'lots', v: 'lib', why: 'reply'}, null]);
  assert.equal(p.lib, 5, 'a 500 XP reply is paid at the 5 XP maximum, and its duplicate is dropped');
  for (const f of ['an entry exceeds its maximum', 'duplicate entry', 'unrecognised kind of award', 'malformed entry']) assert.ok(p.flags.includes(f), f);
  assert.deepEqual(proposeForStudent('nonsense').flags, ['record is not a list']);
}

// 3. the old local total is kept visible and separate, and flagged as student-written
{
  const p = proposeForStudent([{k: 'legacy:lib', v: 'lib', xp: 340, why: 'legacy', day: '2026-11-01', t: T}, {k: 'legacy:con', v: 'con', xp: 60, why: 'legacy', t: T}, ev('rp:z', 'reply', 5)]);
  assert.equal(p.legacyLib, 340); assert.equal(p.legacyCon, 60);
  assert.equal(p.lib, 345); assert.equal(p.con, 60);
  assert.ok(p.flags.includes('includes the old local total'));
}

// 4. the review file round-trips, quotes names, and defuses spreadsheet formulas
{
  const csv = reviewCsv([{uid: 'u1', name: 'Smith, Anna', proposal: proposeForStudent([ev('rp:1', 'reply', 5)])}, {uid: 'u2', name: '=HYPERLINK("x")', proposal: proposeForStudent([])}]);
  const rows = parseCsv(csv);
  assert.equal(rows[0][0], 'uid');
  assert.equal(rows[1][1], 'Smith, Anna');
  assert.equal(rows[2][1], "'=HYPERLINK(\"x\")", 'a formula in a name is neutralised');
  assert.equal(rows[0].length, rows[1].length);
}

// 5. only approved balances are read; blanks mean "not approved"; bad values are rejected, not guessed
{
  const head = 'uid,name,entries,raw_lib,raw_con,old_local_lib,old_local_con,proposed_lib,proposed_con,flags,approved_lib,approved_con\n';
  const ok = parseReview(head + 'a,A,1,5,0,0,0,5,0,,40,10\nb,B,1,5,0,0,0,5,0,,,\nc,C,1,5,0,0,0,5,0,,25,0\n');
  assert.deepEqual(ok.rows, [{uid: 'a', lib: 40, con: 10}, {uid: 'c', lib: 25, con: 0}]);
  assert.deepEqual(ok.problems, []);
  const partial = parseReview(head + 'c,C,1,5,0,0,0,5,0,,25,\n');
  assert.equal(partial.rows.length, 0);
  assert.match(partial.problems[0], /both virtues/);
  const bad = parseReview(head + 'a,A,1,5,0,0,0,5,0,,-5,\nb,B,1,5,0,0,0,5,0,,12.5,\nc,C,1,5,0,0,0,5,0,,99999,\nd,D,1,5,0,0,0,5,0,,10,\nd,D,1,5,0,0,0,5,0,,20,\n');
  assert.equal(bad.problems.length, 5, 'negative, fractional, above the sanity limit, and a duplicated student');
  assert.equal(parseReview(head + 'c,C,1,5,0,0,0,5,0,,99999,0\n', {allowAbove: true}).problems.length, 0, 'a deliberate override is possible');
  assert.throws(() => parseReview('uid,name\na,A\n'), /approved_lib/);
  assert.ok(SANITY.lib >= 100);
}

// 6. baseline entries are clearly labelled, one per virtue, with stable ids so a second run cannot duplicate them
{
  const e = baselineEntries([{uid: 'a', lib: 40, con: 0}, {uid: 'b', lib: 0, con: 12}], {approvedBy: 'teacher', nowMs: T});
  assert.deepEqual(e.map(x => x.id), ['a|baseline:lib', 'b|baseline:con']);
  assert.equal(e[0].data.why, 'baseline');
  assert.equal(e[0].data.approvedBy, 'teacher');
  assert.match(e[0].data.source, /reviewed and approved by the instructor/);
}

console.log('PASS atrium-baseline: proposals re-apply the caps, flag inflated, duplicated and malformed entries, keep the old local total visible, and write only reviewed balances under stable ids.');
