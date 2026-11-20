/* Class-scoped Atrium and Arena persistence. No Claude services or credentials. */
import {doc,collection,getDoc,getDocs,setDoc,deleteDoc,writeBatch,query,where,limit,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const ROOT='classes/pilot';
const clone=x=>JSON.parse(JSON.stringify(x));
export function createSocial(db,identity){
 const uid=identity.uid,ref=p=>doc(db,p),classRef=p=>ref(`${ROOT}/${p}`);
 let teacher=false,loaded=false;
 const ensure=()=>{if(globalThis.RomanWaySocialUid!==undefined&&globalThis.RomanWaySocialUid!==uid)throw Object.assign(new Error('Account changed; reopen this view.'),{code:'auth/session-changed'});};
 async function role(){const s=await getDoc(classRef(`staff/${uid}`));teacher=uid==='ZU5goPmM28X40rVridJLtZ9JcBu2'||s.data()?.active===true;loaded=true;ensure();return teacher;}
 const snap=(value,id)=>({id,exists:!!value,data:()=>value});
 async function settings(name){const r=classRef(`socialSettings/${name}`);let s=await getDoc(r);if(name==='atrium'&&!s.exists()&&(loaded?teacher:await role())){await setDoc(r,{approve:true,ok:{},hidden:{}});s=await getDoc(r);}return s;}
 async function privateRecord(who){return getDoc(ref(`users/${who}/social/atrium`));}
 async function records(){
  if(!loaded)await role();
  const profiles=await getDocs(collection(db,`${ROOT}/atriumProfiles`));const out={};
  profiles.docs.forEach(p=>out[p.id]={...p.data(),asks:[],replies:[],thanks:[],reports:[],earned:[],hist:[]});
  const own=await privateRecord(uid);out[uid]={...(out[uid]||{}),...(own.data()||{})};
  let threads;
  if(teacher)threads=(await getDocs(collection(db,`${ROOT}/atriumQuestions`))).docs;
  else{
   const qs=await Promise.all([
    getDocs(query(collection(db,`${ROOT}/atriumQuestions`),where('readers','array-contains-any',['all',uid]))),
    getDocs(query(collection(db,`${ROOT}/atriumQuestions`),where('owner','==',uid)))
   ]);threads=[...new Map(qs.flatMap(q=>q.docs).map(d=>[d.id,d])).values()];
  }
  await Promise.all(threads.map(async t=>{
   const q=t.data(),owner=out[q.owner]||(out[q.owner]={asks:[],replies:[],thanks:[]});
   owner.asks=(owner.asks||[]).filter(a=>a.id!==q.value.id).concat([q.value]);
   owner.thanks=(owner.thanks||[]).filter(a=>a.ask!==q.value.id).concat(q.thanks||[]);
   const coll=collection(db,`${ROOT}/atriumQuestions/${t.id}/replies`);
   const replies=await getDocs(teacher?coll:query(coll,where('hidden','==',false)));
   replies.docs.forEach(r=>{const x=r.data(),person=out[x.author]||(out[x.author]={asks:[],replies:[],thanks:[]});person.replies=(person.replies||[]).filter(a=>a.id!==x.value.id).concat([x.value]);});
  }));
  if(teacher){await Promise.all(Object.keys(out).map(async who=>{let s;try{s=await privateRecord(who)}catch(e){if(e.code==='permission-denied')return;throw e}const d=s.data();if(d)out[who]={...out[who],reports:d.reports||[],hist:d.hist||[],earned:d.earned||[],asks:d.asks||out[who].asks};}));}
  ensure();return {docs:Object.entries(out).map(([id,d])=>snap(d,id))};
 }
 async function saveRecord(who,value){
  if(who!==uid)throw new Error('Only your own Atrium record can be saved.');
  const prev=(await privateRecord(uid)).data()||{},d=clone(value),batch=writeBatch(db);
  batch.set(ref(`users/${uid}/social/atrium`),d);
  const profile={};for(const k of ['name','furthest','mastered','done','patron','client','clients','declined'])if(d[k]!==undefined)profile[k]=d[k];
  batch.set(classRef(`atriumProfiles/${uid}`),profile);
  for(const a of d.asks||[]){
   const prior=(prev.asks||[]).find(x=>x.id===a.id),thanks=(d.thanks||[]).filter(x=>x.ask===a.id),oldThanks=(prev.thanks||[]).filter(x=>x.ask===a.id);
   if(JSON.stringify(a)===JSON.stringify(prior)&&JSON.stringify(thanks)===JSON.stringify(oldThanks))continue;
   const r=classRef(`atriumQuestions/${uid}_${a.id}`),existing=await getDoc(r);
   const hidden=existing.data()?.hidden||false;batch.set(r,{owner:uid,audience:a.to||'all',readers:hidden||a.deleted?[]:[a.to||'all'],deleted:!!a.deleted,hidden,value:a,thanks});
  }
  for(const r of d.replies||[]){if((prev.replies||[]).some(x=>JSON.stringify(x)===JSON.stringify(r)))continue;
   batch.set(classRef(`atriumQuestions/${r.to}_${r.ask}/replies/${uid}_${r.id}`),{author:uid,hidden:false,value:r});
  }
  await batch.commit();
 }
 async function saveSettings(name,value){
  if(name==='atrium'){
   const before=(await settings(name)).data()||{},keys=new Set([...Object.keys(before.hidden||{}),...Object.keys(value.hidden||{})]);
   const b=writeBatch(db);b.set(classRef(`socialSettings/${name}`),value);
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
   async set(value){ensure();if(path.startsWith('settings/'))return saveSettings(path.split('/')[1],value);if(path.startsWith('atrium/'))return saveRecord(path.slice(7),value);const p=translate(path);if(!p)throw new Error('Unknown shared path');return setDoc(ref(p),clone(value));},
   async delete(){const p=translate(path);if(!p)throw new Error('Unknown shared path');return deleteDoc(ref(p));}
  }},
  collection(path){return {async get(){if(path==='atrium')return records();if(path==='scores'){const s=await getDocs(collection(db,`${ROOT}/socialScores`));ensure();return {docs:s.docs.map(d=>snap(d.data(),d.id))};}if(path==='arena'){const s=await getDocs(query(collection(db,`${ROOT}/arenaGhosts`),limit(100)));ensure();return {docs:s.docs.map(d=>snap(d.data(),d.id))};}throw new Error('Unknown shared collection');}};}
 };
 return {db:bridge,user:{id:async()=>uid,canEdit:role,isOwner:async()=>uid==='ZU5goPmM28X40rVridJLtZ9JcBu2',async profiles(ids){if(!await role()){const s=await getDocs(collection(db,`${ROOT}/classmates`));ensure();return Object.fromEntries(s.docs.filter(d=>ids.includes(d.id)).map(d=>[d.id,{name:d.data().alias}]));}const s=await getDocs(collection(db,`${ROOT}/members`));ensure();return Object.fromEntries(s.docs.filter(d=>ids.includes(d.id)).map(d=>[d.id,{name:d.data().displayName}]));}},role};
}
