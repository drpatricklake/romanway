# Atrium rewards update: rollout runbook

For the developer. Nothing here has been deployed. Read `docs/atrium-mapping.md` first for what changed and why.

## What the update does

Atrium XP is now computed and recorded by the server. The browser no longer stores or awards XP. A student's page asks `/api/atrium-rewards` to look at a few named items; the server reads the stored question, replies, marks, enrollment, mastery, pairing approval, and server timestamps itself, and writes awards to `classes/<class>/atriumLedger`, which no page can write.

## Order of steps

The order matters. Steps 1 to 3 change nothing a student can see.

1. **Run the emulator tests.** `cd developer/tests && npm ci --ignore-scripts && npm test`. `atrium-rules.test.mjs` and the updated suites have never been run (see "Verification status"). Fix anything that fails before continuing.
2. **Check the server's Google identity.** The route uses the same keyless identity as `api/registration.js` (`prepareGoogleIdentity`, service account `romanway-registration@latinrw.iam.gserviceaccount.com`). Confirm that account can read and write Firestore (for example `roles/datastore.user`). If it was granted narrower access, grant what the new collections need, or add a separate account and relax the pinned address in `server/vercel-google.js`.
3. **Publish the rules** (Firebase console, Rules). This release is additive: it adds the new collections and subcollections, and it leaves the old writes working. `strict` is not set, so tabs running the previous page can still write the old marks array and `earned`. The server ignores both for XP.
4. **Review and apply the starting balances** (next section). This sets `rewardsFrom`.
5. **Deploy to Vercel** (rebuilt `index.html`, `firebase-social.js`, `firebase-auth.js`, and the new route). Ask students to reload.
6. **Watch for a day.** Check the ledger in the console and in the instructor's Atrium tab.
7. **End the update period.** Set `strict: true` on `classes/pilot/socialSettings/atrium` in the Firebase console. From then on the old marks array is frozen and `earned` is refused in the private record.

Until step 4 is done, the route answers but pays nothing (`notStarted: true`): events already counted in the old totals would otherwise be paid a second time.

## Transition: old tabs and the update period

Firestore rules and Vercel deployments are separate, and a student can have an old tab open for days. So the freeze is a switch, not a deployment.

- **Before `strict`** (steps 3 to 6): an old tab keeps working, and nothing it writes can earn XP. Its marks array and `earned` are ignored by the server, and a new tab never counts them.
- **After `strict`** (step 7): an old tab's Atrium save is refused. A new tab shows "This page is out of date. Reload it to keep using the Atrium." An old tab shows its generic error, so tell students to reload before you flip the switch.
- **If you prefer a clean break:** set `strict: true` at step 3 and tell the class the Atrium is closed for a few minutes while they reload. The mechanism is the same.
- **To go back:** set `strict` to `false` or delete the field.

Two things the switch does not cover:

- Old tabs still publish their own local totals to `socialScores` (the Spectacula leaderboard). That path is browser-written, as the README says, and is unchanged.
- Rules cannot read the instructor's settings for a class other than the one in the path. The private-record check uses the pilot class's switch. The server ignores `earned` in every class, so this is hygiene only.

## Migrating earned XP

Earlier XP was computed and stored by each student's browser, so it is not evidence. It is neither erased nor trusted.

1. `node scripts/atrium-baseline.mjs propose > review.csv`
   Read-only. For each active member it re-applies today's caps to the recorded events, shows the raw figure beside the proposed one, keeps the old local total (`legacy:lib` and `legacy:con`) in its own columns, and flags inflated, duplicated, or malformed entries.
2. Dr. Lake opens `review.csv` in a spreadsheet and fills `approved_lib` and `approved_con` for the students whose balances she accepts or corrects. Blank means not approved. Values above 1,000 (Līberālitās) or 500 (Cōnstantia) need `--allow-above`.
3. `node scripts/atrium-baseline.mjs apply review.csv --approved-by <her uid>` shows exactly what would be written. Add `--write` to save.
   Each approved balance becomes a ledger entry `<uid>|baseline:lib` or `:con` (create-only, so a second run changes nothing), labelled as reviewed earlier XP. If `rewardsFrom` is not set, it is set to the current time. From then on the ledger pays awards for events after that time, and events before it are covered by the baseline.

The old arrays stay in each student's private record (renamed `legacyEarned` the next time that student saves). The page never counts them. The totals the page shows come only from ledger entries.

## Costs

Measured with the in-memory test store (17 documents read for a request covering one question with three replies and one mark):

| Request | Documents read | Transactions |
|---|---|---|
| First, with four awards to write | 17 | 5 |
| The same request again | 17 | 1 (the rate-limit counter) |

- Awards, caps, and "already considered" decisions are each written once. A reply that hit the daily cap is recorded with zero XP so it is not re-decided on every request.
- A page names at most 10 questions and 2 clients per request, and settles when the Atrium opens and after a reply, a mark, or a follow-up. Nothing scans the whole class.
- The server allows 20 requests a minute per student; a burst gets HTTP 429, not an error.
- Assumed pilot load of 30 students, a few requests each a day, and about 20 reads each: well under 50,000 reads and 20,000 writes a day. Confirm the current Firestore free allowance and your plan before relying on that.
- The instructor's Atrium tab reads every question, its replies, its marks, and its claims each refresh. That is the largest single cost; cap it if the class grows.

## Rollback

Rules and code are independent. To roll back: republish the previous rules, redeploy the previous Vercel build. The ledger and baseline entries stay; nothing in the old code reads them. The old XP arrays were never deleted.

## Verification status

**Run and passing:** engine tests (concurrency, retries, caps, once-only awards, private questions, class boundaries, bounded work, rate limit, local days, cutover); route tests (authentication, works while registration is closed, ignores any body-supplied identity or amount); migration tests; and the existing suites (core, registration, auth, ui, race-ui, social-ui, practice-clarity, nle) against the rebuilt `index.html`. The engine tests use an in-memory store that imitates Firestore's transaction rules; it is not Firestore.

**Never run:**
- `atrium-rules.test.mjs`, and the existing `social.test.mjs` against the changed adapter. They need the Firestore emulator, which could not be downloaded where this was written.
- The rules file itself has not been compiled. Brace and parenthesis counts balance, and it was reviewed by hand twice (one scoping error was found and fixed that way), but only the rules compiler can confirm it.
- `server/atrium-firestore.js` and `server/admin.js` against real Firestore and Google credentials.
- `scripts/atrium-baseline.mjs` against real data (its pure parts are tested).
- Real Google sign-in and a phone.