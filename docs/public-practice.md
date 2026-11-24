# Public Practice: local learner mode

Implemented on `public-practice`. This is development work; the separate public Vercel project has not been created.

`app-config.js` selects `public-practice`. Setting its edition to `classroom` selects the existing Google/Firebase flow in the same application. No classroom data paths or account storage keys have changed. Do not merge the public configuration into the classroom deployment without selecting its appropriate edition.

Public Practice starts from a welcome screen without requesting a name, email, class code, or account. The internal student role opens the existing lessons and games. The application saves progress to `romanway:public-practice:progress:v1` in localStorage, with a versioned envelope. The saved payload excludes the internal learner identity. Existing Google-linked and legacy saves are neither imported nor overwritten.

The full evolving lesson state is saved, including answers, notes, translations, attempts, settings, avatar, and game records. Loading merges default settings and keeps AI feedback disabled. Saving runs through existing input/action handlers and on page hide or backgrounding. No Firebase queue is called in public mode, and the bootstrap loads Firebase only for the classroom edition. Classroom listeners and legacy AI/account/data acquisition are bypassed. The embedded school-filter script is gated to classroom mode because it can inspect entered text.

The device-progress screen explains that progress belongs to one browser profile at one site address, does not sync between devices, and can be lost when site data is cleared or private browsing ends. Anyone sharing that browser profile can view the same local progress. Use a dedicated public address when ready to pilot: preview-address progress will not move automatically to a different domain.

Storage denial and quota failures display an alert and allow continued work in memory, with a retry button. An unreadable or unsupported saved record is preserved rather than overwritten. If storage was initially inaccessible and an older copy becomes visible later, it is also protected; opening a second tab lets the learner restore that copy. No reset, import, or export flow is introduced in this step.

## Verification

Run from the repository root:

```sh
python developer/build.py
node developer/tests/public-practice.test.mjs index.html
node developer/tests/auth.test.mjs index.html firebase-auth.js
node developer/tests/ui.test.mjs index.html developer/tests/fixtures/baseline-index.html
node developer/tests/practice-clarity.test.mjs index.html
```

Public tests cover account-free launch, all 601 lesson tabs, 1,195 Sentence Lab sentences, real translation input saving, reload, avatar/settings/attempt retention, classroom-key isolation, failed storage/retry, unreadable-save preservation, and bypass of account/database startup. Browser QA also confirmed a typed Lesson I guided-note response survived reloading and resuming. Existing classroom tests explicitly select the classroom edition. The build script regenerates the changes from the existing baseline plus `developer/apply-public-practice.py` and `developer/public-practice-ui.js`.

## Next step

Audit all remaining classroom-only screens and shared controls (Atrium, leaderboards, shared races, submissions, class goals, registration routes and server endpoints) for the public edition. Remove misleading shared/instructor language and expose only supported local activities. Perform a complete browser network audit before describing the public deployment as free of student-data transmission. Progress export/import, PWA/offline caching, and the separate Vercel project remain later steps.
