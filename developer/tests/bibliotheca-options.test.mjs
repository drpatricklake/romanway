import assert from 'node:assert/strict';
import {harness,action} from './harness.mjs';

function open(edition, seedStorage) {
  const p=harness('index.html',{edition,seedStorage,configure(c){c.URLSearchParams=URLSearchParams}});
  if(edition==='public-practice')action(p,'local-start');
  else { p.model.state.user={role:'student'};p.context.RomanWayAuthApp.databaseReady(); }
  p.context.__rinfo=()=>({live:true,total:5,done:5});
  return p;
}
const p=open('public-practice');
const r=p.context.__bibRungs()[0];
action(p,'open-biblioteca');
action(p,'bb-read',{id:r.id});
const mode=(k)=>action(p,'bb-forum-task',{k});
const check=(probe,tr,mc)=>{
 assert.equal(probe.markup().includes('data-trans="1"'),tr);
 assert.equal(probe.markup().includes('data-act="nle-check"'),mc);
};
check(p,false,true);
mode('read');
check(p,false,false);
const balance=p.model.state.forum.coins;
action(p,'bb-mark-read',{id:r.id});
assert.ok(p.model.state.biblio.read[r.id]);
assert.equal(p.model.state.forum.coins,balance);
mode('tr');
check(p,true,false);
action(p,'bb-trdone',{id:r.id,need:'0'});
assert.equal(p.model.state.biblio.tr?.[r.id],undefined);
p.model.state.reads.tr[r.id]=Array(60).fill('word').join(' ');
mode('both');
check(p,true,true);
action(p,'bb-trdone',{id:r.id});
assert.ok(p.model.state.biblio.tr[r.id]);
assert.equal(p.model.state.forum.coins,balance,'Both requires both exercises');
p.model.state.nle[r.id].done=true;
p.model.render();
assert.equal(p.model.state.forum.coins,balance+3);
mode('mc');
mode('tr');
assert.equal(p.model.state.forum.coins,balance+3,'Mode switching does not pay twice');
const reopened=open('public-practice',Object.fromEntries(p.saved));
action(reopened,'open-biblioteca');
action(reopened,'bb-read',{id:r.id});
check(reopened,true,false);
assert.ok(reopened.model.state.reads.tr[r.id]);
assert.ok(reopened.model.state.nle[r.id].done);
assert.ok(reopened.model.state.biblio.read[r.id]);
const c=open('classroom');
action(c,'open-biblioteca');
for(const [task,tr,mc] of [['tr',true,false],['mc',false,true],['both',true,true]]){
 c.context.RomanWayAuthApp.databaseHooks.classInfo({threshold:80,biblioteca:{mode:'all',through:0,task,paid:5}});
 action(c,'bb-read',{id:r.id});
 check(c,tr,mc);
 assert.doesNotMatch(c.markup(),/bb-forum-task/);
 action(c,'bb-forum-task',{k:'read'});
 assert.equal(c.model.state.biblio.forumTask,undefined);
}
const gated=open('public-practice');
let coreDone=false;
gated.context.__rinfo=()=>({live:true,total:2,done:Number(coreDone)});
gated.model.LREG[r.L].progress=()=>({total:2,done:Number(coreDone),parts:[
 {kind:'notes',done:coreDone},{kind:'ladder',done:false}
]});
action(gated,'open-biblioteca');
action(gated,'bb-read',{id:r.id});
assert.equal(gated.model.state.ladderOpen,null);
coreDone=true;
action(gated,'bb-read',{id:r.id});
assert.equal(gated.model.state.ladderOpen,r.id,'A scroll must not require its own completion to open');
console.log('PASS Bibliothēca modes, local reload, exercise completion, one-time rewards and scroll access');
