import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {harness,action,lessons,plain} from './harness.mjs';
let calls=[];
const unexpected=new Proxy({}, {get(_,key){return ()=>{calls.push(String(key));throw Error('Unexpected cloud call: '+String(key));}}});
const p=harness('.vercel/output/static/index.html',{edition:'public-practice',configure(c){
 c.fetch=(...args)=>{calls.push('fetch');return Promise.reject(Error('Unexpected fetch'))};
 c.XMLHttpRequest=class{open(){calls.push('xhr')}send(){calls.push('xhr-send')}};
 c.navigator.sendBeacon=()=>{calls.push('beacon')};
 c.WebSocket=class{constructor(){calls.push('socket')}};
 c.claude={use(){calls.push('legacy-service');throw Error('Unexpected legacy service')}};
 c.RomanWayData=new Proxy({classroom:unexpected,social:unexpected},{get(t,k){return t[k]||unexpected[k]}});
}});
action(p,'local-start');
const forbidden=/Continue with Google|Join your class|classmate|Class goal this week|Have a class code|leaderboards|Share my saved match|Ask the Atrium|AI feedback on translations|your instructor can read|your instructor reads|saved for your instructor/i;
for(const screen of ['home','arena','circus','forum','domus','spectacula','virtutes','board','instructor','readings','signin']){
 p.model.view.screen=screen;p.model.render();assert.doesNotMatch(plain(p.markup()),forbidden,screen);
}
action(p,'open-domus');action(p,'dm-room',{r:'atrium'});
assert.match(plain(p.markup()),/Peer tutoring and shared messages are available in the classroom edition/);
assert.doesNotMatch(p.markup(),/data-act="at-|data-act="atr-/);
for(const key of Object.keys(p.model.actions).filter(k=>/^(teacher-|class-|board-|at-|atr-|auth-|cloud-)/.test(k))){
 await action(p,key);
}
for(const k of ['pilot-room-create','pilot-room-join','pilot-ghost-start','ar-find','ar-share','ar-ranked','ai-check','lab-ai','set-ai'])await action(p,k);
action(p,'dm-room',{r:'tablinum'});
for(const ws of p.model.worksheets){
 action(p,'ws-open',{id:ws.id});
 assert.doesNotMatch(p.markup(),/data-act="(?:ai-check|lab-ai|set-ai|at-[^"]*|atr-[^"]*)"/);
 assert.doesNotMatch(plain(p.markup()),/Save and share with my instructor|saved for your instructor/);
}
const worksheet=p.model.worksheets.find(w=>w.items.some(i=>i.f&&i.f.some(f=>f.k==='text')))||p.model.worksheets[0];
p.model.state.ws[worksheet.id]={vals:{localAudit:'Distinctive response retained only in local storage.'}};
action(p,'ws-open',{id:worksheet.id});action(p,'ws-submit',{id:worksheet.id});
assert.ok(p.model.state.ws[worksheet.id].sub);
assert.match(p.saved.get('romanway:public-practice:progress:v1'),/Distinctive response retained only in local storage/);
assert.match(plain(p.markup()),/Saved and checked/);
const all=lessons(p);assert.deepEqual(all.failures,[]);
for(const screen of all.captures)assert.ok(screen);
// Audit the displayed lesson copy, including reading/project/translation tabs.
for(const lesson of ['intro',...Array.from({length:57},(_,i)=>i+1)]){
 action(p,'open-lesson',{l:String(lesson)});
 for(const [tab] of p.model.lessonTabs()){
  action(p,'tab',{tab});assert.doesNotMatch(plain(p.markup()),forbidden,`${lesson}:${tab}`);
 }
}
// Public labels must not rewrite learner responses that contain the same words.
action(p,'open-lesson',{l:'1'});action(p,'tab',{tab:'notes'});
const literal='Submitted — Your instructor can read it. Local audit 824619.';
p.input('w-s1-conj',literal,{key:'w-s1-conj',scope:'e',ref:'notes'});p.model.render();
assert.match(p.markup(),/>Submitted — Your instructor can read it\. Local audit 824619\.<\/textarea>/);
assert.match(p.saved.get('romanway:public-practice:progress:v1'),/Local audit 824619/);
assert.deepEqual(calls,[],'Public screens, inputs and disabled actions must not call adapters');
const output=JSON.parse(readFileSync('.vercel/output/config.json'));
assert.equal(output.version,3);
assert.match(output.routes[0].headers['Content-Security-Policy'],/connect-src 'none'/);
assert.match(output.routes[0].headers['Content-Security-Policy'],/form-action 'none'/);
assert.deepEqual(readdirSync('.vercel/output/static').sort(),['404.html','app-bootstrap.js','app-config.js','index.html','local-progress.js','pilot-core.js','word-forms.js']);
assert.equal(existsSync('.vercel/output/functions'),false);
const html=readFileSync('.vercel/output/static/index.html','utf8');
assert.doesNotMatch(html,/new XMLHttpRequest|<link[^>]+https:\/\/fonts\./);
assert.match(html,/<meta http-equiv="Content-Security-Policy"/);
console.log('PASS static Public Practice: 601 lesson tabs, shared controls/actions blocked, zero network/adapter calls, no server/account files, CSP blocks connections and forms.');
