# Google sign-in for Latin: The Roman Way

This package was built from the latest HTML attached in this conversation, named `src_.vercel_output_static_Latin_ Lessons I to LVII, with Appendix, the Road, and the Forum (draft) (2) (1).html`.

## What is included

- `index.html` contains the updated app homepage and lesson application.
- `firebase-auth.js` connects Google sign-in to the supplied Firebase project, `latinrw`.

The app now starts with Continue with Google. After verified sign-in it loads work stored for that Google user on this browser. Sign-out returns to the sign-in screen. Google sign-in uses a browser session, so closing the browser ends the Firebase sign-in session.

This step establishes identity. Lesson progress remains on the device. Cross-device saving, class enrollment, teacher permissions, and shared features need the separate database implementation. The former locally assigned instructor entry leads to Account status while verified instructor roles are being implemented.

## Firebase setting

Confirm Google is enabled under Authentication → Sign-in method. Under Authentication → Settings → Authorized domains, add `romanway.vercel.app`.

## Publish to the existing Vercel project

1. Unzip this package.
2. Keep a copy of the existing deployment source before replacing files.
3. Replace the HTML that serves your homepage with the included `index.html`. If your project routes the homepage to a differently named HTML file, keep that original path and filename and replace its contents with the included HTML.
4. Add `firebase-auth.js` to the website's deployed root. After deployment it must be served at `https://romanway.vercel.app/firebase-auth.js`.
5. Keep your existing artwork and other project files.
6. If Vercel is connected to GitHub, commit these changes to the production branch of the linked repository. Vercel builds a new deployment from that change. If your project has a build process, put these files into the source location that the build copies to the deployed website.
7. Wait for deployment success, then open `https://romanway.vercel.app/` in a fresh tab.

To find the connected repository, open the Roman Way project in Vercel and select Settings → Git. The repository and build settings determine exactly where the source HTML and root script belong. This package does not modify the live project by itself.

## First test

Select Continue with Google. A Google account chooser should appear. After sign-in, open Account to verify the signed-in identity. Complete an activity, refresh, and verify that work resumes for that same account on the same browser. Sign out and confirm that the login screen returns.

Google sign-in needs the deployed HTTPS website. Opening the HTML as a downloaded file is unsuitable for this authentication flow. A Vercel preview using a different hostname needs its own authorized-domain entry if you test authentication there.

If school-managed Google accounts are blocked from authorizing the app, the school administrator may need to configure its OAuth app access. The app uses basic Google identity for sign-in.

## Earlier local work

The original browser record is retained under its existing key. After sign-in, Account offers an explicit import if earlier work is present. Confirm ownership before importing. The confirmation states that the import replaces this account's current local work. The original earlier record remains available.

## Verification and remaining work

The app and Firebase module were checked with JavaScript syntax validation and a simulated authentication service. Checks covered sign-in wiring, blocked-popup feedback, account-specific local records, sign-out reload, returning-user progress, and explicit import. Existing grading, Sentence Lab behavior, and 601 lesson tabs passed the regression checks.

A real Google OAuth flow has not been tested against the live website with this update. The user or developer must complete that check after deployment. Student progress is not yet written to Firestore by these files.

The existing Claude data calls remain for features awaiting database migration. Their replacement requires the database and permission work described in the separate account-and-student-data handoff.

## References

- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/web/alt-setup
- https://vercel.com/docs/git
