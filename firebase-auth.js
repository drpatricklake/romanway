/* Public Firebase web configuration. Google identity with private Firestore progress and pilot class access. */
const firebaseConfig = {
  apiKey: 'AIzaSyBN4RTbuNrMKL0DKhXTPTgJOEc2CtSq-mo',
  authDomain: 'latinrw.firebaseapp.com',
  projectId: 'latinrw',
  storageBucket: 'latinrw.firebasestorage.app',
  messagingSenderId: '203865387786',
  appId: '1:203865387786:web:46e90247f170fc848680f3',
};
const app = window.RomanWayAuthApp;
let auth;
let signInWithPopup;
let firebaseSignOut;
let GoogleAuthProvider;
let busy = false;
let settled = false;

function friendlyError(error) {
  const messages = {
    'auth/unauthorized-domain': 'Add romanway.vercel.app under Firebase Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'Enable Google under Firebase Authentication → Sign-in method.',
    'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.',
    'auth/popup-closed-by-user': 'The Google window was closed. Select Continue with Google to try again.',
    'auth/cancelled-popup-request': 'A Google sign-in window is already open. Complete sign-in there or try again.',
    'auth/network-request-failed': 'Google sign-in could not connect. Check your connection and the school network’s access settings.',
    'auth/web-storage-unsupported': 'This browser is blocking the storage needed for sign-in. Allow site storage and try again.',
    'auth/user-disabled': 'This account has been disabled. Contact your instructor.',
  };
  return messages[error?.code] || 'Sign-in could not complete. Please try again.';
}

window.RomanWayAuth = {
  async signIn() {
    if (!auth || busy) return;
    busy = true;
    app.setStatus('busy', '');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      await signInWithPopup(auth, provider);
      app.setStatus('ready', '');
    } catch (error) {
      app.setStatus('ready', friendlyError(error));
    } finally {
      busy = false;
    }
  },
  async signOut() {
    if (!auth || busy) return;
    busy = true;
    app.setStatus('busy', '');
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      app.setStatus('ready', friendlyError(error));
    } finally {
      busy = false;
    }
  },
};

const startupTimeout = window.setTimeout(() => {
  if (!settled) app.setStatus('failed', 'The Google sign-in service is taking longer to load. Check your connection and try again.');
}, 20000);

try {
  const [sdk, authSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js'),
  ]);
  const firebaseApp = sdk.initializeApp(firebaseConfig);
  auth = authSdk.getAuth(firebaseApp);
  signInWithPopup = authSdk.signInWithPopup;
  firebaseSignOut = authSdk.signOut;
  GoogleAuthProvider = authSdk.GoogleAuthProvider;
  await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
  authSdk.onAuthStateChanged(auth, async user => {
    settled = true;
    window.clearTimeout(startupTimeout);
    const identity=user ? {uid:user.uid, name:user.displayName || 'Student', email:user.email || ''} : null;
    app.setUser(identity);
    if (identity && !window.RomanWayData) {
      const databaseTimeout=window.setTimeout(()=>app.databaseSlow(),20000);
      try {
        const {createStore}=await import('./firebase-data.js');
        const store=createStore(firebaseApp,identity,app.databaseHooks);
        window.RomanWayData=store;
        await store.initialize(app.snapshot(),app.hasLocalWork());
        app.databaseReady();
      } catch (error) { app.databaseError(error); }
      finally {window.clearTimeout(databaseTimeout);}
    }
  }, error => {
    settled = true;
    window.clearTimeout(startupTimeout);
    app.setStatus('failed', friendlyError(error));
  });
} catch (error) {
  settled = true;
  window.clearTimeout(startupTimeout);
  app.setStatus('failed', 'The Google sign-in service could not load. Check your connection and allow this site’s Google/Firebase services, then retry.');
}
