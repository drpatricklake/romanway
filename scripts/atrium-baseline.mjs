#!/usr/bin/env node
/* Starting balances for Atrium XP, and the cutover to server-computed rewards.

   1. node scripts/atrium-baseline.mjs propose [--class pilot] > review.csv
        Reads each member's private Atrium record and proposes a balance (read-only). Open review.csv in a spreadsheet, fill the
        approved_lib and approved_con columns for the students whose balances you accept (or correct), and save it as CSV.
   2. node scripts/atrium-baseline.mjs apply review.csv --approved-by <your uid> [--class pilot] [--write]
        Without --write, shows exactly what would be written. With --write, creates a baseline entry for each approved balance
        (existing entries are never changed) and, if it is not already set, sets rewardsFrom to the current time. From that moment
        the server ledger pays awards for new replies and marks; earlier events are covered by the approved balances.

   Needs Google credentials for the project (gcloud application-default login, or FIREBASE_ADMIN_CREDENTIALS). */
import {readFileSync} from 'node:fs';
import {adminServices} from '../server/admin.js';
import {proposeForStudent, reviewCsv, parseReview, baselineEntries} from '../server/atrium-baseline.js';

const args = process.argv.slice(2), command = args[0];
const flag = n => args.includes('--' + n), option = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const classId = option('class') || 'pilot';

async function main() {
  const {db} = await adminServices();
  const root = db.doc(`classes/${classId}`);
  if (command === 'propose') {
    const members = await root.collection('members').get();
    const rows = [];
    for (const m of members.docs) {
      if (m.data().status !== 'active') continue;
      const rec = (await db.doc(`users/${m.id}/social/atrium`).get()).data() || {};
      const proposal = proposeForStudent(rec.earned || rec.legacyEarned || []);   // pages updated since the cutover keep the old array as legacyEarned
      if (proposal.entries || proposal.lib || proposal.con) rows.push({uid: m.id, name: m.data().displayName || '', proposal});
    }
    process.stdout.write(reviewCsv(rows));
    console.error(`${rows.length} students with recorded Atrium XP. Fill approved_lib and approved_con, then run "apply".`);
    return;
  }
  if (command === 'apply') {
    const file = args[1], approvedBy = option('approved-by');
    if (!file || !approvedBy) throw new Error('Usage: apply review.csv --approved-by <uid> [--class pilot] [--write] [--allow-above]');
    const {rows, problems} = parseReview(readFileSync(file, 'utf8'), {allowAbove: flag('allow-above')});
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    const now = Date.now(), entries = baselineEntries(rows, {approvedBy, nowMs: now});
    const settingsRef = db.doc(`classes/${classId}/socialSettings/atrium`), settings = (await settingsRef.get()).data() || {};
    console.error(`${rows.length} students, ${entries.length} baseline entries. rewardsFrom is ${settings.rewardsFrom ? 'already ' + new Date(settings.rewardsFrom).toISOString() : 'not set; it would be set to now'}.`);
    for (const e of entries) console.error(`  ${e.id}  ${e.data.xp} XP`);
    if (!flag('write')) { console.error('Dry run. Add --write to save.'); return; }
    for (const e of entries) {
      try { await db.doc(`classes/${classId}/atriumLedger/${e.id}`).create(e.data); }
      catch (err) { if (!/already exists|ALREADY_EXISTS/i.test(String(err.message))) throw err; console.error(`  ${e.id} already exists; left unchanged`); }
    }
    if (!settings.rewardsFrom) { await settingsRef.set({rewardsFrom: now}, {merge: true}); console.error('rewardsFrom set. Server-computed rewards start now.'); }
    return;
  }
  throw new Error('Usage: atrium-baseline.mjs propose | apply review.csv --approved-by <uid> [--write]');
}
main().catch(e => { console.error(e.message); process.exit(1); });
