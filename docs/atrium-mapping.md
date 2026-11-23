# Atrium: mapping the revised design onto the Firebase data model

Proposed patch for developer review. Not deployed. Revision 2, after the five pre-deployment checks. The deployment steps are in `docs/atrium-rewards-rollout.md`.

## The five checks

| Check | What this revision does | Where |
|---|---|---|
| 1. Repeated and simultaneous requests must not duplicate awards | Each award is created under a stable id (`<uid>\|<kind>:<ids>`) in its own transaction, together with the helper's daily counter (`atriumDaily/<uid>_<day>`). Two tabs, a retry, or six simultaneous requests cannot duplicate an award or exceed a cap. A transaction that keeps losing to another writer is retried with a short pause; a burst from one student is answered with 429, never an error. | `server/atrium-engine.js`; tests 5 to 8 and 14 in `atrium-engine.test.mjs` |
| 2. The server must establish eligibility itself | The route reads the question, replies, marks, enrollment, mastery, the pairing and its approval, and Firestore's own `createTime` for every document. The browser sends only which ids to look at; a uid, total, or award in the request body is never read. It checks that the caller is an active member of that class, and skips private questions the caller cannot read. Authors must be active, non-staff members of the same class. It reuses registration's keyless Google identity and token verification, not its on/off switch. | `server/atrium-engine.js`, `server/admin.js`, `api/atrium-rewards.js`; `atrium-route.test.mjs` |
| 3. Existing XP needs a migration policy | Neither erased nor trusted. A read-only tool proposes a balance per student by re-applying today's caps to what was recorded, shows the raw figure beside it, and flags inflated or duplicated entries. Dr. Lake approves figures in a spreadsheet. Only approved figures are written, as labelled `baseline` ledger entries. The page counts ledger entries only; the old arrays are never an XP source and are kept as `legacyEarned`. A start time (`rewardsFrom`) prevents events already counted in the old totals from being paid again. | `server/atrium-baseline.js`, `scripts/atrium-baseline.mjs`; `atrium-baseline.test.mjs` |
| 4. A practical transition | Rules go first and are additive, so old tabs keep working. A switch in the Atrium settings (`strict`), set by the developer in the console, ends the update period without a second rules deployment. A new page left open across the switch shows a plain "reload" message. The old marks array and `earned` are ignored by the server from the start, so nothing is exposed during the update period. `index.html` is rebuilt by a new build step, and the emulator tests are updated. | `firestore.rules`, `developer/apply-atrium-rewards.py`, runbook |
| 5. Preserve awards without rescanning everything | Awards are only ever added: closing, reopening, or deleting a question, or a teacher hiding a reply later, leaves recorded awards in place. A request names at most 10 questions and 2 clients. Awards already written are skipped before any transaction. A reply that hit the daily cap is recorded once with zero XP, so it is not re-decided each time. Measured: 17 documents read for a typical request; a repeat request runs one transaction. | engine; test 13; runbook "Costs" |

## What was already correct

The Firebase build already carries the revised Atrium screen, and `firebase-social.js` plus `firestore.rules` already implement much of the design.

| Design | Backend |
|---|---|
| A student's own record | `users/{uid}/social/atrium`, readable only by the student and the instructor |
| Public profile (alias, furthest lesson, mastery, pairing state) | `classes/<class>/atriumProfiles/{uid}`, no question or reply text |
| A question for the class or only a patron | `atriumQuestions/{uid}_{askId}` with `audience`, `readers`, `hidden`, `deleted` |
| Replies with a hint, rule, or check | `atriumQuestions/{q}/replies/{helper}_{replyId}` |
| Replies only from students who mastered the lesson | the reply rule checks `atriumProfiles.mastered` and `done` |
| One client per patron | rule: `clients.size() <= 1` |
| Teacher moderation and pairing approval | `hidden`; `pairApproved()`; `socialSettings/atrium` |
| Real names only for the instructor | `user.profiles` returns `members.displayName` to instructors and `classmates.alias` to students |

## Defects found in the current build

1. **Students can write their own XP.** The rule for `users/{uid}/social/{kind}` accepts any content from the owner, and the reward ledger lived there. Fixed: XP lives in `atriumLedger`, which no page can write.
2. **Helpful marks can be fabricated.** They were a free-form array on the question document, so an asker could credit a helper who never replied. Fixed: a mark is a document that must point at an existing reply, is stamped with server time, and cannot be repeated or removed.
3. **"I'm helping with this" is invisible to other students.** The claim was stored only in the helper's private record. Fixed: claims are readable documents in the thread.
4. **Patron and follow-up awards were computed in the browser.** Fixed: the server derives both from stored data and server timestamps.

