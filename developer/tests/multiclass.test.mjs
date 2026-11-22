import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,serverTimestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-romanway',firestore:{host:'127.0.0.1',port:8180,rules:readFileSync('../../firestore.rules','utf8')}});
const client=(uid,provider='google.com',verified=true)=>env.authenticatedContext(uid,{email:uid+'@example.org',email_verified:verified,firebase:{sign_in_provider:provider}}).firestore();
try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(const [path,data] of Object.entries({
  'classes/alpha':{teacherId:'ta',threshold:80},'classes/beta':{teacherId:'tb',threshold:80},
  'classes/alpha/staff/ta':{active:true},'classes/beta/staff/tb':{active:true},
  'accounts/sa':{role:'student',activeClassId:'alpha'},'accounts/sb':{role:'student',activeClassId:'beta'},
  'classes/alpha/members/sa':{status:'active'},'classes/beta/members/sb':{status:'active'},
  'users/sa':{summary:{}},'users/sb':{summary:{}},
  'classes/alpha/socialSettings/arena':{cp:null},'classes/beta/socialSettings/arena':{cp:null}
 }))await setDoc(doc(db,path),data);});
 const ta=client('ta'),tb=client('tb'),sa=client('sa','password');
 await assertSucceeds(getDoc(doc(ta,'users/sa')));await assertFails(getDoc(doc(tb,'users/sa')));
 await assertSucceeds(getDoc(doc(tb,'users/sb')));await assertFails(getDoc(doc(ta,'users/sb')));
 await assertSucceeds(getDoc(doc(sa,'classes/alpha/socialSettings/arena')));await assertFails(getDoc(doc(sa,'classes/beta/socialSettings/arena')));
 await assertFails(setDoc(doc(sa,'accounts/sa'),{role:'teacher',activeClassId:'beta'}));
 await assertFails(setDoc(doc(ta,'classes/beta'),{threshold:70}));
 await assertFails(setDoc(doc(sa,'classes/alpha/staff/sa'),{active:true}));
 await assertFails(getDoc(doc(client('sa','password',false),'users/sa')));
 await assertFails(setDoc(doc(client('unmanaged','password'),'users/unmanaged'),{uid:'unmanaged',email:'unmanaged@example.org',displayName:'unmanaged',summary:{},updatedAt:serverTimestamp()}));
 console.log('PASS two-class progress/shared-data isolation, managed password auth and denied role/staff escalation');
}finally{await env.cleanup();}
