import assert from 'node:assert/strict';
import {harness,action,grading,sentenceLab,lessons,element} from './harness.mjs';
const p=harness(process.argv[2]),baseline=harness(process.argv[3]);
const app=p.context.RomanWayAuthApp;
let profileWrites=0,queued=0,settings=null,assigned=null;
let clock=Date.parse('2026-11-18T16:00:00Z');
const rows=[{uid:'student',displayName:'Student One',email:'one@example.test',status:'active',profile:{summary:{schema:2,persona:'Agricola',completed:1,circus:{training:1,shared:1},biblioteca:{completed:1},lab:{completed:1,steps:{V:{name:'Verbs',correct:1,total:1,accuracy:100}}},xp:{total:200,v:{sapientia:100,constantia:100}},denarii:30},updatedAt:{toMillis:()=>clock}}}];
const callbacks={};
function watch(name,value){return cb=>{callbacks[name]=cb;Promise.resolve().then(()=>cb(value));return ()=>{delete callbacks[name]}}}
const pack=Array.from({length:8},(_,i)=>({id:'q'+i,lesson:1,q:'Question '+i,options:['Correct','Incorrect'],answer:0,explanation:'Reason'}));
const backend={now:()=>clock,async syncClock(){},watchAssignments:watch('assignments',[]),watchClassmates:watch('classmates',[{uid:'student',alias:'Agricola',calling:'farmer',eligible:[1]}]),watchRooms:watch('rooms',[]),watchGhosts:watch('ghosts',[{id:'g',uid:'friend',alias:'Nauta',questions:pack,answers:pack.map(()=>({choice:0,ms:9000})),points:88,correct:8,event:'mixed'}]),watchResults:watch('results',[]),watchRoster:watch('roster',rows),async profile(){profileWrites++},async saveSettings(section,value){settings={section,value}},async assignment(value){assigned=value},async setFaction(){},async removeAssignment(){},async ownAnswers(){return []},watchRoom(id,cb){cb({id,title:'Round',status:'lobby',questions:pack});return ()=>{}},watchParticipants(id,cb){cb([{uid:'student',alias:'Agricola',faction:'green'}]);return ()=>{}},async createRoom(){return 'r'},async startRoom(){},async cancelRoom(){},async result(){},async publishGhost(){},stop(){}};
p.context.RomanWayData={classroom:backend,queue(){queued++},async flush(){},async roster(){return rows},async classCode(){app.databaseHooks.code('ROMA-ABCDEFGHJK')},async student(){return {attempts:[],ws:{},drafts:{},pilot:{events:[]}}},stop(){}};
assert.equal(p.model.state.user,null);
app.setUser({uid:'student',name:'Student One',email:'one@example.test'});
assert.ok(p.markup().includes('Connecting to your saved work'));
app.databaseHooks.access({teacher:false,member:{status:'active'},classInfo:{threshold:80}});app.databaseReady();
await new Promise(resolve=>setImmediate(resolve));
assert.ok(profileWrites>0);
assert.ok(p.context.__wordForms.audit().covered===3977);
baseline.context.RomanWayAuthApp.setUser({uid:'baseline',name:'Student One',email:'one@example.test'});
baseline.context.RomanWayAuthApp.databaseHooks.access({teacher:false,member:null,classInfo:{threshold:80}});baseline.context.RomanWayAuthApp.databaseReady();
assert.deepEqual(grading(p),grading(baseline));
assert.deepEqual(sentenceLab(p),sentenceLab(baseline));
const all=lessons(p);assert.deepEqual(all.failures,[]);
await action(p,'login-instructor');assert.equal(p.model.view.screen,'signin');assert.ok(!p.markup().includes('Instructor dashboard'));
app.databaseHooks.teacher(true);
await action(p,'login-instructor');await new Promise(resolve=>setImmediate(resolve));
assert.ok(p.markup().includes('Instructor dashboard'));
assert.ok(p.markup().includes('Student One'));assert.ok(p.markup().includes('Circus'));assert.ok(p.markup().includes('200'));
action(p,'pilot-teacher-tab',{tab:'settings'});assert.ok(p.markup().includes('Save learning settings'));
for(const [id,value] of Object.entries({'p-threshold':'85','p-macrons':'lenient','p-practiceLen':'10','p-dailyGoal':'10','p-classGoal':'500','p-newPerDay':'5','p-models':'after','p-lab':'full','p-forumMode':'coins'})){const e=element();e.value=value;p.nodes.set(id,e)}
await action(p,'pilot-save-learning');assert.equal(settings.value.threshold,85);assert.equal(settings.value.aiFeedback,false);
action(p,'pilot-teacher-tab',{tab:'assignments'});assert.ok(p.markup().includes('Publish assignment'));
// Use the first real worksheet in the generated assignment list.
const material=/id="pilot-assignment"[^>]*>\s*<option value="([^"]+)"/.exec(p.markup())[1];
for(const [id,value] of Object.entries({'pilot-assignment':material,'pilot-audience':'all','pilot-due':'2026-11-21'})){const e=element();e.value=value;p.nodes.set(id,e)}
await action(p,'pilot-assign');assert.equal(assigned.due,'2026-11-21');assert.deepEqual(JSON.parse(JSON.stringify(assigned.audience)),[]);
callbacks.assignments([assigned]);
action(p,'open-domus');assert.ok(p.markup().includes('Assigned by your instructor'));
action(p,'open-circus');assert.ok(!p.markup().includes('Live rounds with your classmates</b> <span class="chip">Coming soon'));
action(p,'login-instructor');await new Promise(resolve=>setImmediate(resolve));
action(p,'pilot-teacher-tab',{tab:'roster'});
const own=p.model.state;
await action(p,'teacher-student',{uid:'student'});assert.equal(p.model.state,own);assert.ok(p.markup().includes('Circus, Biblioteca, and virtues'));
app.databaseHooks.teacher(false);assert.equal(p.model.view.screen,'signin');assert.ok(!p.markup().includes('one@example.test</td>'));
assert.ok(queued>0);
console.log(`PASS teacher authorization, live roster, expanded progress columns, unified settings, real assignment publishing, Tablinum integration, read-only work, role revocation, and unchanged grading/Sentence Lab with ${all.captures.length} lesson tabs.`);
