import assert from 'node:assert/strict';
import {createRewardsHandler} from '../../api/atrium-rewards.js';
import {verifiedUser} from '../../server/admin.js';
import {createMemoryStore} from './fixtures/memory-store.mjs';

const NOON = Date.UTC(2026, 10, 20, 17, 0, 0);
const root = 'classes/pilot';
const LONG = 'After a preposition ask whether there is motion toward the place; if not, use the ablative.';

/* the handler is driven with plain request and response objects, a fake sign-in service, and the in-memory store */
function setup({started = true} = {}) {
  const store = createMemoryStore();
  store.seed(root, {});
  for (const u of ['alice', 'bob']) store.seed(`${root}/members/${u}`, {status: 'active'});
  store.seed(`${root}/socialSettings/atrium`, {approve: true, ok: {}, ...(started ? {rewardsFrom: NOON - 3600000} : {})});
  store.seed(`${root}/atriumProfiles/alice`, {mastered: 5, done: {1: 1, 5: 1}});
  store.seed(`${root}/atriumProfiles/bob`, {mastered: 6, done: {1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1}});
  store.seed(`${root}/atriumQuestions/alice_a1`, {owner: 'alice', audience: 'all', readers: ['all'], hidden: false, deleted: false, value: {id: 'a1', lesson: 5, open: true}, thanks: []});
  store.seed(`${root}/atriumQuestions/alice_a1/replies/bob_r`, {author: 'bob', hidden: false, value: {id: 'r', kind: 'hint', text: LONG, t: 0}}, NOON);
  const tokens = {
    alice: {uid: 'alice', email_verified: true, firebase: {sign_in_provider: 'google.com'}},
    bob: {uid: 'bob', email_verified: true, firebase: {sign_in_provider: 'google.com'}},
    unverified: {uid: 'bob', email_verified: false, firebase: {sign_in_provider: 'google.com'}},
    anon: {uid: 'bob', email_verified: true, firebase: {sign_in_provider: 'anonymous'}},
    password: {uid: 'bob', email_verified: true, firebase: {sign_in_provider: 'password'}},
    outsider: {uid: 'zed', email_verified: true, firebase: {sign_in_provider: 'google.com'}},
  };
  const auth = {async verifyIdToken(token, checkRevoked) {
    assert.equal(checkRevoked, true, 'tokens are checked for revocation');
    if (!tokens[token]) throw Object.assign(new Error('bad token'), {code: 'auth/argument-error'});
    return tokens[token];
  }};
  const accounts = new Set();                                   // password accounts that have an accounts record
  const db = {doc: p => ({async get() { return {exists: p.startsWith('accounts/') && accounts.has(p.slice(9))}; }})};
  const handler = createRewardsHandler({getServices: async () => ({db, auth}), makeStore: () => store, ownerUid: 'owner'});
  return {store, accounts, handler};
}
function call(handler, {method = 'POST', token = 'bob', body = {}, origin, host = 'romanway.vercel.app'} = {}) {
  return new Promise(resolve => {
    const headers = {host, ...(origin ? {origin} : {}), ...(token ? {authorization: 'Bearer ' + token} : {})};
    const res = {headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(obj) { resolve({code: this.code, body: obj, headers: this.headers}); }};
    handler({method, headers, body}, res);
  });
}

// 1. a signed-in classmate settles a real reply: 200 and the award is recorded for the token's user
{
  const {handler, store} = setup();
  const r = await call(handler, {body: {questions: ['alice_a1']}});
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.awarded, [{kind: 'reply', xp: 5}]);
  assert.ok(store.data(`${root}/atriumLedger/bob|r:alice_a1:r`));
  assert.equal(r.headers['Cache-Control'], 'no-store');
}

// 1b. until the instructor has set the start time, the route answers but pays nothing
{
  const {handler, store} = setup({started: false});
  const r = await call(handler, {body: {questions: ['alice_a1']}});
  assert.equal(r.code, 200);
  assert.equal(r.body.notStarted, true);
  assert.equal(store.where(`${root}/atriumLedger/`).length, 0);
}

