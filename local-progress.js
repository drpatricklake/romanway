/* One local learner per browser profile and site address. No account identifiers. */
(function (root) {
  'use strict';
  const key = 'romanway:public-practice:progress:v1';
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  function create(getStorage, fresh) {
    let protectedCopy = false;
    let issue = '';
    let readUnavailable = false;
    function read() {
      let raw;
      try { raw = getStorage().getItem(key); }
      catch (_) {
        readUnavailable = true;
        issue = 'Browser storage is unavailable. Your work will last only while this page stays open unless saving becomes available.';
        return fresh();
      }
      if (raw === null) { issue = ''; return fresh(); }
      try {
        const saved = JSON.parse(raw);
        if (!record(saved) || saved.schema !== 1 || !record(saved.progress)) throw Error('Invalid save');
        const next = fresh();
        for (const [name, value] of Object.entries(saved.progress)) {
          if (['user', '__proto__', 'constructor', 'prototype'].includes(name)) continue;
          if (name in next && (Array.isArray(next[name]) ? !Array.isArray(value) : record(next[name]) ? !record(value) : typeof next[name] !== typeof value)) throw Error('Invalid progress');
          next[name] = value;
        }
        next.settings = Object.assign(fresh().settings, next.settings, {aiFeedback: false});
        issue = '';
        return next;
      } catch (_) {
        protectedCopy = true;
        issue = 'The saved progress could not be opened. Its original copy has been kept. Work in this session cannot replace that copy.';
        return fresh();
      }
    }
    function save(state) {
      if (protectedCopy) return false;
      try {
        if (readUnavailable && getStorage().getItem(key) !== null) {
          protectedCopy = true;
          issue = 'A saved copy is already present. Keep this page open and reopen the app in another tab to restore that copy. This session has not replaced it.';
          return false;
        }
        readUnavailable = false;
        const progress = Object.assign({}, state);
        delete progress.user;
        getStorage().setItem(key, JSON.stringify({schema: 1, savedAt: Date.now(), progress}));
        issue = '';
        return true;
      } catch (_) {
        issue = 'Progress could not be saved in this browser. Keep this page open. Browser storage may be unavailable or full; make space or allow site storage, then retry saving.';
        return false;
      }
    }
    return {read, save, get issue() { return issue; }};
  }
  root.RomanWayLocalProgress = Object.freeze({key, create});
})(globalThis);
