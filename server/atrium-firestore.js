/* Adapts the Admin SDK to the store interface used by server/atrium-engine.js.
   Documents' createTime is Firestore's own server-assigned time, so the engine never trusts a time written by a browser. */
const millis = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : 0;
const wrap = snap => ({exists: snap.exists, data: snap.exists ? snap.data() : undefined, createMs: snap.exists ? millis(snap.createTime) : 0});

/* Firestore aborts a transaction that keeps losing to other writers (gRPC ABORTED = 10, or an ABORTED status string). */
const contention = e => e && (e.code === 10 || e.code === 'aborted' || /ABORTED|too much contention/i.test(String(e.message || '')));

export function createFirestoreStore(db) {
  return {
    async get(path) { return wrap(await db.doc(path).get()); },
    async list(path, {where, limit = 100} = {}) {
      let q = db.collection(path);
      if (where) q = q.where(where[0], where[1], where[2]);
      const snap = await q.limit(limit).get();
      return snap.docs.map(d => ({id: d.id, data: d.data(), createMs: millis(d.createTime)}));
    },
    async runTransaction(fn) {
      try {
        return await db.runTransaction(async t => fn({
          async get(path) { return wrap(await t.get(db.doc(path))); },
          create(path, data) { t.create(db.doc(path), data); },
          set(path, data) { t.set(db.doc(path), data); },
        }));
      } catch (e) {
        if (contention(e) && !e.contention) e.contention = true;
        throw e;
      }
    },
  };
}
