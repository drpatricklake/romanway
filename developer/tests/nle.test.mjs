import assert from 'node:assert/strict';
import {harness,action} from './harness.mjs';
const p=harness(process.argv[2]||'../../index.html'),m=p.model,S=m.state;
const pack=v=>JSON.parse(JSON.stringify(v));
const cat=m.NLE_REVIEW_CATALOG;
assert.ok(cat&&cat.bank.length>250,'Complete editorial catalogue missing');
assert.deepEqual(pack(p.context.__nleReview.warnings),[],'A baseline edit failed to apply');
const fixedIds=Object.keys(m.NLESETS);
assert.equal(m.NLEBANK.length,1631);
assert.equal(new Set(Array.from(m.NLEBANK,q=>q.id)).size,1631);
let choices=0,fixed=0;
for(const q of m.NLEBANK){
 assert.equal(q.o.length,4,q.id);
 assert.equal(new Set(Array.from(q.o)).size,4,q.id+': duplicate options');
 assert.ok(Number.isInteger(q.a)&&q.a>=0&&q.a<4,q.id);
 assert.ok(q.q&&q.e,q.id+': missing question/explanation');
 assert.equal((q.q.match(/<u>/g)||[]).length,(q.q.match(/<\/u>/g)||[]).length,q.id+': unbalanced target');
 const id='__nle_test_one';
 m.NLESETS[id]={title:q.id,intro:'',parts:[{h:'',items:[m.nleCopy(q)]}]};
 S.nle=S.nle||{};S.nle[id]={ans:{},done:false};
 m.nleView(id);
 for(let i=0;i<4;i++){m.nleState(id).ans[0]=i;assert.equal(m.nleScore(id).ok,i===q.a?1:0,q.id+': option '+i);choices++}
}
delete m.NLESETS.__nle_test_one;delete S.nle.__nle_test_one;
for(const id of fixedIds){
 S.nle[id]={ans:{},done:false};m.nleView(id);
 const qs=m.nleItems(m.NLESETS[id]),st=m.nleState(id);
 qs.forEach((q,i)=>{assert.ok(q.id,id+': missing stable ID');st.ans[i]=q.a});
 assert.equal(m.nleScore(id).ok,qs.length,id+': correct displayed choices rejected');fixed+=qs.length;
}
assert.equal(choices,6524);assert.equal(fixed,722);
const rid='__nle_rotate';
m.NLESETS[rid]={title:'Rotation regression',intro:'',rotate:true,parts:[{h:'',items:[{c:'vocab',q:'puella <u>portat</u>.',o:['carries','carried','will carry','was carrying'],a:0,e:'Present tense.'}]}]};
S.nle[rid]={ans:{},done:false};
const rendered=m.nleView(rid);
assert.ok(rendered.includes('B) carries'),'Choices must rotate before first rendering');
m.nleState(rid).ans[0]=1;assert.equal(m.nleScore(rid).ok,1);
delete m.NLESETS[rid];delete S.nle[rid];
for(const c of cat.bank){
 const q=m.NLEBANK.find(q=>q.id===c.id);
 for(const k of ['q','o','a','e','L'])assert.deepEqual(pack(q[k]),pack(c.after[k]),c.id+': '+k);
 assert.equal(m.nleCopy(q).id,q.id,'Copy lost stable bank ID');
}
const bank=id=>m.NLEBANK.find(q=>q.id===id);
assert.match(bank('r146').q,/victūrōs/);assert.doesNotMatch(bank('r146').q,/vīctūrōs/);
assert.match(bank('r86').q+' '+bank('r86').o.join(' '),/[Tt]ria mīlia/);
assert.match(bank('x102').e,/masculine/i);
assert.match(bank('b293').q,/Romans were defeated by the Gauls/);
assert.equal(bank('b293').o[bank('b293').a],'390 B.C.');
for(const id of ['r383','r409'])assert.match(bank(id).o[bank(id).a],/dative/i);
for(const id of ['r226','r228']){
 assert.ok(!m.nleElig(43,false).some(q=>q.id===id),id+' introduced too early');
 assert.ok(m.nleElig(44,false).some(q=>q.id===id));
}
m.nleWarmSet(11);
for(const q of m.nleItems(m.NLESETS.nle11))if(['grammar','vocab'].includes(q.c))assert.match(q.q,/<u>/,'XI missing target');
for(const c of cat.passages){
 const part=m.NLESETS[c.set].parts.find(p=>p.passage);
 const actual=c.field==='lines'?part.passage.lines[c.index]:part.passage[c.field];
 assert.equal(actual,c.after,c.set+': passage edit');
 const rd=m.readingById(c.set);
 if(rd&&c.field==='lines')assert.equal(rd.lines[c.index],c.after,c.set+': reader mismatch');
}
for(const kind of ['mix','cat','exam']){
 const sp={n:57,seed:570011,kind,cat:'grammar'};
 const a=m.nleDynBuild(sp),b=m.nleDynBuild(sp);
 assert.deepEqual(pack(a),pack(b),'Seeded practice changed for '+kind);
 for(const q of m.nleItems(a))assert.ok(q.o[q.a]&&q.id);
}
S.attempts=[{kind:'nle',ref:'nle11',correct:2,total:8,t:100}];
S.nle.nle11={ans:{0:0},done:true};
const archiveBefore=(S.nleReviewArchive||[]).length;
const refreshed=m.nleState('nle11');
assert.equal(refreshed.done,false);assert.equal(Object.keys(refreshed.ans).length,0);
assert.equal(S.nleReviewArchive.length,archiveBefore+1);
assert.equal(S.attempts[0].correct,2,'Historical score rewritten');
S.nle.rs32={ans:{0:0},done:true};
assert.equal(m.nleState('rs32').done,true,'Unchanged reading completion lost');
S.nle.nle11={ans:{0:0},done:true,revision:'obsolete'};
assert.equal(m.nleState('nle11').done,false,'Stale revision not reopened');
const st=m.nleState('nle11'),qs=m.nleItems(m.NLESETS.nle11);
qs.forEach((q,i)=>st.ans[i]=q.a);
action(p,'nle-check',{s:'nle11'});
const count=S.attempts.length,last=S.attempts[count-1];
assert.equal(last.correct,qs.length);assert.equal(last.total,qs.length);
assert.equal(last.nleVersion,cat.version);assert.equal(last.nleRevision,st.revision);
assert.deepEqual(pack(last.questionIds),Array.from(qs,q=>q.id));
action(p,'nle-check',{s:'nle11'});assert.equal(S.attempts.length,count,'Double submission recorded');
console.log(JSON.stringify({bank:m.NLEBANK.length,choiceChecks:choices,fixedQuestions:fixed,fixedSets:fixedIds.length,bankCorrections:cat.bank.length,setCorrections:cat.sets.length,passageEdits:cat.passages.length,glosses:cat.glosses.length,rotation:true,migration:true,version:cat.version}));