One more defect was found while writing this revision, in the first version of this patch rather than the current build: it deleted each student's old `earned` list on their next save, which would have erased earlier XP. That is why the old list is now preserved under `legacyEarned`.

## Data model changes

New collections under `classes/<class>/`:

- `atriumQuestions/{q}/thanks/{helper}`: helpful mark (create-only, server time).
- `atriumQuestions/{q}/claims/{uid}`: temporary claim (create and delete by its owner).
- `atriumCompletions/{uid}_{lesson}`: server-time record that a lesson was completed (create-only).
- `atriumFollowups/{uid}_{lesson}`: server-time record that follow-up practice was done (create-only).
- `atriumLedger/{uid}|{kind}:{ids}`: awards, written only by the server. `capped: true, xp: 0` marks a decision that a cap applied.
- `atriumDaily/{uid}_{day}` and `atriumRate/{uid}`: server bookkeeping, closed to every page.

Settings: `socialSettings/atrium` gains `rewardsFrom` (when server rewards began) and `strict` (the end of the update period). A client write, including the instructor's, cannot add, change, or remove either. The instructor's save in the adapter carries them through unchanged.

## Reward rules as implemented

| Action | Reward | Limit |
|---|---|---|
| A substantial reply: 50 or more characters, a valid kind, not hidden, from an active non-staff classmate who has mastered the lesson | 5 XP Līberālitās | First three each local day |
| The asker marks a helper's reply helpful | 10 XP Līberālitās | Once per question and helper; the reply must itself qualify |
| Replies and helpful marks together | | 30 XP a local day; the last award is topped up to the ceiling |
| A client completes a lesson after the patron's tutoring reply on it, with the pairing approved | 15 XP Līberālitās to the patron | Once per client and lesson; the reply must precede the completion |
| Follow-up practice after help was received on that lesson | 10 XP Cōnstantia to the student | Once per lesson |

The day is the class's local day (`classes/<id>.timezone`, default `America/New_York`). Teachers' replies earn nothing. A private question pays only its approved patron.

## Decisions

| # | Decision | Status |
|---|---|---|
| 1 | **Helpful bonus scope.** Implemented as once per question and helper, matching the table and the rollout note. (My first draft said "once per reply"; the data model enforces per helper.) | Resolved; confirm |
| 2 | **A teacher hides a reply that already earned XP.** The award stays (the ledger is add-only). The alternative is a revocation path. | Open |
| 3 | **Substantive length.** The rules accept replies of 10 or more characters; XP needs 50 trimmed. | Open: one value? |
| 4 | **Day boundary.** Local day, default Eastern. | Resolved; confirm the zone |
| 5 | **Mastery and completion are attested by the student's page.** The rules cannot verify the 80% gate, and the lesson-completed record is created by the page, though its time is server-stamped. The same limit the README states for scores. | Accept for the pilot, or compute mastery on the server |
| 6 | **Pairing history** is kept in the student's own record, which the student can write. | Open: move it to the server if the instructor needs it to be authoritative |
| 7 | **Claims** expire in the app after 20 minutes, but the documents persist. | Open: a cleanup, if wanted |
| 8 | **Server identity.** The route reuses `romanway-registration@latinrw...`, whose address `prepareGoogleIdentity` pins. Confirm it has Firestore access, or use a separate account. | Open (developer) |
| 9 | **Starting balances.** Dr. Lake reviews and approves; `rewardsFrom` is set when they are written. | Open (Dr. Lake) |
| 10 | **When to set `strict: true`.** | Open (developer and Dr. Lake) |
| 11 | **Catch-up for events between `rewardsFrom` and the deploy.** A page's hints cover each student's last five questions and replies. A student with more than that in the gap would be settled on later activity. A catch-up script is easy to add if wanted. | Open |
| 12 | **A capped decision is final.** A fourth reply in a day is never paid later, even if an earlier reply is hidden. | Resolved; confirm |
| 13 | **Anyone in the class can ask the server to settle a question they can read.** It is idempotent and returns only their own awards, so it exposes nothing. | Resolved |

If "the other four decisions" means a different set from this table, name them and I will match them.