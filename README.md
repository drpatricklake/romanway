# Latin: The Roman Way — classroom pilot update

This release extends the Firebase version currently in `drpatricklake/romanway` at commit `931e0d76deb9711b70af455b3c3dbd0ce1d0a00e`.

It adds the instructor dashboard, shared Circus features, pilot reward evidence, and the expanded word-form index. Existing Google accounts, student progress, the instructor UID, lessons, and artwork are retained.

## Install the update

1. Unzip the package.
2. Open **Firebase → latinrw → Firestore Database → Rules**. Open `firestore.rules` in a text editor, copy its complete contents into the rules editor, and click **Publish**. These rules extend the earlier pilot rules. Do not replace unrelated rules if this database has since been used for another app.
3. Upload **all seven app files below together** to the top level of `drpatricklake/romanway`, replacing files with the same names. Commit to `main` and let Vercel deploy.
4. Open [romanway.vercel.app](https://romanway.vercel.app/), refresh, and sign in with your existing instructor Google account.

| App file | Purpose |
|---|---|
| `index.html` | Updated app, dashboard, and Circus interface |
| `firebase-auth.js` | Existing working Google sign-in |
| `firebase-data.js` | Private saving, summaries, and classroom connection |
| `firebase-classroom.js` | Shared assignments, live rounds, ghosts, and factions |
| `pilot-core.js` | Progress summaries, reward evidence, and race calculations |
| `word-forms.js` | Expanded lexical and morphological index |
| `README.md` | Instructions; safe to keep in the repository |

The six `.html`/`.js` application files are required. The seventh file is documentation. Upload the extracted files, not the ZIP itself. Publishing a rules file to GitHub does not publish Firestore rules. Step 2 is necessary.

No npm command or service-account key is needed to deploy this static app. Google sign-in uses the Firebase configuration already in the current app.

## First live check

Before students depend on the new shared features, check these with an instructor account and a separate approved student account. Use separate browsers or a private window.

1. Sign in as the instructor. Open **Teacher**. Confirm the real roster appears.
2. Sign in as a student. Complete a small exercise and wait for **Saved online**. Confirm that progress returns in another browser.
3. Refresh the teacher roster. New columns fill when students next sign in and save. Earlier records say **Awaiting sync** until then.
4. In **Teacher → Assignments**, publish one worksheet. Confirm it appears in that student’s **Domus → Tablinum**, and that their submission appears in **Teacher → Students → View work**.
5. In **Teacher → Class settings**, change a setting and confirm it reaches the student. Restore the desired pilot settings afterward. The default required-practice threshold remains 80%.
6. Once the student has completed the Circus training drills for Lesson I, open **Teacher → Circus & factions**, select Lesson I, and open a lobby. Have the student join from the Circus. Start the round and check the saved result and faction total.
7. Have two approved students finish trainer races. Each should be able to race an eligible classmate’s ghost.
8. Open the Codex and try **Word-form index** with `captā`, `essent`, and `quōrum`.

If all students begin signing in tomorrow, keep their current working sign-in available while you perform this check. This package is prepared and locally tested; uploading it and publishing its rules are still necessary. It has not been deployed to your production project from this workspace.

## Instructor dashboard

- **Students** — live membership and saved-progress roster, Circus training and shared-race counts, Biblioteca completion, Sentence Lab completion, total XP, all six virtues in exports, denarii, and last-save time.
- **Sentence Lab steps** — first-try step scores, using the first completed analysis of each sentence. Steps not used contribute no score. These scores describe the analysis steps, not a translation grade.
- **View work** — saved worksheets, notes, translations, exercise records, individual step scores, virtues, and reward activity. Student work remains read-only in this release.
- **Assignments** — worksheets, projects, Biblioteca scrolls, and Circus drills, with an optional due date and class-wide or individual audience. Removing an assignment keeps the work. Assigned scrolls open for the selected students even if their usual reading sequence has not yet reached them.
- **Class settings** — learning and model-answer preferences, practice threshold and length, vocabulary review, goals, Sentence Lab default/lock, personal currency mode, Circus settings, and Biblioteca settings. AI translation feedback remains off pending a separate provider integration.
- **Circus & factions** — live-round host controls, individual faction overrides, even distribution, and the seven-day faction competition.
- **Pilot evidence** — measurement start dates and reward-event export. Purchase activity includes the item ID so spending can be grouped by item.
- **Class access** — current class code and code replacement. Approvals remain under Students.

CSV exports include the real roster, Sentence Lab steps, and measured reward events. Spreadsheet formula prefixes are escaped. Scores continue to originate in the app’s existing practice-grading logic and are not a tamper-resistant official gradebook.

## Shared Circus rules

### Live rounds

The instructor opens a lobby containing eight frozen questions. Students who have trained the relevant lessons join under their avatar name, or a generated charioteer alias. The instructor starts a common countdown.

Each question has twelve seconds for an answer and three seconds for review. The server enforces the round window, with a two-second transport grace period. An answer is immutable once submitted. Peers cannot read each other’s answers before the round closes. Reloading a live round retrieves the student’s submitted answers.

After the eighth question, the scoreboard and review show the actual participants’ answers and scores. A missing answer scores zero. A cancelled round gives no result or faction points. The instructor can watch without becoming a scored student.

### Ghost races

A completed trainer race is saved to the class as a ghost, using its exact question IDs, question text, options, correct answers, and response timings. Students can choose from the six closest eligible ghosts among the latest sixty published runs. They answer the same frozen question set without waiting for another student.

One recorded result per student per source race is immutable. Replays are available for practice and retain the first recorded result for faction purposes. A pending trainer ghost is retried when the classroom connection is available. An unfinished ghost race restarts if the page is closed; it has no stake to lose.

### Scores, factions, and rewards

A correct answer earns 10 points and up to 5 speed points. An incorrect or missed answer earns zero. Race timing is browser-reported; this is classroom practice, not a secure timed examination.

The first five shared finishes per student per UTC day count toward their faction’s seven-day total. Further practice remains available. The server enforces the daily contribution cap and immutable result IDs. Existing points stay with the faction represented at the finish when an instructor changes a student’s faction.

Shared rounds and ghosts have **no stakes**. Existing trainer-race stakes keep their existing class control. Shared results feed the existing Circus record and its existing Virtūs XP calculation, which already limits additional match XP. No new coin payouts or new shop prices are introduced here.

Automatic factions follow the calling. Saving an even split assigns the approved roster across the four factions. An individual override takes priority. Newly approved students are assigned as they join an even-split class.

## Pilot evidence and tuning

The initial sign-in on this release records a starting balance and virtue baseline. Existing earnings are not reported as new. Later saves record changes in denarii, attempts, training completions, reading activity, and virtue XP, with the app activity that caused them. Purchases include item IDs.

The ledger contains numerical changes and activity identifiers, not answer text, keystrokes, or browsing outside the app. The instructor export associates the records with the approved student account so you can compare participation and outcomes.

Use the first pilot data to compare earning rates, repeated practice, item purchases, available balances, and time to rank milestones. No prices or XP thresholds have been changed without that evidence. The original rank and virtue rules remain in place; the ledger can also reveal a recalculation when a policy change affects the app’s derived XP totals.

## Word-form index

The baseline index covered about half of the distinct words in the 1,195 Sentence Lab sentences. The expanded index has an entry for every one of their **3,977 distinct normalized surface forms**, representing **11,205 token occurrences**.

Coverage means an entry exists, not that an ambiguous form has only one interpretation. The index distinguishes dictionary headwords, generated paradigm candidates, exact textbook glosses, editorial lexical supplements, abbreviations, numerals, and observed forms. Homographs retain alternatives. Macrons are preserved for display and ignored in lookup keys.

All existing sentence-specific case answers remain unchanged. The fuller dictionary supplies lookup help and candidates without replacing the sentence’s case keys. The Lab can now require the **94 participle positions already marked in the existing authored data**, from Lesson XXVI onward. A guessed suffix alone never creates a required answer.

One source spelling, `repperiēs`, is explicitly flagged in the index for review against the usual future `reperiēs`. The source sentence has not been rewritten and no scoring key has been changed on that basis.

`developer/word-form-coverage.csv` lists the surface forms, alternative lemmas/analyses, sources, and example locations. `developer/authored-participles.csv` lists the additional required positions. New texts added later should be audited again rather than assumed to inherit complete coverage.

Grammar references used for the paradigm implementation

- [Allen & Greenough, Verb Conjugations](https://dcc.dickinson.edu/grammar/latin/verb-conjugations)
- [Forms of the Participle](https://dcc.dickinson.edu/grammar/latin/forms-participle)
- [Irregular compounds of sum](https://dcc.dickinson.edu/grammar/latin/irregular-verbs-compounds-sum)
- [Irregular verbs dō and eō](https://dcc.dickinson.edu/grammar/latin/irregular-verbs-d%C5%8D-e%C5%8D-and-ade%C5%8D)

## What was checked

- Existing Google-to-Firestore startup, account isolation, private saving, offline retry, revision conflicts, and multi-device resume.
- The original 42 Firestore permission checks, plus shared-classroom integration checks for assignments, pseudonymous profiles, instructor settings, live lobbies, answer privacy and time windows, scoreboards, immutable results, ghost races, faction overrides, the daily cap, and revoked membership.
- Teacher navigation and forms, publishing an actual assignment from the app’s catalog, Tablinum integration, read-only work, and role revocation in the app test harness.
- A complete eight-question ghost race, timed transitions, answer lock, result save, duplicate-reward prevention, and a failed save followed by explicit retry.
- Existing exercise grading, Sentence Lab behavior, and all **601 lesson tabs**.
- All 1,195 Sentence Lab analyses compared against the previous release. Existing case decisions remain unchanged; the only additional required verb positions are the 94 authored participles.
- Morphological examples, homographs, contracted forms, numerals, and complete surface-form coverage.

A scripted Chromium check was prepared, but this environment blocked browser startup. Visual phone behavior and real-account shared races therefore still need the short live check above. The new interface includes responsive tables and controls and honors reduced-motion preferences.

## Developer scope and next work

The included update covers the four requested areas. Private storage stays at the existing paths and uses the same browser storage keys. The shared additions are under `classes/pilot`.

| Shared path | Purpose |
|---|---|
| `assignments/{id}` | Instructor-published work |
| `classmates/{uid}` | Avatar alias, calling, training eligibility, and weekly class-goal contribution; no real name or email |
| `circusRooms/{id}` | Teacher-created frozen question set and start time |
| `circusRooms/{id}/participants/{uid}` | Lobby participant and represented faction |
| `circusRooms/{id}/rounds/{n}/answers/{uid}` | Immutable submitted answer |
| `circusGhosts/{id}` | Frozen saved trainer race |
| `circusResults/{uid_kind_source}` | First shared result per source |
| `circusDays/{uid_day}` | Atomic daily faction-contribution cap |
| `clocks/{uid}` | Server-clock synchronization |

The teacher roster listens to membership and each approved student’s saved summary. Public shared features use aliases rather than account names or emails. The real weekly class goal now uses recorded contributions instead of the old sample base value.

The weekly faction query reads all results in its seven-day window. Ghost discovery and live-room history are intentionally limited to sixty and twenty recent records. Review Firestore usage during the pilot before increasing class size. No additional composite index is needed for these queries.

The server restricts instructors, membership, ownership, timing windows, and contribution limits. It checks correctness counts against the frozen answer key and bounds speed points. Browser timing, individual practice grades, and ghost creation remain client-originated. Strong examination security would require a separate server assessment service.

Shared Atrium tutoring, the Arena’s existing shared modes, institutional licensing, multiple independent classrooms, Microsoft sign-in, server grading, and an AI translation provider remain separate work. Those features have not been silently replaced or claimed as complete here.

The source and tests are organized for review in `developer/`. The app still contains the original textbook content and art references. No existing student records are deleted or reset by this update.
