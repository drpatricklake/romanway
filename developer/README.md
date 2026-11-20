# Developer handoff

The app files at the package root are ready to deploy together. The main page contains the integrated classroom UI. Its editable source is `pilot-ui.js` here. `build.py` reapplies the small integration changes to baseline Git commit 931e0d76deb9711b70af455b3c3dbd0ce1d0a00e. Run it from a clone that contains that commit. The four service/calculation modules at the root are independent source files.

The expanded dictionary is a candidate index. Existing sentence case keys were deliberately frozen before new dictionary candidates are merged. The additional required participles come only from the existing authored `__LABCL.p` positions. Do not convert a suffix guess into a graded answer.

## Tests

Use Node 22 or newer and Java 21 for the Firestore Emulator. No production Firebase credentials are needed.

```sh
cd developer/tests
npm ci --ignore-scripts
npm test
```

`fixtures/baseline-index.html` is test input, not a second app to deploy. Embedded image/font data is stripped from this baseline fixture; the executable lesson and grading code is retained. The tests use project `demo-romanway` and the Firestore Emulator on port 8180. The SDK import URLs are substituted with the installed SDK only in test copies. Test accounts and their Google claims are emulated.

A separate browser script uses mock accounts and shared-service responses for interaction and layout checks. It does not test real OAuth or replace the emulator checks.

```sh
npx playwright install chromium
npm run test:browser
```

Set `ROMANWAY_CHROMIUM_PATH` if using a locally installed Chromium. Browser startup was blocked in the build environment, so this script remains a prepared follow-up check. Perform real Google sign-in, mobile visual checks, and teacher/student shared races on the hosted build before the classroom rollout.

The package includes the form coverage audit and required-participle list for content review. Source spellings and textbook sentences have been preserved.
