/* Shared pilot classroom features. Firestore rules enforce all instructor permissions. */
import {doc,collection,getDoc,getDocFromServer,getDocs,setDoc,updateDoc,deleteDoc,runTransaction,onSnapshot,serverTimestamp,Timestamp,query,orderBy,limit,where} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const ROOT='classes/pilot';
export function createClassroom(db,identity,core=globalThis.RomanWayPilot) {
  const uid=identity.uid,ref=path=>doc(db,`${ROOT}/${path}`);
  const stops=[];
  let offset=0;
  const now=()=>Date.now()+offset;
  const id=()=>crypto.randomUUID().replace(/-/g,'');
  const day=()=>new Date(now()).toISOString().slice(0,10);
  function watchList(path,options,callback,error) {
    const q=query(collection(db,`${ROOT}/${path}`),...options);
    const stop=onSnapshot(q,snap=>callback(snap.docs.map(d=>({id:d.id,...d.data()}))),error);
    stops.push(stop);return stop;
  }
  async function syncClock() {
    const before=Date.now();
    await setDoc(ref(`clocks/${uid}`),{at:serverTimestamp()});
    const saved=await getDocFromServer(ref(`clocks/${uid}`));
    offset=saved.data().at.toMillis()-(before+Date.now())/2;
    return offset;
  }
  async function saveSettings(section,values) {
    if(!['learning','circus','biblioteca'].includes(section))throw new Error('Unknown settings group.');
    const patch={[section]:values};
    if(section==='learning')patch.threshold=values.threshold;
    await updateDoc(doc(db,ROOT),patch);
  }
  async function assignment(value) {
    const key=value.id||id();
    await setDoc(ref(`assignments/${key}`),{...value,id:key,updatedAt:serverTimestamp(),author:uid});
    return key;
  }
  async function profile(data) {
    const alias=String(data.alias||`Charioteer ${uid.slice(-4)}`).slice(0,60);
    await setDoc(ref(`classmates/${uid}`),{uid,alias,calling:String(data.calling||''),eligible:data.eligible.slice(0,57),week:String(data.week||''),weekPractice:data.weekPractice||0,updatedAt:serverTimestamp()});
  }
  async function createRoom({title,event,questions}) {
    if(questions.length!==8)throw new Error('A live round needs eight valid questions.');
    const roomId=id();
    await setDoc(ref(`circusRooms/${roomId}`),{title:title.slice(0,100),event,questions,host:uid,status:'lobby',createdAt:serverTimestamp(),startsAt:null});
    return roomId;
  }
  async function joinRoom(roomId,alias,faction) {
    const p=ref(`circusRooms/${roomId}/participants/${uid}`);
    const current=await getDoc(p);if(current.exists())return;
    await setDoc(p,{uid,alias:alias.slice(0,60),faction,joinedAt:serverTimestamp()});
  }
  async function startRoom(roomId) {
    await syncClock();
    await runTransaction(db,async tx=>{
      const room=await tx.get(ref(`circusRooms/${roomId}`));
      if(room.data()?.status!=='lobby')throw new Error('This round has already started or closed.');
      tx.update(room.ref,{status:'running',startsAt:Timestamp.fromMillis(now()+6000)});
    });
  }
  async function answer(roomId,round,choice,ms) {
    const a=ref(`circusRooms/${roomId}/rounds/${round}/answers/${uid}`);
    const existing=await getDoc(a);if(existing.exists())return existing.data();
    const value={uid,choice,ms:Math.round(Math.max(0,Math.min(12000,ms))),submittedAt:serverTimestamp()};
    await setDoc(a,value);return value;
  }
  async function ownAnswers(roomId) {
    return Promise.all(Array.from({length:8},async(_,i)=>{
      const a=await getDoc(ref(`circusRooms/${roomId}/rounds/${i}/answers/${uid}`));
      return a.exists()?a.data():{choice:-1,ms:12000};
    }));
  }
  async function roomScores(roomId) {
    const room=(await getDoc(ref(`circusRooms/${roomId}`))).data();
    const people=await getDocs(collection(db,`${ROOT}/circusRooms/${roomId}/participants`));
    const rounds=await Promise.all(Array.from({length:8},(_,i)=>getDocs(collection(db,`${ROOT}/circusRooms/${roomId}/rounds/${i}/answers`))));
    return people.docs.map(p=>{
      const person=p.data();
      const answers=rounds.map(r=>r.docs.find(a=>a.id===p.id)?.data()||{choice:-1,ms:12000});
      return {...person,...core.score(room.questions,answers)};
    }).sort((a,b)=>b.points-a.points);
  }
  async function publishGhost(value) {
    const key=value.id||id(),r=ref(`circusGhosts/${key}`);
    if((await getDoc(r)).exists())return key;
    const score=core.score(value.questions,value.answers);
    await setDoc(r,{uid,alias:value.alias.slice(0,60),event:value.event,questions:value.questions,answers:value.answers,points:score.points,correct:score.correct,createdAt:serverTimestamp()});
    return key;
  }
  // Immutable first result per student and source. Up to five results/day count for factions.
  async function result(kind,sourceId,answers,faction,alias) {
    const resultId=`${uid}_${kind}_${sourceId}`;
    if(kind==='live')answers=await ownAnswers(sourceId);
    return runTransaction(db,async tx=>{
      const resultRef=ref(`circusResults/${resultId}`);
      const existing=await tx.get(resultRef);if(existing.exists())return {id:resultId,...existing.data(),replay:true};
      const source=await tx.get(ref(`${kind==='live'?'circusRooms':'circusGhosts'}/${sourceId}`));
      if(!source.exists())throw new Error('The race is no longer available.');
      const score=core.score(source.data().questions,answers);
      const competitionDay=day();
      const capRef=ref(`circusDays/${uid}_${competitionDay}`),cap=await tx.get(capRef);
      const count=cap.data()?.count||0,eligible=count<5;
      const value={uid,kind,sourceId,alias:alias.slice(0,60),faction,answers:answers.map(a=>({choice:a.choice,ms:Math.round(a.ms)})),points:score.points,correct:score.correct,competitionDay,eligible,createdAt:serverTimestamp()};
      tx.set(resultRef,value);
      if(eligible)tx.set(capRef,{uid,day:competitionDay,count:count+1,lastResult:resultId});
      return {id:resultId,...value};
    });
  }
  function watchRoster(callback,error) {
    let profileStops=[],members=[];const profiles=new Map();
    const emit=()=>callback(members.map(m=>({...m,profile:profiles.get(m.uid)||null})));
    const stop=onSnapshot(collection(db,`${ROOT}/members`),snap=>{
      profileStops.forEach(f=>f());profileStops=[];profiles.clear();
      members=snap.docs.map(d=>({...d.data(),uid:d.id})).sort((a,b)=>a.displayName.localeCompare(b.displayName));emit();
      members.filter(m=>m.status==='active').forEach(m=>profileStops.push(onSnapshot(doc(db,`users/${m.uid}`),p=>{profiles.set(m.uid,p.data()||null);emit()},error)));
    },error);
    const cleanup=()=>{stop();profileStops.forEach(f=>f());};stops.push(cleanup);return cleanup;
  }
  return {
    now,syncClock,saveSettings,assignment,profile,createRoom,joinRoom,startRoom,answer,ownAnswers,roomScores,publishGhost,result,watchRoster,
    removeAssignment:key=>deleteDoc(ref(`assignments/${key}`)),
    setFaction:(student,faction)=>updateDoc(ref(`members/${student}`),{faction}),
    cancelRoom:roomId=>updateDoc(ref(`circusRooms/${roomId}`),{status:'cancelled'}),
    watchRoom(roomId,callback,error){const stop=onSnapshot(ref(`circusRooms/${roomId}`),s=>callback(s.exists()?{id:s.id,...s.data()}:null),error);stops.push(stop);return stop;},
    watchParticipants(roomId,callback,error){return watchList(`circusRooms/${roomId}/participants`,[],callback,error);},
    watchAssignments:(callback,error)=>watchList('assignments',[],callback,error),
    watchClassmates:(callback,error)=>watchList('classmates',[],callback,error),
    watchRooms:(callback,error)=>watchList('circusRooms',[orderBy('createdAt','desc'),limit(20)],callback,error),
    watchGhosts:(callback,error)=>watchList('circusGhosts',[orderBy('createdAt','desc'),limit(60)],callback,error),
    watchResults(callback,error){const date=new Date(now());date.setUTCDate(date.getUTCDate()-6);return watchList('circusResults',[where('competitionDay','>=',date.toISOString().slice(0,10)),orderBy('competitionDay','desc')],callback,error);},
    stop(){stops.splice(0).forEach(stop=>stop());},
  };
}
