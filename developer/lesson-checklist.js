// The original completion checks supply the groups, counts, and states.
function lessonPartStatus(done, kind, refs, count) {
  return {done:!!done,kind:kind,refs:refs,count:count};
}
function summarizeLessonParts(parts, total) {
  return {done:parts.filter(function(p){return typeof p==='object'?p.done:p}).length,total:total,parts:parts};
}
(function(){
  function lessonTasks(n) {
    var previous=V.lesson,tabs;
    try { V.lesson=n; tabs=lessonTabs(); } finally { V.lesson=previous; }
    var drills=n==='intro'?[]:window.__circusAPI.drillTabs(n);
    var byTab=Object.create(null);
    tabs.concat(drills).forEach(function(t){byTab[t[0]]=t});
    var drillIds=new Set(drills.map(function(t){return t[0]}));
    var progress;
    if(n==='intro'){
      var checks=notesStatus('intro');
      progress={done:checks.d,total:checks.t,parts:[lessonPartStatus(checks.d===checks.t,'notes',['notes'])]};
    }else{ progress=lessonProgress(n); }
    var used=new Set();
    function link(id,detail,complete,worksheet){
      if(!byTab[id])return worksheet?{id:'ws',label:worksheet.title,detail:detail,complete:complete,worksheet:worksheet.id}:null;
      used.add(id);
      return {id:id,label:worksheet?worksheet.title||byTab[id][1]:byTab[id][1],detail:detail,complete:complete,circus:drillIds.has(id),worksheet:worksheet&&worksheet.id};
    }
    function count(done,total,unit){return done+' / '+total+' '+unit}
    function build(p){
      var links=[],title;
      switch(p.kind){
        case 'notes':{
          var note=notesStatus(n==='intro'?'intro':'l'+n);
          links.push(link('notes',count(note.d,note.t,'quick checks'),p.done));
          break;
        }
        case 'vocab':{
          var v=vocabStatus(n),rule=S.settings.vocabRule;
          links.push(link('vocab',(rule?'Quiz or type at least 8 words at '+T()+'% or higher':'Complete a vocabulary activity')+(v.acc==null?'':' · '+v.acc+'% overall'),p.done));
          break;
        }
        case 'lab':{
          var lab=p.refs[0],finished=labDone(lab);
          var id=byTab.xA?'xA':lab==='A'?'xA':Object.keys(byTab).find(function(key){return byTab[key][1]==='Exercise A'});
          links.push(link(id,count(finished,p.count,'sentences required'),p.done));
          break;
        }
        case 'group':
          p.refs.forEach(function(spec){
            var id=spec[0],type=spec[1];
            if(type==='drill'){
              var stat=exStatus(id),needs=stat.s==='required';
              var detail=(needs?'Follow-up practice at ':'Score ')+T()+'% or higher';
              if(stat.acc!=null)detail+=' · First attempt '+stat.acc+'%';
              if(stat.s==='cleared')detail+=' · Cleared by practice';
              links.push(link(id,detail,stat.s==='mastered'||stat.s==='cleared'));
            }else{
              var set=setProgress(id),required=p.count||set.t;
              links.push(link(id,count(set.n,required,'responses required'),set.n>=required));
            }
          });
          break;
        case 'worksheets':
          title=p.refs.length>1?'Submit one of these worksheets':'Submit the worksheet';
          p.refs.forEach(function(id){
            var w=WS.find(function(w){return w.id===id});
            var tab='l'+n+id.slice(('w'+n).length);
            var complete=!!(S.ws[id]&&S.ws[id].sub);
            links.push(byTab[tab]?link(tab,'Submit the activity',complete):link('ws','Submit the activity',complete,w));
          });
          break;
        case 'translationSets':
          title='Reach halfway in any 3 translation sets';
          p.refs.forEach(function(id){
            var set=setProgress(id),min=Math.ceil(set.t/2);
            links.push(link(id,count(set.n,min,'responses required'),set.n>=min));
          });
          title+=' ('+setsDone()+' qualifying)';
          break;
        case 'ladder':{
          var ids=nleLadderFor(n), finished=ids.filter(function(id){return nleState(id).done}).length;
          links.push({id:'ladder',label:'Reading ladder',detail:count(finished,ids.length,'readings complete'),complete:p.done,biblioteca:true});
          break;
        }
        default:{
          var names={reading:'Save the translation',nle:'Finish the NLE practice',ladder:'Finish the reading ladder',activity:'Submit the activity'};
          links.push(link(p.refs[0],names[p.kind]||'',p.done));
        }
      }
      links=links.filter(Boolean);
      return {done:p.done,title:title||(!links.length?'Complete the lesson activity':links.map(function(l){return l.label}).join(' and ')),links:links};
    }
    var required=(progress.parts||[]).filter(function(p){return typeof p==='object'}).map(build);
    var optional=tabs.filter(function(t){return !used.has(t[0])}).map(function(t){
      return link(t[0],'',/^(done|mastered|cleared)$/.test(t[2]&&t[2].s));
    });
    var xp=window.__lessonXPItems(n==='intro'?0:n);
    var denarii=window.__lessonDenarii(n,progress.done,progress.total);
    var nextGroup=required.find(function(group){return !group.done&&group.links.some(function(l){return !l.complete})});
    var next=nextGroup&&nextGroup.links.find(function(l){return !l.complete});
    return {n:n,done:progress.done,total:progress.total,required:required,optional:optional,xp:xp,denarii:denarii,next:next};
  }
  window.__lessonChecklist=lessonTasks;
  function action(task,n,label,css) {
    return '<button class="'+css+'" data-act="lesson-checklist-go" data-l="'+n+'" data-tab="'+esc(task.id)+'"'+(task.circus?' data-circus="1"':'')+
      (task.biblioteca?' data-biblioteca="1"':'')+(task.worksheet?' data-ws="'+esc(task.worksheet)+'"':'')+'>'+esc(label)+'</button>';
  }
  ACT['lesson-checklist-go']=function(t){
    var data=t.dataset;
    if(data.ws){ACT['dm-ws']({dataset:{l:data.l}});ACT['ws-open']({dataset:{id:data.ws}});return}
    if(data.biblioteca){ACT['open-biblioteca']();return}
    if(data.circus){ACT['cir-train']({dataset:{n:data.l,tab:data.tab}});return}
    if(V.screen!=='lesson'||String(V.lesson)!==data.l)ACT['open-lesson']({dataset:{l:data.l}});
    ACT.tab({dataset:{tab:data.tab}});
  };
  function checklist(m){
    var earned=0,left=0;
    m.xp.forEach(function(i){if(i.done)earned+=i.xp;else left+=i.xp});
    return '<section class="panel lc" aria-label="Lesson completion and rewards"><h2>Lesson checklist</h2>'+
      '<p>'+m.done+' of '+m.total+' '+(m.n==='intro'?'quick checks':'required parts')+' complete</p>'+
      '<progress value="'+m.done+'" max="'+Math.max(1,m.total)+'" aria-label="Lesson completion"></progress>'+
      '<p class="note">'+earned+' XP earned · '+left+' XP available'+(m.denarii?' · '+m.denarii.earned+' denarii credited · '+m.denarii.remaining+' denarii available'+(m.denarii.pending?' · '+m.denarii.pending+' denarii pending':''):'')+'</p>'+
      (m.denarii&&m.denarii.gate?'<p class="note">Gate bonus · '+m.denarii.gate.reward+' denarii '+(m.denarii.gate.earned?'credited':m.denarii.gate.pending?'pending':'available')+'</p>':'')+
      '<details><summary>Required activities</summary><ol>'+m.required.map(function(g){
        return '<li><b>'+esc(g.title)+'</b> <span class="note">'+(g.done?'Complete':'To do')+'</span><ul>'+g.links.map(function(l){
          return '<li>'+action(l,m.n,l.label,'link')+' <span class="note">'+esc(l.detail)+'</span></li>';
        }).join('')+'</ul></li>';
      }).join('')+'</ol></details>'+
      (m.optional.length?'<details><summary>Optional for lesson completion</summary><ul>'+m.optional.map(function(l){return '<li>'+action(l,m.n,l.label,'link')+'</li>'}).join('')+'</ul></details>':'')+
      '<details><summary>XP by activity</summary><ul>'+m.xp.map(function(i){
        return '<li>'+esc(i.name)+' · '+i.xp+' XP '+(i.done?'earned':'available')+'</li>';
      }).join('')+'</ul></details></section>';
  }
  var previousLesson=screenLesson;
  screenLesson=function(){
    var html=previousLesson();
    if(V.screen!=='lesson')return html;
    var m=lessonTasks(V.lesson);
    return m.total?html.replace('<div class="tabs" role="tablist">',checklist(m)+'<div class="tabs" role="tablist">'):html;
  };
  function secondaryHomeButtons(html){
    return html.replace(/<button class="(btn(?: [^"]*)?)"/g,function(markup,classes){
      return /(?:^| )ghost(?: |$)/.test(classes)?markup:'<button class="'+classes+' ghost"';
    });
  }
  var previousHome=screenHome;
  screenHome=function(){
    var html=previousHome();
    if(!S.user||S.user.role!=='student')return html;
    if(!S.av||!S.av.done){
      // Keep the existing setup flow and give it the first position until a persona is saved.
      var setup=html.match(/<section class="panel avbar cta">[\s\S]*?<\/section>/);
      if(!setup)return html;
      return secondaryHomeButtons(html.replace(setup[0],'')).replace(/(<main\b[^>]*>)/,function(main){
        return main+setup[0];
      });
    }
    var open=Object.keys(S.opened||{}).map(Number).filter(function(n){return n>=1&&n<=57}).sort(function(a,b){return b-a});
    var n=open.find(function(n){var p=lessonProgress(n);return p.done<p.total});
    if(!n)for(var i=1;i<=57;i++){var p=lessonProgress(i);if(p.done<p.total){n=i;break}}
    if(!n)return html;
    var m=lessonTasks(n),t=m.next;
    if(!t)return html;
    var reward=m.xp.find(function(i){return i.tab===t.id&&!i.done});
    var button='Continue: '+t.label+(reward?', up to +'+reward.xp+' XP':'');
    html=secondaryHomeButtons(html);
    return html.replace(/(<main\b[^>]*>)/,'$1<section class="panel lc lc-next" aria-label="Continue your lesson"><p>Lesson '+ROMAN[n-1]+' · '+m.done+' of '+m.total+' required parts complete</p>'+action(t,n,button,'btn')+'</section>');
  };
  var styles=document.createElement('style');
  styles.textContent='.lc{margin:.6rem 0}.lc h2,.lc p{margin:.25rem 0}.lc progress{width:min(100%,22rem);accent-color:var(--acc,#846020)}.lc details{margin:.35rem 0}.lc summary{cursor:pointer}.lc li{margin:.2rem 0}.lc .link{text-align:left}.lc-next .btn{margin-top:.3rem}';
  document.head.appendChild(styles);
})();
