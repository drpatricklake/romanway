import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {harness, action, lessons, grading, sentenceLab, games} from './harness.mjs';

const html = process.argv[2] || new URL('../../index.html',import.meta.url).pathname;
const key = 'romanway:public-practice:progress:v1';
const classroomKey = 'latin-proto-lesson1-v1:firebase:alice';
let requests = 0, legacyCalls = 0, queued = 0;
const options = {edition:'public-practice', seedStorage:{[classroomKey]:'{"notes":{"private":"classroom work"}}'}, configure(context){
  context.XMLHttpRequest=class {open(){}send(){requests++}setRequestHeader(){}};
  context.fetch=async()=>{requests++;throw Error('Unexpected service request')};
  context.claude={use(){legacyCalls++;throw Error('Unexpected legacy service')}};
  context.RomanWayData={queue(){queued++}};
}};
const p = harness(html, options);
assert.match(p.markup(), /Public Practice/);
assert.match(p.markup(), /No account or sign-in is needed/);
assert.doesNotMatch(p.markup(), /Continue with Google|register.html/);
action(p,'local-start');
assert.equal(p.model.state.user.role,'student');
assert.equal(p.model.state.user.uid,undefined);
assert.match(p.markup(), /Saved on this device/);
assert.doesNotMatch(p.markup(), />Sign out<|>Account</);
assert.equal(p.saved.get(classroomKey), options.seedStorage[classroomKey]);
assert.equal(p.saved.has('latin-proto-lesson1-v1'), false);

// Exercise the real grading, worksheet/tab renderers, and translation input/save flow.
const grades=grading(p);
assert.equal(grades.lenient,1);
assert.equal(grades.wrong,0);
const lab=sentenceLab(p);
assert.deepEqual(lab.errors,[]);
assert.equal(lab.sample.savedTranslation,true);
const all=lessons(p);
assert.deepEqual(all.failures,[]);
assert.ok(all.captures.length>=600);
p.model.state.arena = {w:0};
const match = games(p);
assert.equal(match.savedWin,true);
// The local reader preserves unrelated records and every evolving game/state field.
p.model.state.av={done:true,calling:'farmer',name:'Iulia',origin:'latin',owned:{},worn:{}};
p.model.state.notes.example='A local note';
p.model.state.drafts.example=['A local answer'];
p.model.state.attempts.push({kind:'exercise',ref:'B',correct:15,total:20,t:Date.now()});
p.model.state.settings.threshold=85;
p.model.state.settings.aiFeedback=true;
action(p,'local-save');
const saved=JSON.parse(p.saved.get(key));
assert.equal(saved.schema,1);
assert.equal(saved.progress.user,undefined);
assert.equal(saved.progress.settings.aiFeedback,false);
assert.equal(saved.progress.settings.threshold,85);
const reloaded=harness(html,{edition:'public-practice',seedStorage:Object.fromEntries(p.saved)});
action(reloaded,'local-start');
assert.equal(reloaded.model.state.notes.example,'A local note');
assert.equal(reloaded.model.state.drafts.example[0],'A local answer');
assert.equal(reloaded.model.state.av.name,'Iulia');
assert.equal(reloaded.model.state.arena.w,1);
assert.equal(reloaded.model.state.attempts.at(-1).correct,15);
assert.equal(reloaded.model.state.settings.threshold,85);
assert.equal(reloaded.model.labState(lab.sample.id).tr2,'A sample translation stored in this offline review.');
action(reloaded,'open-signin');
assert.match(reloaded.markup(), /Clearing site data/);
assert.doesNotMatch(reloaded.markup(), /Google|Join your class|register.html|Retry online/);
action(reloaded,'login-instructor');
assert.doesNotMatch(reloaded.markup(), /Instructor dashboard/);

// Quota failures are visible; in-memory work survives and retry succeeds.
let blocked=true;
const failure=harness(html,{edition:'public-practice',configure(context,nodes,saved){
 context.localStorage.setItem=(k,v)=>{if(blocked)throw Error('Quota exceeded');saved.set(k,v)};
}});
action(failure,'local-start');
assert.match(failure.markup(), /Progress could not be saved/);
failure.model.state.notes.retry='Keep this work';
blocked=false;action(failure,'local-save');
assert.match(failure.markup(), /Saved on this device/);
assert.equal(JSON.parse(failure.saved.get(key)).progress.notes.retry,'Keep this work');

// A damaged/future save must never silently disappear or be replaced with empty work.
for(const raw of ['{broken',JSON.stringify({schema:2,progress:{}}),JSON.stringify({schema:1,progress:{attempts:null}})]){
 const bad=harness(html,{edition:'public-practice',seedStorage:{[key]:raw}});
 action(bad,'local-start');
 assert.match(bad.markup(), /original copy has been kept/);
 assert.equal(bad.saved.get(key),raw);
}
const unavailable=harness(html,{edition:'public-practice',configure(context){
 Object.defineProperty(context,'localStorage',{get(){throw Error('Storage denied')}});
}});
assert.match(unavailable.markup(),/Start or resume practice/);
action(unavailable,'local-start');
assert.match(unavailable.markup(),/Progress could not be saved/);
assert.equal(unavailable.model.state.user.role,'student');

// Execute the real bootstrap in Public Practice: no Firebase import can run.
const bootstrap=readFileSync(new URL('../../app-bootstrap.js',import.meta.url),'utf8');
await vm.runInContext('(async()=>{'+bootstrap+'\n})()',p.context);
assert.equal(requests,0);
assert.equal(legacyCalls,0);
assert.equal(queued,0);
console.log(`PASS Public Practice: account-free start, ${all.captures.length} lesson tabs, ${lab.sentences} Sentence Lab sentences, local reload of work/avatar/settings, account isolation, storage failures/retry, damaged-save protection, and no identity/database adapter startup.`);
