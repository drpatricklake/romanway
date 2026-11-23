/* Firebase Admin services for server routes. Uses the same keyless Vercel-to-Google identity as api/registration.js
   (prepareGoogleIdentity), so no service-account key is stored. It deliberately does NOT read the registration on/off switch:
   existing Google sign-in students must keep working while new registration is closed. */
import {getApps, initializeApp, applicationDefault, cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {prepareGoogleIdentity} from './vercel-google.js';

let services;
export async function adminServices() {
  await prepareGoogleIdentity();
  if (!services) {
    const app = getApps()[0] || initializeApp({
      credential: process.env.FIREBASE_ADMIN_CREDENTIALS ? cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS)) : applicationDefault(),
      projectId: 'latinrw',
    });
    services = {db: getFirestore(app), auth: getAuth(app)};
  }
  return services;
}

/* Same checks as Firestore's signedIn() rule: a verified, unrevoked Firebase ID token from Google sign-in, or from a
   password account that has an accounts record. */
export async function verifiedUser(db, auth, token) {
  if (!token) throw Object.assign(new Error('Sign in first.'), {status: 401});
  const user = await auth.verifyIdToken(token, true);
  if (!user.email_verified) throw Object.assign(new Error('Verify your email before continuing.'), {status: 403});
  const provider = user.firebase?.sign_in_provider;
  if (provider !== 'google.com') {
    if (provider !== 'password' || !(await db.doc('accounts/' + user.uid).get()).exists) throw Object.assign(new Error('This sign-in method is not allowed.'), {status: 403});
  }
  return user;
}
