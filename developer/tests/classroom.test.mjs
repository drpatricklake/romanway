import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,updateDoc,Timestamp,serverTimestamp,deleteDoc} from 'firebase/firestore';
import '../../pilot-core.js';
const core=RomanWayPilot;
writeFileSync(new URL('./classroom-under-test.mjs',import.meta.url),readFileSync(new URL('../../firebase-classroom.js',import.meta.url),'utf8').replace("'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js'","'firebase/firestore'"));
const {createClassroom}=await import('./classroom-under-test.mjs');
const env=await initializeTestEnvironment({projectId:'demo-romanway',firestore:{host:'127.0.0.1',port:8180,rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8')}});
const owner='ZU5goPmM28X40rVridJLtZ9JcBu2';
const db=uid=>env.authenticatedContext(uid,{email:`${uid}@example.edu`,email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
const teacher=db(owner),alice=db('alice'),bob=db('bob'),pending=db('pending');
const T=createClassroom(teacher,{uid:owner},core),A=createClassroom(alice,{uid:'alice'},core),B=createClassroom(bob,{uid:'bob'},core);
const ref=(d,path)=>doc(d,'classes/pilot/'+path);
const pack=Array.from({length:8},(_,i)=>({id:'q'+i,lesson:1,q:'Question '+i,options:['Right','Wrong'],answer:0,explanation:'Explanation '+i}));
const answers=pack.map(()=>({choice:0,ms:3000}));
async function admin(fn){return env.withSecurityRulesDisabled(c=>fn(c.firestore()))}
try{
 await env.clearFirestore();
 await admin(async d=>{
  await setDoc(doc(d,'classes/pilot'),{name:'Pilot',threshold:80});
  for(const [uid,status] of [['alice','active'],['bob','active'],['pending','pending']])await setDoc(ref(d,'members/'+uid),{uid,displayName:uid,email:`${uid}@example.edu`,status});
 });
 await T.saveSettings('learning',core.defaults.learning);await T.saveSettings('circus',core.defaults.circus);await T.saveSettings('biblioteca',core.defaults.biblioteca);
 await assertFails(T.saveSettings('biblioteca',{...core.defaults.biblioteca,mode:'through',through:0}));
 await assertFails(A.saveSettings('circus',{...core.defaults.circus,stakes:false}));
 await assertFails(T.saveSettings('circus',{...core.defaults.circus,paidRounds:999}));
 await A.profile({alias:'Agricola',calling:'farmer',eligible:[1]});await B.profile({alias:'Nauta',calling:'sailor',eligible:[1]});
 await assertFails(setDoc(ref(alice,'classmates/alice'),{uid:'alice',alias:'A',calling:'farmer',eligible:[1],email:'private@example.edu',updatedAt:serverTimestamp()}));
 await assertFails(getDocs(collection(pending,'classes/pilot/classmates')));
 const aid=await T.assignment({id:'ws_w1',title:'Worksheet I',kind:'worksheet',source:'worksheet',targetId:'w1',lesson:1,due:'2026-11-21',audience:[]});
 assert.equal((await getDoc(ref(alice,'assignments/'+aid))).data().title,'Worksheet I');
 await assertFails(A.assignment({id:'cheat',title:'Cheat',kind:'worksheet',source:'worksheet',targetId:'w1',lesson:1,due:'',audience:[]}));
 const room=await T.createRoom({title:'Class round',event:'mixed',questions:pack});
 await assertFails(A.createRoom({title:'Unauthorized round',event:'mixed',questions:pack}));
 await A.joinRoom(room,'Agricola','green');await B.joinRoom(room,'Nauta','blue');
 await T.startRoom(room);const started=(await getDoc(ref(teacher,'circusRooms/'+room))).data();
 assert.equal(started.status,'running');assert.ok(started.startsAt.toMillis()>Date.now());
 await assertFails(A.answer(room,0,0,100));
 await admin(d=>updateDoc(ref(d,'circusRooms/'+room),{startsAt:Timestamp.fromMillis(Date.now()-1000)}));
 await A.answer(room,0,0,1000);await B.answer(room,0,1,1000);
 assert.equal((await A.answer(room,0,1,1000)).choice,0,'A submitted answer is immutable');
 await assertFails(updateDoc(ref(alice,`circusRooms/${room}/rounds/0/answers/alice`),{choice:1}));
 await assertFails(getDoc(ref(bob,`circusRooms/${room}/rounds/0/answers/alice`)));
 await assertFails(A.answer(room,1,0,1000));
 // Move only the emulator fixture's clock window; no live wait or production write.
 await admin(async d=>{
  await updateDoc(ref(d,'circusRooms/'+room),{startsAt:Timestamp.fromMillis(Date.now()-121000)});
  await assertFails(A.answer(room,7,0,100));
  for(let i=1;i<8;i++){
   await setDoc(ref(d,`circusRooms/${room}/rounds/${i}/answers/alice`),{uid:'alice',choice:0,ms:3000,submittedAt:Timestamp.now()});
   await setDoc(ref(d,`circusRooms/${room}/rounds/${i}/answers/bob`),{uid:'bob',choice:1,ms:3000,submittedAt:Timestamp.now()});
  }
 });

 const scoreboard=await A.roomScores(room);assert.equal(scoreboard[0].alias,'Agricola');assert.equal(scoreboard[0].correct,8);
 const live=await A.result('live',room,[],'green','Agricola');assert.equal(live.correct,8);assert.equal(live.eligible,true);
 assert.equal((await A.result('live',room,[],'green','Agricola')).replay,true);
 await T.setFaction('alice','red');
 const ghostId=await B.publishGhost({alias:'Nauta',event:'mixed',questions:pack,answers});
 await assertFails(A.result('ghost',ghostId,answers,'green','Agricola'));
 const ghost=await A.result('ghost',ghostId,answers,'red','Agricola');assert.equal(ghost.correct,8);
 await assertFails(B.result('ghost',ghostId,answers,'blue','Nauta'));
 const own=ref(alice,`circusResults/alice_ghost_${ghostId}`);await assertFails(updateDoc(own,{points:120}));
 for(let i=0;i<4;i++){
  const g=await B.publishGhost({alias:'Nauta',event:'mixed',questions:pack,answers});
  const r=await A.result('ghost',g,answers,'red','Agricola');assert.equal(r.eligible,i<3);
 }
 const day=new Date().toISOString().slice(0,10),cap=(await getDoc(ref(alice,`circusDays/alice_${day}`))).data();assert.equal(cap.count,5);
 await assertFails(setDoc(ref(alice,`circusDays/alice_${day}`),{uid:'alice',day,count:1,lastResult:'fake'}));
 await T.removeAssignment(aid);assert.equal((await getDoc(ref(alice,'assignments/'+aid))).exists(),false);
 await admin(d=>updateDoc(ref(d,'members/alice'),{status:'declined'}));
 await assertFails(A.profile({alias:'A',calling:'farmer',eligible:[1]}));await assertFails(getDocs(collection(alice,'classes/pilot/circusGhosts')));
 console.log('PASS classroom settings, assignments, pseudonymous profiles, live lobby/start/time windows/answer privacy, shared scoreboard, immutable results, ghost races, faction overrides, five-result cap, replay handling, and revoked membership.');
}finally{T.stop();A.stop();B.stop();await env.cleanup()}
