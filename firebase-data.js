/* Roman Way pilot storage. Roles are enforced by firestore.rules, never by local state. */
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc,
  runTransaction, onSnapshot, serverTimestamp, query, orderBy,
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

import {createSocial} from './firebase-social.js';
import {createClassroom} from './firebase-classroom.js';

export const OWNER_UID = 'ZU5goPmM28X40rVridJLtZ9JcBu2';
const CLASS = 'pilot';
const CHUNK_SIZE = 120000;
const MAX_CHUNKS = 100;
const conflict = () => Object.assign(new Error('Another device saved newer work.'), {code:'romanway/conflict'});

export function createStore(firebaseApp, identity, hooks, runtime = {localStorage, window, crypto}) {
  const {localStorage, window, crypto}=runtime;
  const db = runtime.db || getFirestore(firebaseApp);
  const classroom=createClassroom(db,identity);
  const social=createSocial(db,identity);
  const uid = identity.uid;
  const base = `users/${uid}`;
  const metaKey = `romanway-cloud:${uid}`;
  let revision = 0, chunks = [], ready = false, stopped = false;
  let pending = null, busy = null, timer = null, classInfo = null;
  const stops = [];
  const ref = path => doc(db, path);
  const status = (phase, message='') => hooks.status(phase, message);
  const metadata = () => {
    try { return JSON.parse(localStorage.getItem(metaKey) || 'null'); } catch { return null; }
  };
  const remember = dirty => {
    localStorage.setItem(metaKey, JSON.stringify({revision, dirty}));
  };
  const cleanState = state => {
    const copy = {...state};
    delete copy.user;
    return copy;
  };
  const encode = state => JSON.stringify(cleanState(state));
  function split(text) {
    const parts = [];
    for (let at=0; at<text.length;) {
      let end=Math.min(text.length,at+CHUNK_SIZE);
      const last=text.charCodeAt(end-1);
      if (end<text.length && last>=0xd800 && last<=0xdbff) end--;
      parts.push(text.slice(at,end));at=end;
    }
    if (parts.length > MAX_CHUNKS) throw new Error('This account has more work than the pilot storage limit. Keep this browser open and contact your instructor.');
    return parts;
  }
  const chunkPath = (owner, index) => `users/${owner}/chunks/${String(index).padStart(3,'0')}`;

  async function readState(owner) {
    return runTransaction(db, async tx => {
      const manifest = await tx.get(ref(`users/${owner}/progress/current`));
      if (!manifest.exists()) return {state:null, revision:0, parts:[]};
      const m = manifest.data();
      if (!Number.isInteger(m.count) || m.count<1 || m.count>MAX_CHUNKS) throw new Error('The saved progress format is invalid.');
      const snapshots = await Promise.all(Array.from({length:m.count}, (_,i) => tx.get(ref(chunkPath(owner,i)))));
      if (snapshots.some(s => !s.exists())) throw new Error('Some saved progress is missing. Please contact your instructor.');
      const parts = snapshots.map(s => s.data().text);
      const state = JSON.parse(parts.join(''));
      delete state.user;
      return {state, revision:m.revision, parts};
    });
  }

  async function bootstrap() {
    if (uid!==OWNER_UID) return;
    const classRef = ref(`classes/${CLASS}`);
    await runTransaction(db, async tx => {
      const existing = await tx.get(classRef);
      if (!existing.exists()) tx.set(classRef, {name:'Roman Way pilot',threshold:80,createdAt:serverTimestamp()});
      tx.set(ref(`classes/${CLASS}/staff/${uid}`), {active:true,role:'instructor'});
    });
    const enrollment = ref(`classes/${CLASS}/admin/enrollment`);
    if (!(await getDoc(enrollment)).exists()) await rotateCode();
  }

  async function rotateCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = 'ROMA-' + [...bytes].map(b => alphabet[b % alphabet.length]).join('');
    await runTransaction(db, async tx => {
      const old = await tx.get(ref(`classes/${CLASS}/admin/enrollment`));
      if (old.exists()) tx.set(ref(`classes/${CLASS}/invites/${old.data().code}`), {active:false});
      tx.set(ref(`classes/${CLASS}/invites/${code}`), {active:true});
      tx.set(ref(`classes/${CLASS}/admin/enrollment`), {code});
    });
    hooks.code(code);
    return code;
  }

  async function initialize(localState, hasLocalWork) {
    status('loading', 'Connecting to your saved work…');
    await bootstrap();
    const [remote, staff, member, cls] = await Promise.all([
      readState(uid), getDoc(ref(`classes/${CLASS}/staff/${uid}`)),
      getDoc(ref(`classes/${CLASS}/members/${uid}`)), getDoc(ref(`classes/${CLASS}`)),
    ]);
    const meta = metadata();
    revision = remote.revision;
    chunks = remote.parts;
    classInfo = cls.exists() ? cls.data() : {threshold:80};
    hooks.access({teacher:uid===OWNER_UID || staff.data()?.active===true,member:member.data() || null,classInfo});
    stops.push(onSnapshot(ref(`classes/${CLASS}/members/${uid}`), snap => hooks.member(snap.data() || null), error => hooks.error(error)));
    stops.push(onSnapshot(ref(`classes/${CLASS}`), snap => {
      classInfo = snap.data() || {threshold:80};
      hooks.classInfo(classInfo);
    }, error => hooks.error(error)));
    if (uid!==OWNER_UID) stops.push(onSnapshot(ref(`classes/${CLASS}/staff/${uid}`), snap => hooks.teacher(snap.data()?.active===true), error => hooks.error(error)));
    if (remote.state && meta?.dirty && meta.revision!==revision || remote.state && !meta && hasLocalWork && encode(localState)!==encode(remote.state)) {
      ready = false;
      hooks.conflict(remote.state);
      status('conflict', 'This device and the online copy contain different work. Choose which copy to continue with.');
      return;
    }
    ready = true;
    if (remote.state && !meta?.dirty) {
      hooks.apply(remote.state);
      remember(false);
      status('saved', 'Saved online');
    } else {
      queue(localState);
      await flush();
      if(!pending){remember(false);status('saved','Saved online');}
    }
  }

  function queue(state) {
    if (!ready || stopped) return;
    const summary=hooks.summary(),text=encode(state);
    if(pending?.text===text || !pending && chunks.join('')===text)return;
    pending = {text,summary};
    try { remember(true); } catch { status('error','This browser cannot retain an offline copy. Keep this page open until it saves online.'); }
    status('saving', 'Saving…');
    clearTimeout(timer);
    timer = setTimeout(() => flush().catch(() => {}), 1200);
  }

  async function flush() {
    clearTimeout(timer);
    if (busy) { await busy; return pending ? flush() : undefined; }
    if (!ready || stopped) throw new Error('Cloud saving is not ready.');
    if (!pending) return;
    busy = (async () => {
      while (pending && !stopped) {
        if (window.navigator?.onLine===false) throw Object.assign(new Error('Offline'),{code:'unavailable'});
        const next = pending;
        const parts = split(next.text);
        const previousCount = chunks.length;
        const expected = revision;
        status('saving', 'Saving…');
        await runTransaction(db, async tx => {
          const current = await tx.get(ref(`${base}/progress/current`));
          if ((current.data()?.revision || 0)!==expected) throw conflict();
          for (let i=0; i<parts.length; i++) {
            if (parts[i]!==chunks[i]) tx.set(ref(chunkPath(uid,i)), {text:parts[i]});
          }
          for (let i=parts.length; i<previousCount; i++) tx.delete(ref(chunkPath(uid,i)));
          tx.set(ref(`${base}/progress/current`), {revision:expected+1,count:parts.length,updatedAt:serverTimestamp()});
          tx.set(ref(base), {uid,displayName:identity.name,email:identity.email,summary:next.summary,updatedAt:serverTimestamp()});
        });
        revision++;
        chunks = parts;
        if (pending===next) pending=null;
        remember(!!pending);
      }
      status('saved','Saved online');
    })();
    try { await busy; }
    catch (error) {
      if (error.code==='romanway/conflict') {
        ready=false;
        const remote=await readState(uid);
        revision=remote.revision;
        chunks=remote.parts;
        hooks.conflict(remote.state);
        status('conflict','Another device saved newer work. Choose which copy to continue with.');
      } else {
        status('error',error.code==='permission-denied' ? 'Database access was denied. Check that the supplied Firestore rules are published in latinrw.' : 'Not saved online yet. Your browser copy is retained. Check your connection, then retry.');
      }
      throw error;
    } finally { busy=null; }
  }

  async function resolve(choice) {
    const remote=await readState(uid);
    revision=remote.revision;
    chunks=remote.parts;
    pending=null;
    ready=true;
    if (choice==='online') {
      hooks.apply(remote.state || {});
      remember(false);
      status('saved','Saved online');
    } else {
      queue(hooks.snapshot());
      await flush();
    }
  }

  async function join(code) {
    code=code.trim().toUpperCase();
    if (!/^ROMA-[A-Z2-9]{10}$/.test(code)) throw new Error('Enter the class code your instructor gave you.');
    await setDoc(ref(`classes/${CLASS}/members/${uid}`), {
      uid,displayName:identity.name,email:identity.email,status:'pending',inviteCode:code,
      requestedAt:serverTimestamp(),
    });
  }

  async function roster() {
    const list=await getDocs(query(collection(db,`classes/${CLASS}/members`),orderBy('displayName')));
    return Promise.all(list.docs.map(async item => {
      const member={...item.data(),uid:item.id};
      if (member.status==='active') {
        const profile=await getDoc(ref(`users/${item.id}`));
        member.profile=profile.data() || null;
      }
      return member;
    }));
  }

  async function classCode() {
    const snap=await getDoc(ref(`classes/${CLASS}/admin/enrollment`));
    hooks.code(snap.data()?.code || '');
  }
  const onOnline=() => { if (ready) flush().catch(() => {}); };
  window.addEventListener('online',onOnline);
  return {
    initialize,queue,flush,resolve,join,roster,rotateCode,classCode,classroom,social,
    async membership(student, state) { await updateDoc(ref(`classes/${CLASS}/members/${student}`),{status:state}); },
    async threshold(value) {
      if (!Number.isInteger(value)||value<0||value>100) throw new Error('Use a percentage between 0 and 100.');
      await updateDoc(ref(`classes/${CLASS}`),{threshold:value});
    },
    async student(student) { return (await readState(student)).state; },
    stop() {classroom.stop();stopped=true;clearTimeout(timer);stops.forEach(stop=>stop());window.removeEventListener('online',onOnline);},
  };
}