// 2. it works while new registration is closed: the route never reads the registration switch
{
  const saved = process.env.ROMANWAY_REGISTRATION_ENABLED;
  for (const value of [undefined, 'false', 'true']) {
    if (value === undefined) delete process.env.ROMANWAY_REGISTRATION_ENABLED; else process.env.ROMANWAY_REGISTRATION_ENABLED = value;
    const {handler} = setup();
    assert.equal((await call(handler, {body: {questions: ['alice_a1']}})).code, 200, `registration switch ${value}: existing students still earn`);
  }
  if (saved === undefined) delete process.env.ROMANWAY_REGISTRATION_ENABLED; else process.env.ROMANWAY_REGISTRATION_ENABLED = saved;
}

// 3. the caller is the token's user: a uid, class total, or award in the body is never used
{
  const {handler, store} = setup();
  const r = await call(handler, {token: 'alice', body: {uid: 'bob', questions: ['alice_a1'], awards: [{uid: 'alice', xp: 9999}], xp: 9999}});
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.awarded, [], 'alice is asked about bob\'s reply, so alice is told nothing about it');
  assert.ok(store.data(`${root}/atriumLedger/bob|r:alice_a1:r`), 'the award goes to the helper because the stored reply says so');
  assert.equal(store.where(`${root}/atriumLedger/alice|`).length, 0, 'nothing is written for alice');
}

// 4. authentication and the origin check
{
  const {handler, accounts} = setup();
  assert.equal((await call(handler, {token: null})).code, 401);
  assert.equal((await call(handler, {token: 'garbage'})).code, 401);
  assert.equal((await call(handler, {token: 'unverified'})).code, 403, 'an unverified email is refused');
  assert.equal((await call(handler, {token: 'anon'})).code, 403, 'only Google or password sign-in is accepted');
  assert.equal((await call(handler, {token: 'password'})).code, 403, 'a password sign-in needs an accounts record');
  accounts.add('bob');
  assert.equal((await call(handler, {token: 'password', body: {}})).code, 200);
  assert.equal((await call(handler, {origin: 'https://evil.example'})).code, 403);
  assert.equal((await call(handler, {origin: 'https://romanway.vercel.app'})).code, 200);
  assert.equal((await call(handler, {method: 'GET'})).code, 405);
}

// 5. a signed-in person who is not in the class is refused, and so are oversized and malformed requests
{
  const {handler} = setup();
  assert.equal((await call(handler, {token: 'outsider'})).code, 403);
  assert.equal((await call(handler, {body: {questions: ['a/b']}})).code, 400);
  assert.equal((await call(handler, {body: {classId: 'Pilot'}})).code, 400);
  assert.equal((await call(handler, {body: {questions: Array(11).fill('x')}})).code, 400);
  assert.equal((await call(handler, {body: {pad: 'x'.repeat(5000)}})).code, 413);
}

// 6. an internal failure returns a generic message, never a stack trace or document contents
{
  const handler = createRewardsHandler({getServices: async () => { throw new Error('secret path /projects/latinrw/credentials'); }});
  const r = await call(handler, {});
  assert.equal(r.code, 500);
  assert.ok(!JSON.stringify(r.body).includes('secret') && !JSON.stringify(r.body).includes('latinrw'));
}

// 7. the sign-in verification matches the Firestore rule it mirrors
{
  const db = {doc: () => ({async get() { return {exists: false}; }})};
  const auth = {async verifyIdToken() { return {uid: 'x', email_verified: true, firebase: {sign_in_provider: 'google.com'}}; }};
  assert.equal((await verifiedUser(db, auth, 't')).uid, 'x');
}

console.log('PASS atrium-route: Google sign-in checked like the rules, works while registration is closed, ignores any identity or amount in the body, refuses outsiders, and never leaks internals.');
