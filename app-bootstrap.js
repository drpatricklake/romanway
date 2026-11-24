/* Public Practice never starts the account or database adapter. */
if (window.RomanWayConfig?.edition === 'classroom') {
  import('./firebase-auth.js').catch(() => {
    window.RomanWayAuthApp.setStatus('failed', 'The sign-in file could not load. Check your connection, then retry.');
  });
}
