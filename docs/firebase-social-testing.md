# Atrium and Arena Firebase rollout

Deploy in two stages: merge the Firebase social-services PR first and wait for **Firestore rules → Deploy production rules** to succeed. Then test and merge the Atrium/Arena screen PR. The second preview talks to the same class database; it cannot use new paths until the first rules release succeeds.

## Services

`firebase-social.js` adapts the existing tutoring and Arena screens to the signed-in Firebase UID. No Claude service or Claude account is used for these features. Collections are under `classes/pilot`; private records remain under `users/{uid}/social`.

- Atrium profiles contain avatar aliases, lesson-completion signals, and pairing requests/acceptance; they contain no question or reply text, reports, reward ledger, or account email.
- Questions have a class or patron audience and an enforced reader list. Deleting or hiding a question removes class/patron access while retaining an owner/instructor record. Replies inherit the parent question's visibility; hidden replies are instructor-only. Author-only writes and instructor-only settings/moderation are enforced by rules.
- Patron-only creation requires mutual pairing and instructor approval by default. Instructors can turn approval off. Peers must have completed and mastered the lesson to reply; instructors can reply directly. Completion signals are supplied by the educational client, not a server-verified examination engine.
- Rewards keep the current app's values: 5 XP for substantial replies (first three/day), 10 helpful XP once per question/helper, 30 combined reply/helpful XP/day, 15 patron XP after a relevant exchange precedes client lesson completion, and 10 follow-up practice XP once per lesson. Existing locally recorded Atrium XP is retained as a migration baseline. No economy retuning is included.
- Arena sharing is opt-in. The latest practice and checkpoint ghost is published under the student's UID and avatar alias. Private match history stays private. Existing question IDs, quiz answers, coin limits, Elo formula, and one-rated-attempt-per-checkpoint behavior are retained. An unrated seed ghost can now bootstrap a rated opponent; otherwise the checkpoint never acquired its first opponent.
- General Spectacula XP leaderboards also use Firebase, with avatar aliases for classmates and account names only for instructors. Circus shared races were already Firebase-backed and remain unchanged.
- New settings are instructor-only. Private records cannot be read by other students. Approved instructors retain the same approved-roster access policy as the dashboard. Revoked members cannot read or write shared class data.

## Preview checklist

1. Teacher and test student: sign in with Google and ensure the student is approved. Use Account if necessary. If the preview host changes, authorize its exact hostname in Firebase Authentication settings.
2. Student: open a lesson, choose **Ask the Atrium**, select/type a question and fill in what you tried and what you do not understand. Send to the class.
3. Teacher: Domus → Atrium → Refresh. Reply with a hint/explanation. Student: Refresh → Your questions → This helped; check the follow-up practice and persistence after sign-out/in.
4. For peer tutoring, use a second approved student who has mastered that lesson. Offer a patron after Lesson II, request/accept a client, and approve the pairing in the Atrium Teacher tab. Send a patron-only question. A third student should not see it.
5. Report a reply; inspect the instructor's reports. Hide/unhide a question and reply. Refresh from each account to check visibility. Students can close, reopen, or delete their own questions.
6. Arena: enable **Share my saved match**, complete a Ludus bout, then use the second account's **Find ghosts and the checkpoint**. Choose the saved ghost, finish the same questions, and check Missio and private recent history. Turning sharing off removes that ghost.
7. Teacher: publish a checkpoint. Complete an unrated seed with sharing enabled; another account should now have a rated checkpoint opponent. That account gets only one rated attempt on this checkpoint.
8. Spectacula → Leaderboards: verify aliases and teacher controls. Sign out and switch accounts; shared caches should clear.

Refresh is explicit in Atrium and Arena; this release does not add live chat or real-time gladiator combat. Browser-reported game scores and virtue ledgers remain suitable for the classroom pilot, not tamper-proof competitive examinations.

## Scope and migration

Existing Firebase lesson progress, accounts, roster, Circus data, and class settings stay in place. Previously stored Claude questions, pairings, and ghost records cannot be fetched through this connection and are not copied; the Firebase shared queues start fresh. Existing local Arena state and saved lesson progress remain in the user's private progress. Old Atrium XP totals have a one-time carry-forward into the first Firebase record.

The separate composition-task settings still have their earlier storage adapter; they are not part of this tutoring/ghost-match migration. No production records have been deleted by this implementation.

## Verification

Run `npm ci --ignore-scripts` then `npm test` under `developer/tests`. The social emulator checks cover class questions/replies, unqualified helpers, approved private pairing, direct-path privacy, moderation, reports, revoked membership, ghost ownership/opt-out, private histories, checkpoints, leaderboard ownership, and stale account sessions. The screen integration PR also runs `social-ui.test.mjs` for exact question replay, seed bootstrap, repeat-attempt prevention, and cache clearing. These are headless harness/emulator tests; real Google OAuth and visual/mobile review remain hosted checks.
