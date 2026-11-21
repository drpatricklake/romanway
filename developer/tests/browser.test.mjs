import http from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const mock=`
const app=window.RomanWayAuthApp;
const role=new URLSearchParams(location.search).get('role')||'student';
const uid=role==='teacher'?'ZU5goPmM28X40rVridJLtZ9JcBu2':'student';
const pack=Array.from({length:8},(_,i)=>({id:'q'+i,lesson:1,q:'The Latin word <b>amat</b> means',options:['loves','walks','sails','praises'],answer:0,explanation:'Amat is third person singular.'}));
const classInfo={threshold:80};
const row={uid:'student',displayName:'Pilot Student',email:'student@example.test',status:'active',profile:{summary:{schema:2,persona:'Agricola',completed:2,accuracy:90,circus:{training:2,shared:1},biblioteca:{completed:1},lab:{completed:1,steps:{V:{name:'Verbs',correct:1,total:1,accuracy:100}}},xp:{total:215,v:{sapientia:100,constantia:50,fortitudo:15,virtus:50,pietas:0,liberalitas:0}},denarii:38,telemetry:{startedAt:Date.now(),events:3}},updatedAt:{toMillis:()=>Date.now()}}};
const no=()=>{};
const backend={now:()=>Date.now(),syncClock:async()=>0,
 watchAssignments(cb){queueMicrotask(()=>cb([]));return no},watchClassmates(cb){queueMicrotask(()=>cb([{uid:'student',alias:'Agricola',calling:'farmer',eligible:[1]}]));return no},
 watchRooms(cb){queueMicrotask(()=>cb([]));return no},watchGhosts(cb){queueMicrotask(()=>cb([{id:'ghost1',uid:'friend',alias:'Nauta',event:'mixed',questions:pack,answers:pack.map(()=>({choice:0,ms:6000})),points:104,correct:8}]));return no},watchResults(cb){queueMicrotask(()=>cb([]));return no},
 watchRoster(cb){queueMicrotask(()=>cb([row]));return no},profile:async()=>{},saveSettings:async(section,value)=>{classInfo[section]=value;if(section==='learning')classInfo.threshold=value.threshold;app.databaseHooks.classInfo(classInfo);window.__savedSettings={section,value}},
 setFaction:async()=>{},assignment:async value=>{window.__publishedAssignment=value;window.__pilot.assignments.push(value);return value.id},removeAssignment:async()=>{},
 createRoom:async value=>{window.__createdRoom=value;return 'room1'},watchRoom(id,cb){queueMicrotask(()=>cb({id,title:'Class round',event:'mixed',questions:pack,host:uid,status:'lobby',startsAt:null}));return no},watchParticipants(id,cb){queueMicrotask(()=>cb([{uid:'student',alias:'Agricola',faction:'green'}]));return no},ownAnswers:async()=>[],startRoom:async()=>{},cancelRoom:async()=>{},roomScores:async()=>[],
 result:async(kind,sourceId,answers,faction,alias)=>({id:uid+'_'+kind+'_'+sourceId,kind,sourceId,answers,faction,alias,points:100,correct:8,eligible:true}),publishGhost:async()=>{},joinRoom:async()=>{},stop:no,
};
window.RomanWayData={classroom:backend,queue:no,flush:async()=>{},roster:async()=>[row],classCode:async()=>app.databaseHooks.code('ROMA-ABCDEFGHJK'),membership:async()=>{},student:async()=>({attempts:[],ws:{}}),stop:no};
window.RomanWayAuth={async signIn(){app.setUser({uid,name:role==='teacher'?'Pilot Teacher':'Pilot Student',email:role+'@example.test'});const s=window.__getS();for(const tab of window.__circusAPI.drillTabs(1))s.attempts.push({kind:'exercise',ref:tab[0],correct:1,total:1,t:Date.now()});app.databaseHooks.access({teacher:role==='teacher',member:role==='teacher'?null:{status:'active'},classInfo});app.databaseHooks.status('saved','Saved online');app.databaseReady();},async signOut(){app.setUser(null)}};
app.setStatus('ready','');
`;
const server=http.createServer((req,res)=>{
 const name=(req.url||'/').split('?')[0];
 if(name==='/firebase-auth.js'){res.setHeader('Content-Type','text/javascript');res.end(mock);return}
 if(name==='/'||/^\/(pilot-core|word-forms)\.js$/.test(name)){
  try{res.setHeader('Content-Type',name==='/'?'text/html':'text/javascript');res.end(readFileSync(new URL(name==='/'?'index.html':name.slice(1),root)));return}catch{}
 }
 res.statusCode=404;res.end('Not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({...(process.env.ROMANWAY_CHROMIUM_PATH?{executablePath:process.env.ROMANWAY_CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
const failures=[];
try{
 const teacher=await browser.newPage({viewport:{width:1440,height:1000}});teacher.on('pageerror',e=>failures.push(e.message));
 await teacher.goto(base+'/?role=teacher');await teacher.getByRole('button',{name:'Continue with Google'}).click();
 await teacher.getByRole('button',{name:'Teacher',exact:true}).click();
 await teacher.getByRole('heading',{name:'Instructor dashboard'}).waitFor();
 assert.ok((await teacher.locator('body').innerText()).includes('Pilot Student'));
 assert.ok((await teacher.locator('body').innerText()).includes('215'));
 await teacher.getByRole('tab',{name:'Class settings',exact:true}).click();
 await teacher.locator('#p-threshold').fill('85');await teacher.getByRole('button',{name:'Save learning settings',exact:true}).click();
 await teacher.waitForFunction(()=>window.__savedSettings?.value.threshold===85);
 await teacher.getByRole('tab',{name:'Assignments',exact:true}).click();await teacher.getByRole('button',{name:'Publish assignment',exact:true}).click();
 await teacher.waitForFunction(()=>!!window.__publishedAssignment);
 await teacher.getByRole('tab',{name:'Circus & factions',exact:true}).click();
 await teacher.getByRole('button',{name:'Open lobby',exact:true}).click();
 await teacher.getByRole('heading',{name:'The lobby',exact:true}).waitFor();
 assert.equal(await teacher.evaluate(()=>window.__createdRoom.questions.length),8);
 const student=await browser.newPage({viewport:{width:390,height:844}});student.on('pageerror',e=>failures.push(e.message));
 await student.goto(base+'/?role=student');await student.getByRole('button',{name:'Continue with Google'}).click();
 await student.locator('[data-act="open-spectacula"]').click();
 await student.locator('[data-act="open-circus"]').first().click();
 await student.getByRole('heading',{name:'Race a classmate’s ghost'}).waitFor();
 await student.getByRole('button',{name:'Race this ghost',exact:true}).click();
 await student.getByRole('heading',{name:'Ghost race',exact:true}).waitFor();
 assert.equal(await student.locator('.circus-dolphin').count(),7);
 assert.equal(await student.locator('.circus-team').count(),2);
 assert.equal(await student.locator('[role="meter"]').first().getAttribute('aria-valuenow'),'0');
 await student.screenshot({path:'/tmp/romanway-circus-phone.png',fullPage:true});
 await student.getByRole('button',{name:'loves',exact:true}).click();
 assert.ok((await student.locator('body').innerText()).includes('Correct.'));
 assert.equal(await student.locator('[data-act="pilot-race-answer"]:enabled').count(),0);
 const width=await student.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(width.body<=width.viewport+2,JSON.stringify(width));
 await student.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await student.locator('.circus-team').first().evaluate(el=>getComputedStyle(el).animationDuration),'0s');
 assert.deepEqual(failures,[]);
 console.log('PASS Chromium teacher sign-in/dashboard/settings/assignment/live-lobby interactions and phone-sized student ghost answers, overflow, and reduced-motion checks.');
}finally{await browser.close();server.close()}
