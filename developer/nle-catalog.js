/* Template evaluated inside the application after all banks are defined. */
var NLE_REVIEW_CATALOG = (function () {
 var B={}, D={}, changes={}, setChanges={}, passages=[], glosses=[];
 function cp(v){return JSON.parse(JSON.stringify(v))}
 NLEBANK.forEach(function(q){B[q.id]=cp(q)});
 Object.keys(NLESETS).forEach(function(id){
  var s=NLESETS[id];if(!s)return;
  D[id]={parts:cp(s.parts),items:cp(nleItems(s))};
 });
 function fix(id,reason,patch,kind){
  if(!B[id])throw Error('Unknown NLE item '+id);
  var previous=changes[id], after=cp(previous?previous.after:B[id]);
  patch=patch||{};
  if(patch.correct!==undefined)after.o[after.a]=patch.correct;
  if(patch.other){var j=0;after.o=after.o.map(function(v,i){return i===after.a?v:patch.other[j++]})}
  Object.keys(patch).forEach(function(k){if(k!=='correct'&&k!=='other')after[k]=cp(patch[k])});
  changes[id]={id:id,kind:previous&&previous.kind!=='style'?previous.kind:kind||'accuracy',
    reason:(previous?previous.reason+' ':'')+reason,before:cp(B[id]),after:after};
 }
 function sty(id,q,correct,other,e){
  var p={q:q,correct:correct,other:other};if(e)p.e=e;
  fix(id,'Target a word or phrase in context; choices translate exactly the target.',p,'style');
 }
 function sf(sid,i,reason,patch){
  if(!D[sid])throw Error('Unknown NLE set '+sid);
  var k=sid+':'+i,b=cp(D[sid].items[i]),a=cp(setChanges[k]?setChanges[k].after:b);
  if(patch.correct!==undefined)a.o[a.a]=patch.correct;
  if(patch.other){var j=0;a.o=a.o.map(function(v,n){return n===a.a?v:patch.other[j++]})}
  Object.keys(patch).forEach(function(x){if(x!=='correct'&&x!=='other')a[x]=cp(patch[x])});
  setChanges[k]={set:sid,index:i,kind:'accuracy',reason:reason,before:b,after:a};
 }
 function line(sid,n,text,reason){
  var p=D[sid].parts.find(function(x){return x.passage}).passage;
  passages.push({set:sid,field:'lines',index:n-1,before:p.lines[n-1],after:text,reason:reason});
 }
 function sub(sid,text,reason){
  var p=D[sid].parts.find(function(x){return x.passage}).passage;
  passages.push({set:sid,field:'sub',before:p.sub,after:text,reason:reason});
 }
 /* NLE_PATCH_DATA */
 return {version:'2026-11-20-nle-2',bank:Object.values(changes),sets:Object.values(setChanges),passages:passages,glosses:glosses};
})();
