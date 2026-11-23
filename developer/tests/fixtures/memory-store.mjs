/* A small in-memory database with the transaction semantics the Atrium engine depends on:
   - every document has a version; a transaction records the version of each document it reads;
   - a commit that finds any read document changed is rejected and the transaction function runs again;
   - create() fails if the document exists at commit time;
   - reads and commits yield to other pending work, so concurrent requests genuinely interleave.
   It is not Firestore. It lets the engine's own logic be tested for duplicates, caps, and retries. */
const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const tick = () => new Promise(resolve => setImmediate(resolve));
const parent = p => p.slice(0, p.lastIndexOf('/'));

export function createMemoryStore() {
  const docs = new Map();
  const stats = { gets: 0, lists: 0, listed: 0, transactions: 0, retries: 0, commits: 0 };
  const listLog = [];
  let clock = Date.UTC(2026, 10, 20, 12, 0, 0);
  const store = {
    docs, stats, listLog, beforeCommit: null,
    seed(path, data, createMs) { docs.set(path, { data: clone(data), version: 1, createMs: createMs ?? (clock += 1000) }); },
    /* a write from "another request": bumps the version, so a transaction that read this document must retry */
    write(path, data) { const prev = docs.get(path); docs.set(path, { data: clone(data), version: (prev?.version || 0) + 1, createMs: prev?.createMs ?? (clock += 1000) }); },
    remove(path) { docs.delete(path); },
    data(path) { return clone(docs.get(path)?.data); },
    where(prefix) { return [...docs.keys()].filter(p => p.startsWith(prefix)).sort(); },
    async get(path) {
      stats.gets++; await tick();
      const d = docs.get(path);
      return d ? { exists: true, data: clone(d.data), createMs: d.createMs } : { exists: false, data: undefined, createMs: 0 };
    },
    async list(path, { where, limit = 100 } = {}) {
      stats.lists++; listLog.push(path); await tick();
      const out = [];
      for (const [p, d] of docs) {
        if (parent(p) !== path) continue;
        if (where && d.data[where[0]] !== where[2]) continue;
        out.push({ id: p.slice(path.length + 1), data: clone(d.data), createMs: d.createMs });
        if (out.length >= limit) break;
      }
      stats.listed += out.length;
      return out;
    },
    async runTransaction(fn) {
      stats.transactions++;
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map(), writes = [];
        const tx = {
          async get(p) { await tick(); const d = docs.get(p); reads.set(p, d ? d.version : 0); return d ? { exists: true, data: clone(d.data), createMs: d.createMs } : { exists: false, data: undefined, createMs: 0 }; },
          create(p, data) { writes.push(['create', p, clone(data)]); },
          set(p, data) { writes.push(['set', p, clone(data)]); },
        };
        const result = await fn(tx);
        if (store.beforeCommit) await store.beforeCommit(attempt, writes.map(w => w[1]));
        await tick();                                           // a commit takes time; other requests can land in the gap
        let conflict = false;
        for (const [p, v] of reads) if ((docs.get(p)?.version || 0) !== v) conflict = true;
        if (conflict) { stats.retries++; continue; }
        for (const [op, p] of writes) if (op === 'create' && docs.has(p)) throw new Error('ALREADY_EXISTS ' + p);
        for (const [, p, data] of writes) { const prev = docs.get(p); docs.set(p, { data, version: (prev?.version || 0) + 1, createMs: prev?.createMs ?? (clock += 1000) }); }
        stats.commits++;
        return result;
      }
      throw Object.assign(new Error('Transaction aborted: too much contention'), { contention: true });
    },
  };
  return store;
}
