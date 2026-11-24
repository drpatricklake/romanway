import {createHmac, randomInt, randomUUID} from 'node:crypto';
export const OWNER='ZU5goPmM28X40rVridJLtZ9JcBu2';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const clean=(s,max=80)=>String(s||'').trim().slice(0,max);
export function studentAddress(classId,username,secret){
 if(!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(username))fail(400,'Use a pseudonym of 3–24 letters, digits, underscores or hyphens.');
 return createHmac('sha256',secret).update(classId+':'+username).digest('hex')+'@students.romanway.invalid';
}
export function createRegistration({db,auth,verifyAppCheck,secret,support={},testMode=false,now=()=>Date.now()}){
 const ref=p=>db.doc(p);
 async function read(p){return (await ref(p).get()).data();}
 async function signed(token){if(!token)fail(401,'Sign in first.');const u=await auth.verifyIdToken(token,true);if(!u.email_verified)fail(403,'Verify your email before continuing.');return u;}
 async function limited(key,max=20){
  const bucket=Math.floor(now()/3600000),id=createHmac('sha256',secret).update(key+':'+bucket).digest('hex');
  await db.runTransaction(async tx=>{const r=ref('registrationLimits/'+id),s=await tx.get(r);if((s.data()?.count||0)>=max)fail(429,'Please wait before trying again.');tx.set(r,{count:(s.data()?.count||0)+1,expiresAt:new Date(now()+7200000)});});
 }
 async function managedClass(uid,id){const c=await read('classes/'+id);if(!c||c.teacherId!==uid)fail(403,'Only the teacher who owns this class can manage it.');return c;}
 async function account(u){return await read('accounts/'+u.uid)||null;}
 async function codeClass(code){if(!/^\d{6}$/.test(code))fail(400,'Enter the six-digit class code.');const found=await read('registrationCodes/'+code);if(!found?.active)fail(400,'Check the class code with your teacher.');const c=await read('classes/'+found.classId);if(!c?.registrationOpen)fail(403,'This class is not accepting registrations.');if(testMode&&(c.teacherId!==OWNER||c.previewTest!==true))fail(403,'This preview accepts only the owner’s test classroom.');return {...c,id:found.classId};}
 async function publicGate(ip,appToken){if(!appToken)fail(403,'Student registration needs a verified app connection.');await verifyAppCheck(appToken);await limited('ip:'+ip);}
 return async function run(action,b={},token='',ip='',appToken=''){
  if(action==='config')return {enabled:true,studentRegistration:true};
  if(action==='student-address'||action==='student-register'){
   if(b.age13!==true)fail(400,'The expanded pilot is for students aged 13 or older.');
   await publicGate(ip,appToken);const c=await codeClass(clean(b.code));const username=clean(b.username).toLowerCase();const email=studentAddress(c.id,username,secret);
   if(action==='student-address')return {email};
   if(typeof b.password!=='string'||b.password.length<12||b.password.length>128)fail(400,'Use a password of 12–128 characters.');
   if(!c.educationalAuthorization?.accepted)fail(403,'Your teacher must authorize class registration first.');
   // Deterministic UID prevents duplicate registrations. Passwords are sent only to Auth.
   const uid='s_'+email.slice(0,48);let created=false;
   try{
    await auth.createUser({uid,email,password:b.password,emailVerified:true,displayName:username});created=true;
    await auth.setCustomUserClaims(uid,{romanwayStudent:true});
    const batch=db.batch();
    batch.set(ref('accounts/'+uid),{role:'student',activeClassId:c.id,managedStudent:true,createdAt:new Date(now())});
    batch.set(ref(`classes/${c.id}/members/${uid}`),{uid,displayName:username,email,status:'pending',requestedAt:new Date(now())});
    await batch.commit();
   }catch(e){if(created)await auth.deleteUser(uid).catch(()=>{});if(['auth/email-already-exists','auth/uid-already-exists'].includes(e.code))fail(409,'That username is unavailable. Sign in or choose another.');throw e;}
   return {email};
  }
  const u=await signed(token),a=await account(u);
  if(testMode&&u.uid!==OWNER){const c=a?.activeClassId?await read('classes/'+a.activeClassId):null;if(!a?.managedStudent||c?.teacherId!==OWNER||c?.previewTest!==true)fail(403,'This preview is restricted to the owner and managed test students.');}
  if(action==='session')return {account:a,support: a?.adultConfirmed===true&&['teacher','independent'].includes(a.role)?support:{}};
  await limited('uid:'+u.uid,60);
  if(action==='set-role'){
   if(a)fail(409,'This account already has a role. Contact the administrator to change it.');
   if(!['teacher','independent','student'].includes(b.role))fail(400,'Choose a role.');
   if(['student','independent'].includes(b.role)&&b.age13!==true)fail(400,'Independent registration is for learners aged 13 or older.');
   if(b.role==='teacher'&&b.adult!==true)fail(400,'Teacher and parent accounts are for adults.');
   if(b.role==='teacher'&&!['school','college','homeschool'].includes(b.setting))fail(400,'Choose your teaching setting.');
   const value={role:b.role,adultConfirmed:b.adult===true,age13:b.age13===true,setting:b.role==='teacher'?b.setting:null,approvedTeacher:u.uid===OWNER,createdAt:new Date(now())};
   await db.runTransaction(async tx=>{const r=ref('accounts/'+u.uid);if((await tx.get(r)).exists)fail(409,'Role already selected.');tx.set(r,value);});return {account:value};
  }
  if(action==='approve-teacher'){
   if(u.uid!==OWNER)fail(403,'Only the app administrator can approve pilot teachers.');
   const target=clean(b.uid,128),t=await read('accounts/'+target);if(t?.role!=='teacher')fail(400,'No teacher request with that account ID.');await ref('accounts/'+target).update({approvedTeacher:true});return {ok:true};
  }
  if(action==='create-class'){
   if(a?.role!=='teacher'||!a.approvedTeacher)fail(403,'Your pilot teacher account is awaiting approval.');
   if(b.authorization!==true)fail(400,'Confirm educational authorization before creating a class.');
   const name=clean(b.name);if(!name)fail(400,'Name your class.');
   const id=randomUUID();let code;
   for(let attempt=0;attempt<10;attempt++){
    code=String(randomInt(100000,1000000));
    try{await db.runTransaction(async tx=>{
     const counter=ref('teacherClassCounts/'+u.uid),n=await tx.get(counter),codeRef=ref('registrationCodes/'+code),exists=await tx.get(codeRef);
     if((n.data()?.count||0)>=2)fail(403,'The free pilot supports two classes. Contact the administrator for more.');if(exists.exists)fail(409,'code-collision');
     tx.set(counter,{count:(n.data()?.count||0)+1});tx.set(codeRef,{classId:id,active:true});
     tx.set(ref('classes/'+id),{name,teacherId:u.uid,threshold:80,tier:'free',...(testMode?{previewTest:true}:{}),joinCode:code,registrationOpen:true,educationalAuthorization:{accepted:true,actor:u.uid,at:new Date(now()),version:'pilot-1'}});
     tx.set(ref(`classes/${id}/staff/${u.uid}`),{active:true,role:'instructor'});tx.update(ref('accounts/'+u.uid),{activeClassId:id});
    });break;}catch(e){if(e.message==='code-collision')continue;throw e;}
   }
   if(!(await read('classes/'+id)))fail(503,'Please retry creating the class.');return {classId:id,code};
  }
  if(action==='classes'){
   const snap=await db.collection('classes').where('teacherId','==',u.uid).get();return {classes:snap.docs.map(d=>({id:d.id,name:d.data().name,code:d.data().joinCode}))};
  }
  if(action==='select-class'){
   await managedClass(u.uid,clean(b.classId));await ref('accounts/'+u.uid).update({activeClassId:b.classId});return {ok:true};
  }
  if(action==='join'){
   if(!a)fail(400,'Choose your account role first.');if(a.role==='teacher')fail(400,'Teacher accounts manage their own classes.');
   // One class per learner in the pilot; prevents silent transfer or mixing private tutoring history.
   if(a.activeClassId)fail(409,'You already belong to a class. Contact the administrator before transferring.');
   const c=await codeClass(clean(b.code));const alias=clean(b.alias,24);if(!/^[a-zA-Z0-9_-]{3,24}$/.test(alias))fail(400,'Choose a pseudonym of 3–24 letters, digits, underscores or hyphens.');
   await db.runTransaction(async tx=>{const r=ref('accounts/'+u.uid);if((await tx.get(r)).data()?.activeClassId)fail(409,'Already joined.');tx.set(ref(`classes/${c.id}/members/${u.uid}`),{uid:u.uid,displayName:alias,email:u.email,status:'pending',requestedAt:new Date(now())});tx.update(r,{activeClassId:c.id});});return {ok:true};
  }
  if(action==='roster'){
   const id=clean(b.classId);await managedClass(u.uid,id);const snap=await db.collection(`classes/${id}/members`).get();return {members:snap.docs.map(d=>({uid:d.id,alias:d.data().displayName,status:d.data().status}))};
  }
  if(action==='reset-password'){
   const classId=clean(b.classId),target=clean(b.uid,128);await managedClass(u.uid,classId);
   const member=await read(`classes/${classId}/members/${target}`),t=await read('accounts/'+target);
   if(!member||t?.activeClassId!==classId||!t.managedStudent)fail(403,'Only managed student accounts in your own class can be reset.');
   // Server-generated temporary password is returned once, never stored in Firestore.
   const password=randomUUID()+'!';await auth.updateUser(target,{password});await auth.revokeRefreshTokens(target);
   await ref('registrationAudit/'+randomUUID()).set({action:'password-reset',actor:u.uid,target,classId,at:new Date(now())});return {temporaryPassword:password};
  }
  fail(400,'Unknown account action.');
 };
}
