import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const p=harness(process.argv[2]||'../../index.html'),m=p.model;
assert.equal(m.gridCell('l25A|0|7').prompt,'accipiō, third person plural, perfect passive');
assert.equal(m.gridCell('l25A|0|9').prompt,'accipiō, third person plural, pluperfect passive');
assert.equal(m.gridCell('l25A|1|0').prompt,'cupiō, first person singular, present active');
assert.equal(m.gridCell('l12C|0|0').prompt,'vulnerō, second person plural, present active');
assert.equal(m.gridCell('l12C|0|6').prompt,'vulnerō, second person plural, present passive');
assert.match(m.gridCell('l30S|4|7').prompt,/dubitō, perfect passive participle, masculine nominative singular/);
assert.match(m.gridCardQ('G|l25A|0|7').big,/accipiō, third person plural, perfect passive/);
assert.ok(m.GRIDS.l25A.items[0].label.includes('active and passive'),'The original full-synopsis heading must remain intact');
let cells=0,finite=0,participles=0;
for(const [id,g] of Object.entries(m.GRIDS)){
 const list=m.gridCells(id);
 if(g.kind==='list')for(const c of list){
  const bits=c.key.split('|'),row=g.items[+bits[1]].rows[+bits[2]];
  assert.equal(JSON.stringify(c.ans),JSON.stringify(row.ans),c.key+': changed answer key');
  assert.doesNotMatch(c.prompt,/active and passive|voice only|active only/i,c.key+': inherited scope in single-form prompt');
  if(/person (singular|plural), (present|imperfect|perfect|future|pluperfect)/.test(c.prompt))finite++;
  if(/participle, .*nominative singular/.test(c.prompt))participles++;
  cells++;
 }
}
assert.ok(finite>=429);assert.equal(participles,15);
for(const q of m.practiceGrid('l25A',50)){
 assert.doesNotMatch(q.prompt,/active and passive|voice only/i);
 const cell=m.gridCell(q.ck.slice(2));assert.ok(m.credit(q.grade([cell.ans[0]])[0]),'Generated key rejected');
}
const plural=m.mkB('test','1','monētis','moneo',2,'p',false);
for(const v of ["y'all warn",'y’all warn','yall warn','you all warn','all of you warn','you (pl.) warn','you (plural) warn','YOU PL WARN!'])assert.equal(plural.grade([v])[0].state,'ok',v);
for(const v of ['you warn','you (sg.) warn','they warn','you all warned','you all do not warn','you all will warn'])assert.equal(plural.grade([v])[0].state,'bad',v);
const singular=m.mkB('test','1','monēs','moneo',2,'s',false);
for(const v of ['you warn','you (sg.) warn','you (sing.) warn'])assert.equal(singular.grade([v])[0].state,'ok',v);
assert.equal(singular.grade(["y'all warn"])[0].state,'bad');
const accepted=m.engAccepted(m.VB2.amo,1,'s',true);
for(const v of ['I do not love','I do not like',"I don't like",'i dont like','I DON’T LIKE!'])assert.equal(m.gradeEnglish(v,accepted,{p:1,n:'s',verb:'amo',neg:true}).state,'ok',v);
for(const v of ['I like','I did not like','I will not like','we do not like','I dislike','I hate'])assert.equal(m.gradeEnglish(v,accepted,{p:1,n:'s',verb:'amo',neg:true}).state,'bad',v);
assert.equal(m.normEn('you all didn’t warn'),m.normEn('you (pl.) did not warn'));
p.model.state.settings.macrons='strict';assert.equal(m.credit(m.gradeLatin('accipiebantur',['accipiēbantur'])),0,'English normalization loosened Latin');
console.log(JSON.stringify({listCellsChecked:cells,synopsisFinitePrompts:finite,participlePrompts:participles,numberTenseNegationPreserved:true,contractions:true}));
