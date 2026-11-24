# Public Practice

Repository: `drpatricklake/romanway`. Development branch: `public-practice`.

## Edition and storage

Classroom and Public Practice use the same application source. `app-config.js` selects `public-practice`; `classroom` selects the Google/Firebase flow. Classroom storage keys and shared features are preserved. Keep the public deployment configuration on this branch until deployment settings are selected independently per project.

Public Practice requests no name, email, class code, or account. Its internal student role enables the lessons and games without authentication. Answers, translations, notes, attempts, settings, avatar, and game records are saved under `romanway:public-practice:progress:v1` in localStorage. The versioned save excludes the internal learner identity and forces AI feedback off. Public saves do not import or overwrite classroom or legacy saves.

Saving uses the existing input/action handlers and page-background/page-hide events. Denied/full storage displays a warning and offers retry while retaining current work in memory. Damaged or unsupported saves are preserved. A previously inaccessible save is protected if it reappears during retry.

Progress belongs to one browser profile and site origin. Clearing site data or ending private browsing can erase it. Anyone using the same browser profile can access it. Preview-domain saves do not transfer automatically to the stable domain. Export/import and PWA/offline support remain planned.

## Public controls and package

Public mode disables Google/Firebase startup, legacy service acquisition, instructor screens/actions, shared Arena checkpoints and ghosts, classmate Circus races, leaderboards, class goals, class codes, Atrium messaging, and cloud AI. Stale hidden actions also return without service calls. Solo activities and local progress remain. The Atrium explains Roman patronage and the classroom-only tutoring feature. Translations/projects describe local saving; worksheets use “Save and check.” Public copy is selected before inserting learner text so matching words in responses are preserved.

Run `node scripts/build-public-practice.mjs` to produce the Vercel Build Output API directory `.vercel/output`. Only seven static files are included: index, 404, configuration, bootstrap, local progress, pilot core, and word forms. There are no Functions, account/database adapters, registration/setup pages, API routes, dependencies, or server files. The captured school-filter script and third-party font requests are removed. A classroom configuration fails the public packaging check.

The artifact includes an early meta Content Security Policy and response headers: `connect-src 'none'`, `form-action 'none'`, no frames/workers/objects, local/data/blob images, and no referrer. This prevents the public application from uploading responses. No analytics is bundled. Hosting still receives ordinary static-resource requests and may keep access logs. External educational links do not carry response text.

## Verification

From the repository root:

```sh
python developer/build.py
git diff --exit-code -- index.html
node developer/tests/public-practice.test.mjs index.html
node scripts/build-public-practice.mjs
node developer/tests/public-isolation.test.mjs
node developer/tests/auth.test.mjs index.html firebase-auth.js
node developer/tests/ui.test.mjs index.html developer/tests/fixtures/baseline-index.html
node developer/tests/practice-clarity.test.mjs index.html
node developer/tests/race-ui.test.mjs index.html
node developer/tests/social-ui.test.mjs index.html
```

The public tests exercise 601 lesson tabs, 1,195 Sentence Lab sentences, actual translation/note input handlers, worksheet checking, game progress, reload, avatar/settings/attempt retention, separate classroom keys, failed storage/retry, damaged-save preservation, and no account/database startup. Isolation tests audit displayed lesson copy and disabled classroom actions with network/adapter spies, and verify the package allowlist, absent Functions, and policy.

After installing `developer/tests` dependencies and Chromium:

```sh
node developer/tests/public-browser.test.mjs
```

This browser test serves the packaged static files with their configured headers. It checks exact response persistence after reload, solo Arena answers, absent shared controls, local saving, only expected static GETs, and no browser script/policy errors. `ROMANWAY_CHROMIUM_PATH` optionally selects an installed Chromium. Local execution in the current Work Mode environment was blocked at Chromium startup; do not count that attempt as a pass. The GitHub workflow runs this test for the public branch after the classroom/browser regression checks.

## Vercel setup

1. Create a separate Vercel project from `drpatricklake/romanway`, selecting `public-practice` as the branch. Import URL: https://github.com/drpatricklake/romanway/tree/public-practice. Verify the branch before building.
2. Name the project `romanway-public` if accepted. Root directory: repository root. Framework: Other. The tracked `vercel.json` supplies the dependency-free install command and `node scripts/build-public-practice.mjs` build command. Leave Output Directory unset; the build emits `.vercel/output` directly. No Firebase, Google, or AI environment variables or integrations are needed.
3. Under Settings → Environments → Production → Branch Tracking, select `public-practice`. Keep the existing classroom project's settings/domain unchanged. If the import screen selects `main`, configure the public branch before creating its production deployment.
4. Check Settings → Domains for `romanway-public.vercel.app`. This address is proposed, not reserved or confirmed available. A `.vercel.app` subdomain does not require purchasing a domain or configuring an external DNS provider.
5. Leave Web Analytics/Speed Insights disabled. Before students use it, verify production opens while signed out and perform the live checks below.

No Vercel project was created or published as part of this implementation task.

## Required hosted verification

After deployment, verify the final Vercel response headers and output: seven expected static files, zero Functions, and `connect-src 'none'`. Confirm `/api/registration`, `/api/atrium-rewards`, `/api/setup-check`, `/register.html`, `/firebase-auth.js`, and `/setup-check.html` return 404.

In a clean signed-out browser, record network traffic while entering a distinctive answer, checking work, playing solo games, navigating, saving, and reloading. Confirm the answer returns unchanged, no answer appears in any request, and there are no fetch/XHR/beacon/WebSocket or third-party requests. Only expected static asset GETs should occur. Check for injected hosting scripts, deployment protection, and any CSP errors. This live-host check is separate from local/package verification.
