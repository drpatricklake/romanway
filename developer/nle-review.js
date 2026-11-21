/* Apply the audited original-practice catalogue; keep historical scores intact. */
(function () {
 'use strict';
 var cat=NLE_REVIEW_CATALOG, changed={}, warnings=[];
 function clone(v){return JSON.parse(JSON.stringify(v))}
 function key(q){return JSON.stringify([q.q,q.o,q.a])}
 function identity(q){return JSON.stringify([q.q,q.o.slice().sort(),q.o[q.a]])}
 function stamp(v){var s=JSON.stringify(v),a=2166136261,b=5381;
  for(var i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i)}
  return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
 }
 var originalIds={};
 NLEBANK.forEach(function(q){originalIds[identity(q)]=q.id});
 Object.keys(NLESETS).forEach(function(id){
  nleItems(NLESETS[id]).forEach(function(q,i){q.id=originalIds[identity(q)]||'set:'+id+':'+i});
 });
 function assign(q,v){['c','q','o','a','e'].forEach(function(k){q[k]=clone(v[k])})}
 cat.bank.forEach(function(c){
  var b=NLEBANK.find(function(q){return q.id===c.id});
  if(!b||key(b)!==key(c.before)){warnings.push('Bank baseline mismatch: '+c.id);return}
  var old=identity(b);
  Object.keys(NLESETS).forEach(function(id){
   nleItems(NLESETS[id]).forEach(function(q){
    if(identity(q)===old){assign(q,c.after);q.id=c.id;changed[id]=true}
   });
  });
  Object.assign(b,clone(c.after));
 });
 cat.sets.forEach(function(c){
  var s=NLESETS[c.set],q=s&&nleItems(s)[c.index];
  if(!q||key(q)!==key(c.before)){warnings.push('Set baseline mismatch: '+c.set+':'+c.index);return}
  assign(q,c.after);changed[c.set]=true;
 });
 function passage(id){var s=NLESETS[id];var p=s&&s.parts.find(function(p){return p.passage});return p&&p.passage}
 cat.passages.forEach(function(c){
  var p=passage(c.set),before=p&&(c.field==='lines'?p.lines[c.index]:p[c.field]);
  if(before!==c.before){warnings.push('Passage baseline mismatch: '+c.set+':'+c.field+':'+c.index);return}
  if(c.field==='lines')p.lines[c.index]=c.after;else p[c.field]=c.after;
  [typeof LADDER==='undefined'?[]:LADDER,typeof READINGS==='undefined'?[]:READINGS].forEach(function(rows){
   rows.forEach(function(r){if(r.id!==c.set)return;
    if(c.field==='lines')r.lines[c.index]=c.after;else r[c.field]=c.after;
   });
  });
  changed[c.set]=true;
 });
 cat.glosses.forEach(function(c){
  var p=passage(c.set);if(!p){warnings.push('Missing gloss passage: '+c.set);return}
  p.gloss=p.gloss||[];var row=p.gloss.find(function(g){return g[0]===c.line});
  if(row)row[1]=c.text;else p.gloss.push([c.line,c.text]);
  var rd=typeof readingById==='function'&&readingById(c.set);
  if(rd){rd.nleReviewGlosses=rd.nleReviewGlosses||{};rd.nleReviewGlosses[c.line]=c.text}
 });
 var finalIds={};
 NLEBANK.forEach(function(q){finalIds[identity(q)]=q.id});
 Object.keys(NLESETS).forEach(function(id){nleItems(NLESETS[id]).forEach(function(q){finalIds[identity(q)]=q.id})});
 var copy=nleCopy;nleCopy=function(q){var c=copy(q);c.id=q.id||finalIds[identity(q)];return c};
 var items=nleItems;nleItems=function(s){var a=items(s);a.forEach(function(q){if(!q.id)q.id=finalIds[identity(q)]||'question:'+stamp([q.q,q.o,q.a])});return a};
 // Papers are immutable after review; a new seed creates a new set object.
 // Cache by object so roadmap progress does not rehash every paper for every tile.
 var revisions=new WeakMap();
 function revision(set){
  var cached=revisions.get(set);if(cached)return cached;
  nleItems(set);
  var rev=stamp(set.parts.map(function(p){return [p.passage?p.passage.lines:null,p.items.map(function(q){return [q.id,q.c,q.q,q.o,q.a,q.e]})]}));
  revisions.set(set,rev);return rev;
 }
 var state=nleState;nleState=function(id){
  var st=state(id),set=NLESETS[id];if(!set)return st;
  var rev=revision(set),hasWork=st.done||Object.keys(st.ans||{}).length>0;
  var dynamic=S.nleSpec&&'nle'+S.nleSpec.n===id;
  var refresh=st.revision?st.revision!==rev:changed[id]||id==='nle14'||dynamic;
  if(hasWork&&refresh){
   S.nleReviewArchive=S.nleReviewArchive||[];
   S.nleReviewArchive.push({set:id,archivedAt:Date.now(),revision:st.revision||'legacy',state:clone(st)});
   S.nleReviewArchive=S.nleReviewArchive.slice(-100);
   st=S.nle[id]={ans:{},done:false,reviewNotice:'These practice questions have been corrected. Start a fresh attempt; your earlier recorded scores remain in your history.'};
  }
  st.revision=rev;return st;
 };
 var view=nleView;nleView=function(id,np){
  var st=nleState(id);
  return '<p class="note nle-target-help">Answer about the <u>underlined word or phrase</u>. Translate the whole sentence only when the question asks you to do so.</p>'+
   (st.reviewNotice?'<div class="callout" role="status">'+esc(st.reviewNotice)+'</div>':'')+view(id,np);
 };
 var check=ACT['nle-check'];
 ACT['nle-check']=function(t){
  var id=t.dataset.s,st=nleState(id);if(st.done||!NLESETS[id])return;
  var count=(S.attempts||[]).length;check.apply(this,arguments);
  if(S.attempts&&S.attempts.length>count){
   var a=S.attempts[S.attempts.length-1];
   a.nleVersion=cat.version;a.nleRevision=st.revision;a.questionIds=nleItems(NLESETS[id]).map(function(q){return q.id});
   persist();
  }
 };
 if(typeof readerHead==='function'){
  var head=readerHead;readerHead=function(rd){
   var h=head.apply(this,arguments),g=rd&&rd.nleReviewGlosses;
   if(g&&rdState().help)h+='<div class="callout"><b>Reading help</b><ul>'+
    Object.keys(g).sort(function(a,b){return a-b}).map(function(n){return '<li>Line '+n+': '+esc(g[n])+'</li>'}).join('')+'</ul></div>';
   return h;
  };
 }
 var style=document.createElement('style');
 style.textContent='.nleq u{text-decoration-line:underline;text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-skip-ink:auto}.nle-target-help{max-width:72ch}';
 document.head.appendChild(style);
 window.__nleReview={version:cat.version,bankCorrections:cat.bank.length,setCorrections:cat.sets.length,warnings:warnings};
})();
