/* Class-scoped Atrium and Arena persistence. No Claude services or credentials. */
import {doc,collection,getDoc,getDocs,setDoc,deleteDoc,writeBatch,runTransaction,query,where,limit,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const millis=v=>(v&&typeof v.toMillis==='function')?v.toMillis():(Number(v)||0);
export function createSocial(db,identity){
 const ROOT='classes/'+(identity.classId||'pilot');
 const uid=identity.uid,ref=p=>doc(db,p),classRef=p=>ref(`${ROOT}/${p}`);
 let teacher=false,loaded=false;
 const ensure=()=>{if(globalThis.RomanWaySocialUid!==undefined&&globalThis.RomanWaySocialUid!==uid)throw Object.assign(new Error('Account changed; reopen this view.'),{code:'auth/session-changed'});};
 async function role(){const s=await getDoc(classRef(`staff/${uid}`));teacher=ROOT==='classes/pilot'&&uid==='ZU5goPmM28X40rVridJLtZ9JcBu2'||s.data()?.active===true;loaded=true;ensure();return teacher;}
 const snap=(value,id)=>({id,exists:!!value,data:()=>value});
 async function settings(name){const r=classRef(`socialSettings/${name}`);let s=await getDoc(r);if(name==='atrium'&&!s.exists()&&(loaded?teacher:await role())){await setDoc(r,{approve:true,ok:{},hidden:{}});s=await getDoc(r);}return s;}
 async function privateRecord(who){return getDoc(ref(`users/${who}/social/atrium`));}
 async function ledgerRecords(){
  if(!loaded)await role();
  const ledger=collection(db,`${ROOT}/atriumLedger`),out={};
  const led=await getDocs(teacher?ledger:query(ledger,where('uid','==',uid)));
  led.docs.forEach(e=>{const x=e.data();(out[x.uid]||(out[x.uid]={earned:[]})).earned.push({...x,t:millis(x.t)});});
  ensure();return {docs:Object.entries(out).map(([id,d])=>snap(d,id))};
 }
 async function records(){
  if(!loaded)await role();
  const threadRead=teacher?getDocs(collection(db,`${ROOT}/atriumQuestions`)).then(q=>q.docs):Promise.all([
   getDocs(query(collection(db,`${ROOT}/atriumQuestions`),where('readers','array-contains-any',['all',uid]))),
   getDocs(query(collection(db,`${ROOT}/atriumQuestions`),where('owner','==',uid)))
  ]).then(qs=>[...new Map(qs.flatMap(q=>q.docs).map(d=>[d.id,d])).values()]);
  // Independent reads share one network phase; rewards never trigger another thread scan.
  const [profiles,own,threads,led]=await Promise.all([
   getDocs(collection(db,`${ROOT}/atriumProfiles`)),privateRecord(uid),threadRead,ledgerRecords()
  ]),out={};
  profiles.docs.forEach(p=>out[p.id]={...p.data(),asks:[],replies:[],thanks:[],reports:[],earned:[],hist:[]});
  out[uid]={...(out[uid]||{}),...(own.data()||{})};
  delete out[uid].earned;
  delete out[uid].legacyEarned;
  await Promise.all(threads.map(async t=>{
   const q=t.data(),owner=out[q.owner]||(out[q.owner]={asks:[],replies:[],thanks:[]});
   owner.asks=(owner.asks||[]).filter(a=>a.id!==q.value.id).concat([q.value]);
   const coll=collection(db,`${ROOT}/atriumQuestions/${t.id}/replies`);
   const replies=await getDocs(teacher?coll:query(coll,where('hidden','==',false)));
   replies.docs.forEach(r=>{const x=r.data(),person=out[x.author]||(out[x.author]={asks:[],replies:[],thanks:[]});person.replies=(person.replies||[]).filter(a=>a.id!==x.value.id).concat([x.value]);});
   // helpful marks are documents in the thread; a thread with no replies cannot have any. Older marks kept on the question are read for display only.
   const legacy=(q.thanks||[]).map(x=>({...x,ask:q.value.id}));
   let marks=legacy;
   if(replies.size){const th=await getDocs(collection(db,`${ROOT}/atriumQuestions/${t.id}/thanks`));marks=th.docs.map(d=>({...d.data(),ask:q.value.id,helper:d.id,t:millis(d.data().t)})).concat(legacy);}
   owner.thanks=(owner.thanks||[]).filter(a=>a.ask!==q.value.id).concat(marks);
   // "I'm helping with this": only an open, undeleted question can have a live claim
   if(q.value.open&&!q.deleted&&!q.hidden){
    const cl=await getDocs(collection(db,`${ROOT}/atriumQuestions/${t.id}/claims`));
    owner.claims=(owner.claims||[]).filter(c=>c.ask!==q.value.id).concat(cl.docs.map(d=>({ask:q.value.id,uid:d.id,t:millis(d.data().createdAt)})));
   }
  }));
  if(teacher){await Promise.all(Object.keys(out).map(async who=>{let s;try{s=await privateRecord(who)}catch(e){if(e.code==='permission-denied')return;throw e}const d=s.data();if(d)out[who]={...out[who],reports:d.reports||[],hist:d.hist||[],asks:d.asks||out[who].asks};}));}
  // Never use an old private XP array; only merge the server ledger fetched above.
  led.docs.forEach(e=>{const o=out[e.id]||(out[e.id]={asks:[],replies:[],thanks:[]});o.earned=e.data().earned;});
  ensure();return {docs:Object.entries(out).map(([id,d])=>snap(d,id))};
 }
 async function saveRecord(who,value){
  if(who!==uid)throw new Error('Only your own Atrium record can be saved.');
  const prev=(await privateRecord(uid)).data()||{},d=clone(value),batch=writeBatch(db);
  // XP is written only by the server. An earlier XP array is kept, unread, under a new name so nothing is erased; the baseline tool reads it.
  if(prev.earned&&!prev.legacyEarned)d.legacyEarned=prev.earned;else if(prev.legacyEarned)d.legacyEarned=prev.legacyEarned;
  delete d.earned;
  batch.set(ref(`users/${uid}/social/atrium`),d);
  const profile={};for(const k of ['name','furthest','mastered','done','patron','client','clients','declined'])if(d[k]!==undefined)profile[k]=d[k];
  batch.set(classRef(`atriumProfiles/${uid}`),profile);
  // a lesson newly completed gets a server-time record, which lets the server tell whether it came after a tutoring reply
  await Promise.all(Object.keys(d.done||{}).map(async L=>{
   if((prev.done||{})[L]!==undefined)return;
   const c=classRef(`atriumCompletions/${uid}_${L}`);
   if(!(await getDoc(c)).exists())batch.set(c,{uid,lesson:Number(L),t:serverTimestamp()});
  }));
  for(const a of d.asks||[]){
   const prior=(prev.asks||[]).find(x=>x.id===a.id);
   if(JSON.stringify(a)===JSON.stringify(prior))continue;
   const r=classRef(`atriumQuestions/${uid}_${a.id}`),existing=await getDoc(r);
   const hidden=existing.data()?.hidden||false;
   // the question's own marks array is no longer written; marks are documents in the thanks subcollection
   batch.set(r,{owner:uid,audience:a.to||'all',readers:hidden||a.deleted?[]:[a.to||'all'],deleted:!!a.deleted,hidden,value:a,thanks:existing.data()?.thanks||[]});
  }
  for(const x of d.thanks||[]){
   if((prev.thanks||[]).some(y=>y.ask===x.ask&&y.helper===x.helper))continue;   // one mark per helper per question, ever
   batch.set(classRef(`atriumQuestions/${uid}_${x.ask}/thanks/${x.helper}`),{helper:x.helper,reply:x.reply,t:serverTimestamp()});
  }
  const oc=prev.claim||null,nc=d.claim||null,same=(a,b)=>a&&b&&a.asker===b.asker&&a.ask===b.ask;
  if(oc&&!same(oc,nc))batch.delete(classRef(`atriumQuestions/${oc.asker}_${oc.ask}/claims/${uid}`));
  if(nc&&!same(oc,nc)){
   // A closed tab can leave this create-only document behind. Reuse it without
   // refreshing its timestamp; transactions also make simultaneous tabs safe.
   const claim=classRef(`atriumQuestions/${nc.asker}_${nc.ask}/claims/${uid}`);
   await runTransaction(db,async tx=>{if(!(await tx.get(claim)).exists())tx.set(claim,{uid,createdAt:serverTimestamp()});});
  }
  for(const r of d.replies||[]){if((prev.replies||[]).some(x=>JSON.stringify(x)===JSON.stringify(r)))continue;
   batch.set(classRef(`atriumQuestions/${r.to}_${r.ask}/replies/${uid}_${r.id}`),{author:uid,hidden:false,value:r});
  }
  await batch.commit();
 }
 async function saveSettings(name,value){
  if(name==='atrium'){
   const before=(await settings(name)).data()||{},keys=new Set([...Object.keys(before.hidden||{}),...Object.keys(value.hidden||{})]);
   const keep={};for(const k of ['rewardsFrom','strict'])if(before[k]!==undefined)keep[k]=before[k];   // set by the developer, never by this screen
   const b=writeBatch(db);b.set(classRef(`socialSettings/${name}`),{...value,...keep});
   if([...keys].some(k=>!!before.hidden?.[k]!==!!value.hidden?.[k])){
    const qs=await getDocs(collection(db,`${ROOT}/atriumQuestions`));
    for(const q of qs.docs){const d=q.data(),hide=!!value.hidden?.['a:'+d.value.id];if(hide!==d.hidden)b.update(q.ref,{hidden:hide,readers:hide||d.deleted?[]:[d.audience]});
     const rs=await getDocs(collection(q.ref,'replies'));for(const r of rs.docs){const x=r.data(),h=!!value.hidden?.['r:'+x.value.id];if(h!==x.hidden)b.update(r.ref,{hidden:h});}
    }
   }
   await b.commit();
  }else await setDoc(classRef(`socialSettings/${name}`),value);
 }
 function translate(path){if(path.startsWith('scores/'))return `${ROOT}/socialScores/${path.slice(7)}`;if(path.startsWith('arena/'))return `${ROOT}/arenaGhosts/${path.slice(6)}`;if(path.startsWith('data/users/')){const p=path.split('/');return `users/${p[2]}/social/arena`;}return null;}
 const bridge={
  doc(path){return {
   async get(){ensure();if(path.startsWith('settings/')){const s=await settings(path.split('/')[1]);ensure();return snap(s.data());}if(path.startsWith('atrium/')){const s=await privateRecord(path.slice(7));ensure();return snap(s.data());}const p=translate(path);if(!p)throw new Error('Unknown shared path');const s=await getDoc(ref(p));ensure();return snap(s.data());},
   async set(value){ensure();if(path.startsWith('settings/'))return saveSettings(path.split('/')[1],value);if(path.startsWith('followups/')){const lesson=Number(path.split('/')[1]),f=ref(`${ROOT}/atriumFollowups/${uid}_${lesson}`);if((await getDoc(f)).exists())return;return setDoc(f,{uid,lesson,t:serverTimestamp()});}if(path.startsWith('atrium/'))return saveRecord(path.slice(7),value);const p=translate(path);if(!p)throw new Error('Unknown shared path');return setDoc(ref(p),clone(value));},
   async delete(){const p=translate(path);if(!p)throw new Error('Unknown shared path');return deleteDoc(ref(p));}
  }},
  collection(path){return {async get(){if(path==='atrium')return records();if(path==='atrium-ledger')return ledgerRecords();if(path==='scores'){const s=await getDocs(collection(db,`${ROOT}/socialScores`));ensure();return {docs:s.docs.map(d=>snap(d.data(),d.id))};}if(path==='arena'){const s=await getDocs(query(collection(db,`${ROOT}/arenaGhosts`),limit(100)));ensure();return {docs:s.docs.map(d=>snap(d.data(),d.id))};}throw new Error('Unknown shared collection');}};}
 };
 async function settle(hints={}){
  const token=identity.getToken?await identity.getToken():null;
  if(!token)return {awarded:[],applied:0};
  const res=await globalThis.fetch('/api/atrium-rewards',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({classId:identity.classId||'pilot',...hints})});
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw Object.assign(new Error(body.error||'Rewards could not be updated.'),{status:res.status});
  ensure();return body;
 }
 return {settle,db:bridge,user:{id:async()=>uid,canEdit:role,isOwner:async()=>uid==='ZU5goPmM28X40rVridJLtZ9JcBu2',async profiles(ids){if(!await role()){const s=await getDocs(collection(db,`${ROOT}/classmates`));ensure();return Object.fromEntries(s.docs.filter(d=>ids.includes(d.id)).map(d=>[d.id,{name:d.data().alias}]));}const s=await getDocs(collection(db,`${ROOT}/members`));ensure();return Object.fromEntries(s.docs.filter(d=>ids.includes(d.id)).map(d=>[d.id,{name:d.data().displayName}]));}},role};
}
