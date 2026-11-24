// Atrium rules and adapter, against the Firestore emulator.
// Run through `npm test` (it starts the emulator).
import {readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, collection, query, where, serverTimestamp} from 'firebase/firestore';

writeFileSync(new URL('./social-under-test.mjs', import.meta.url), readFileSync(new URL('../../firebase-social.js', import.meta.url), 'utf8').replace("'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js'", "'firebase/firestore'"));
const {createSocial} = await import('./social-under-test.mjs');
const env = await initializeTestEnvironment({projectId: 'demo-romanway', firestore: {host: '127.0.0.1', port: 8180, rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')}});
const OWNER = 'ZU5goPmM28X40rVridJLtZ9JcBu2';
const as = uid => env.authenticatedContext(uid, {email: uid + '@example.test', email_verified: true, firebase: {sign_in_provider: 'google.com'}}).firestore();
const t = as(OWNER), a = as('alice'), b = as('bob'), c = as('carol');
const P = 'classes/pilot';
const admin = fn => env.withSecurityRulesDisabled(async x => fn(x.firestore()));
const prof = (mastered, extra = {}) => ({name: 'x', furthest: mastered, mastered, done: Object.fromEntries(Array.from({length: mastered}, (_, i) => [String(i + 1), 1])), clients: [], client: null, patron: null, declined: [], ...extra});

async function reset() {
  await env.clearFirestore();
  await admin(async d => {
    for (const u of ['alice', 'bob', 'carol']) await setDoc(doc(d, `${P}/members/${u}`), {status: 'active', uid: u, displayName: u});
    await setDoc(doc(d, `${P}/atriumProfiles/alice`), prof(5));
    await setDoc(doc(d, `${P}/atriumProfiles/bob`), prof(5));
    await setDoc(doc(d, `${P}/atriumProfiles/carol`), prof(2));
    await setDoc(doc(d, `${P}/socialSettings/atrium`), {approve: true, ok: {}, hidden: {}});
    await setDoc(doc(d, `${P}/atriumQuestions/alice_a1`), {owner: 'alice', audience: 'all', readers: ['all'], hidden: false, deleted: false, thanks: [], value: {id: 'a1', lesson: 5, q: 'Why?', open: true, to: 'all'}});
    await setDoc(doc(d, `${P}/atriumQuestions/alice_a1/replies/bob_r1`), {author: 'bob', hidden: false, value: {id: 'r1', ask: 'a1', to: 'alice', kind: 'hint', text: 'Look at the case after the preposition and ask about motion.', t: 1}});
  });
}
const setStrict = on => admin(d => setDoc(doc(d, `${P}/socialSettings/atrium`), {approve: true, ok: {}, hidden: {}, strict: on}));

try {
  /* ---- 1. the ledger is server-only: no student writes or deletes; each student reads only their own; the instructor reads all ---- */
  await reset();
  await admin(async d => {
    await setDoc(doc(d, `${P}/atriumLedger/alice|r:q:r`), {uid: 'alice', why: 'reply', v: 'lib', xp: 5, day: '2026-11-20', t: 1});
    await setDoc(doc(d, `${P}/atriumLedger/bob|r:q:r`), {uid: 'bob', why: 'reply', v: 'lib', xp: 5, day: '2026-11-20', t: 1});
  });
  await assertFails(setDoc(doc(a, `${P}/atriumLedger/alice|forged`), {uid: 'alice', why: 'reply', v: 'lib', xp: 999, day: 'x', t: 1}));
  await assertFails(updateDoc(doc(a, `${P}/atriumLedger/alice|r:q:r`), {xp: 999}));
  await assertFails(deleteDoc(doc(a, `${P}/atriumLedger/alice|r:q:r`)));
  await assertFails(setDoc(doc(t, `${P}/atriumLedger/x`), {uid: 'alice', xp: 1}));                        // not even the instructor's page
  assert.equal((await getDocs(query(collection(a, `${P}/atriumLedger`), where('uid', '==', 'alice')))).size, 1);
  await assertFails(getDocs(query(collection(a, `${P}/atriumLedger`), where('uid', '==', 'bob'))));
  assert.equal((await getDocs(collection(t, `${P}/atriumLedger`))).size, 2);
  for (const closed of ['atriumDaily/bob_2026-11-20', 'atriumRate/bob']) {                              // server bookkeeping is closed to every page
    await assertFails(getDoc(doc(b, `${P}/${closed}`)));
    await assertFails(setDoc(doc(b, `${P}/${closed}`), {replies: 0, xp: 0}));
  }

  /* ---- 2. the transition: tabs on the previous page keep working until strict is switched on ---- */
  await reset();
  const rec = {name: 'x', earned: [{k: 'rp:1', xp: 5}], asks: [], replies: [], thanks: []};
  await assertSucceeds(setDoc(doc(a, 'users/alice/social/atrium'), rec));                               // update period: the server ignores it
  const withThanks = {owner: 'alice', audience: 'all', readers: ['all'], hidden: false, deleted: false, thanks: [{helper: 'bob', reply: 'r1', ask: 'a1', t: 1}], value: {id: 'a1', lesson: 5, q: 'Why?', open: true, to: 'all'}};
  await assertSucceeds(setDoc(doc(a, `${P}/atriumQuestions/alice_a1`), withThanks));                    // the old marks array can still be written
  await setStrict(true);
  await assertFails(setDoc(doc(a, 'users/alice/social/atrium'), rec));                                 // strict: no XP in the private record
  await assertSucceeds(setDoc(doc(a, 'users/alice/social/atrium'), {name: 'x', legacyEarned: rec.earned, asks: [], replies: [], thanks: []}));
  await assertFails(setDoc(doc(a, `${P}/atriumQuestions/alice_a1`), {...withThanks, thanks: []}));       // strict: the marks array is frozen
  await assertSucceeds(setDoc(doc(a, `${P}/atriumQuestions/alice_a1`), {...withThanks, value: {...withThanks.value, open: false}}));   // other edits still work

  /* ---- 3. helpful marks are documents: owner only, once, server-stamped, on a reply that exists, never removable ---- */
  await reset();
  const mark = (reply = 'r1', helper = 'bob', extra = {}) => ({helper, reply, t: serverTimestamp(), ...extra});
  await assertFails(setDoc(doc(c, `${P}/atriumQuestions/alice_a1/thanks/bob`), mark()));                // not the asker
  await assertFails(setDoc(doc(b, `${P}/atriumQuestions/alice_a1/thanks/bob`), mark()));                // the helper cannot thank themselves
  await assertFails(setDoc(doc(a, `${P}/atriumQuestions/alice_a1/thanks/bob`), mark('nope')));          // no such reply
  await assertFails(setDoc(doc(a, `${P}/atriumQuestions/alice_a1/thanks/carol`), mark('r1', 'carol')));   // carol never replied
  await assertFails(setDoc(doc(a, `${P}/atriumQuestions/alice_a1/thanks/bob`), {helper: 'bob', reply: 'r1', t: 12345}));   // a client-chosen time
  await assertFails(setDoc(doc(a, `${P}/atriumQuestions/alice_a1/thanks/bob`), mark('r1', 'bob', {xp: 999})));              // an extra field
  await assertSucceeds(setDoc(doc(a, `${P}/atriumQuestions/alice_a1/thanks/bob`), mark()));
  await assertFails(setDoc(doc(a, `${P}/atriumQuestions/alice_a1/thanks/bob`), mark()));               // a second write is an update, which is refused
  await assertFails(deleteDoc(doc(a, `${P}/atriumQuestions/alice_a1/thanks/bob`)));                    // and it cannot be removed and redone
  assert.equal((await getDocs(collection(c, `${P}/atriumQuestions/alice_a1/thanks`))).size, 1);         // classmates can read it

  /* ---- 4. claims: a helper who has mastered the lesson, on a question they can read, stamped with server time ---- */
  await reset();
  const claim = uid => ({uid, createdAt: serverTimestamp()});
  await assertFails(setDoc(doc(c, `${P}/atriumQuestions/alice_a1/claims/carol`), claim('carol')));      // carol has mastered Lesson II, not V
  await assertFails(setDoc(doc(a, `${P}/atriumQuestions/alice_a1/claims/alice`), claim('alice')));      // not on one's own question
  await assertFails(setDoc(doc(b, `${P}/atriumQuestions/alice_a1/claims/carol`), claim('carol')));      // not in someone else's name
  await assertFails(setDoc(doc(b, `${P}/atriumQuestions/alice_a1/claims/bob`), {uid: 'bob', createdAt: 1}));   // a client-chosen time
  await assertSucceeds(setDoc(doc(b, `${P}/atriumQuestions/alice_a1/claims/bob`), claim('bob')));
  assert.equal((await getDocs(collection(c, `${P}/atriumQuestions/alice_a1/claims`))).size, 1, 'classmates can see who is helping');
  await assertFails(deleteDoc(doc(c, `${P}/atriumQuestions/alice_a1/claims/bob`)));                     // only the claimant removes a claim
  await assertSucceeds(deleteDoc(doc(b, `${P}/atriumQuestions/alice_a1/claims/bob`)));
  await admin(d => setDoc(doc(d, `${P}/atriumQuestions/alice_p1`), {owner: 'alice', audience: 'bob', readers: ['bob'], hidden: false, deleted: false, thanks: [], value: {id: 'p1', lesson: 5, q: 'Private', open: true, to: 'bob'}}));
  await assertFails(setDoc(doc(c, `${P}/atriumQuestions/alice_p1/claims/carol`), claim('carol')));      // a private question is not visible to carol
  await assertFails(getDocs(collection(c, `${P}/atriumQuestions/alice_p1/claims`)));

  /* ---- 5. completions and follow-ups: the student's own, once, stamped with server time; absent documents can be checked ---- */
  await reset();
  for (const col of ['atriumCompletions', 'atriumFollowups']) {
    const mine = {uid: 'alice', lesson: 3, t: serverTimestamp()};
    assert.equal((await getDoc(doc(a, `${P}/${col}/alice_3`))).exists(), false, 'checking for a missing record is allowed');
    await assertFails(setDoc(doc(b, `${P}/${col}/alice_3`), mine));                                      // not in someone else's name
    await assertFails(setDoc(doc(a, `${P}/${col}/alice_3`), {...mine, t: 777}));                         // a client-chosen time
    await assertFails(setDoc(doc(a, `${P}/${col}/alice_99`), {uid: 'alice', lesson: 99, t: serverTimestamp()}));
    await assertFails(setDoc(doc(a, `${P}/${col}/alice_4`), mine));                                      // the id must match the lesson
    await assertSucceeds(setDoc(doc(a, `${P}/${col}/alice_3`), mine));
    await assertFails(setDoc(doc(a, `${P}/${col}/alice_3`), {uid: 'alice', lesson: 3, t: serverTimestamp()}));   // not rewritable
    await assertFails(getDoc(doc(b, `${P}/${col}/alice_3`)));                                            // others cannot read it
    assert.equal((await getDoc(doc(t, `${P}/${col}/alice_3`))).exists(), true, 'the instructor can');
    await reset();
  }

  /* ---- 6. server-managed settings: the instructor's screen can never add, change, or remove them ---- */
  await reset();
  await assertSucceeds(setDoc(doc(t, `${P}/socialSettings/atrium`), {approve: false, ok: {alice: 'bob'}, hidden: {'a:x': true}}));
  await assertFails(setDoc(doc(t, `${P}/socialSettings/atrium`), {approve: true, ok: {}, hidden: {}, rewardsFrom: 1}));   // cannot start rewards
  await admin(d => setDoc(doc(d, `${P}/socialSettings/atrium`), {approve: true, ok: {}, hidden: {}, rewardsFrom: 1700000000000, strict: true}));
  await assertSucceeds(setDoc(doc(t, `${P}/socialSettings/atrium`), {approve: false, ok: {}, hidden: {}, rewardsFrom: 1700000000000, strict: true}));   // an ordinary save that keeps them
  await assertFails(setDoc(doc(t, `${P}/socialSettings/atrium`), {approve: false, ok: {}, hidden: {}, rewardsFrom: 5, strict: true}));                  // changed
  await assertFails(setDoc(doc(t, `${P}/socialSettings/atrium`), {approve: false, ok: {}, hidden: {}, rewardsFrom: 1700000000000}));                     // strict removed
  await assertFails(setDoc(doc(t, `${P}/socialSettings/atrium`), {approve: false, ok: {}, hidden: {}}));                                                  // both removed
  await assertFails(setDoc(doc(a, `${P}/socialSettings/atrium`), {approve: false, ok: {}, hidden: {}, rewardsFrom: 1700000000000, strict: true}));       // a student
  await assertFails(deleteDoc(doc(t, `${P}/socialSettings/atrium`)));                                                                                    // deleting would reset the start time
  await assertFails(setDoc(doc(t, `${P}/socialSettings/arena`), {a: 1, b: 2, c: 3, d: 4}));                                                              // other settings keep their limit

  /* ---- 7. the adapter: old XP is not an XP source but is preserved; settings survive; records are written once ---- */
  await reset();
  await admin(async d => {
    await setDoc(doc(d, 'users/alice/social/atrium'), {name: 'x', earned: [{k: 'legacy:lib', v: 'lib', xp: 340, why: 'legacy'}], asks: [], replies: [], thanks: [], done: {'1': 1}});
    await setDoc(doc(d, `${P}/atriumLedger/alice|baseline:lib`), {uid: 'alice', why: 'baseline', v: 'lib', xp: 40, day: 'baseline', t: 1});
    await setDoc(doc(d, `${P}/socialSettings/atrium`), {approve: true, ok: {}, hidden: {}, rewardsFrom: 1700000000000, strict: false});
  });
  const A = createSocial(a, {uid: 'alice'}), T = createSocial(t, {uid: OWNER});
  const mineRecord = async () => (await A.db.collection('atrium').get()).docs.find(d => d.id === 'alice').data();
  const before = await mineRecord();
  assert.equal(before.earned.reduce((s, e) => s + e.xp, 0), 40, 'only the reviewed ledger entry counts, not the 340 in the private record');
  await A.db.doc('atrium/alice').set({...before, name: 'Agricola', done: {'1': 1, '2': 2}, asks: [], replies: [], thanks: [], reports: [], hist: [], clients: []});
  const raw = (await getDoc(doc(a, 'users/alice/social/atrium'))).data();
  assert.equal(raw.earned, undefined, 'no XP is stored in the private record any more');
  assert.equal(raw.legacyEarned[0].xp, 340, 'but the old record is kept, not erased');
  assert.equal((await getDoc(doc(a, `${P}/atriumCompletions/alice_2`))).exists(), true, 'a newly completed lesson gets a server-time record');
  assert.equal((await getDoc(doc(a, `${P}/atriumCompletions/alice_1`))).exists(), false, 'a lesson already completed does not');
  await A.db.doc('atrium/alice').set({...before, done: {'1': 1, '2': 2}, asks: [], replies: [], thanks: [], reports: [], hist: [], clients: []});   // saving again does not collide
  await T.db.doc('settings/atrium').set({approve: false, ok: {}, hidden: {}});                                       // the instructor's screen omits the managed fields
  const settings = (await getDoc(doc(t, `${P}/socialSettings/atrium`))).data();
  assert.equal(settings.rewardsFrom, 1700000000000); assert.equal(settings.strict, false); assert.equal(settings.approve, false);
  await A.db.doc('followups/2').set({}); await A.db.doc('followups/2').set({});                                     // the second is skipped, not an error
  assert.equal((await getDocs(query(collection(a, `${P}/atriumFollowups`), where('uid', '==', 'alice')))).size, 1);   // a rule is not a filter, so the query states whose records it wants

  // Reopen a form after a tab left an orphaned create-only claim behind.
  await reset();
  const B=createSocial(b,{uid:'bob'});
  const record={...prof(5),asks:[],replies:[],thanks:[],reports:[],hist:[],claim:null};
  await admin(async d=>{
    await setDoc(doc(d,'users/bob/social/atrium'),record);
    await setDoc(doc(d,`${P}/atriumQuestions/alice_a1/claims/bob`),{uid:'bob',createdAt:serverTimestamp()});
  });
  const claimRef=doc(b,`${P}/atriumQuestions/alice_a1/claims/bob`);
  const originalTime=(await getDoc(claimRef)).data().createdAt.toMillis();
  const reopen={...record,claim:{asker:'alice',ask:'a1',t:Date.now()}};
  await B.db.doc('atrium/bob').set(reopen);
  assert.equal((await getDoc(claimRef)).data().createdAt.toMillis(),originalTime);
  await B.db.doc('atrium/bob').set({...reopen,claim:null,replies:[{id:'retry_reply',ask:'a1',to:'alice',kind:'hint',text:'Look at the preposition and decide whether it describes motion or location.',t:Date.now()}]});
  assert.equal((await getDoc(doc(b,`${P}/atriumQuestions/alice_a1/replies/bob_retry_reply`))).exists(),true);
  assert.equal((await getDoc(claimRef)).exists(),false);
  await Promise.all([B.db.doc('atrium/bob').set(reopen),B.db.doc('atrium/bob').set(reopen)]);
  assert.equal((await getDoc(claimRef)).exists(),true);

  // A shared reply can outlive an older private snapshot (another tab or legacy data).
  await reset();
  const savedRef=doc(b,`${P}/atriumQuestions/alice_a1/replies/bob_r1`);
  const savedReply=(await getDoc(savedRef)).data();
  await assertSucceeds(setDoc(savedRef,savedReply));
  for(const change of [{value:{...savedReply.value,text:'Altered reply text'}},{value:{...savedReply.value,t:999}},{hidden:true},{author:'carol'}]){
    await assertFails(setDoc(savedRef,{...savedReply,...change}));
  }
  await assertFails(setDoc(doc(c,`${P}/atriumQuestions/alice_a1/replies/bob_r1`),savedReply));
  const stale={...prof(5),asks:[],replies:[],thanks:[],reports:[],hist:[],claim:null};
  await admin(d=>setDoc(doc(d,'users/bob/social/atrium'),stale));
  const fromShared=(await B.db.collection('atrium').get()).docs.find(x=>x.id==='bob').data();
  await B.db.doc('atrium/bob').set({...fromShared,claim:{asker:'alice',ask:'a1',t:Date.now()}});
  await B.db.doc('atrium/bob').set({...fromShared,claim:null,replies:fromShared.replies.concat([{id:'new_reply',ask:'a1',to:'alice',kind:'rule',text:'The preposition takes the accusative when it expresses motion toward a place.',t:Date.now()}])});

  assert.deepEqual((await getDoc(savedRef)).data(),savedReply,'Retry preserves the original reply');
  console.log('PASS atrium-rules: server-only ledger, the strict transition switch, marks, claims, completions, follow-ups, protected settings, and the migration display policy.');
} finally { await env.cleanup(); }
