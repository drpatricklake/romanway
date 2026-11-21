/* Visual race feedback only. Scores, clocks, rewards and shared writes remain authoritative. */
(function(){
 'use strict';
 var frames={},serial=0,oldScreen=screenCircus;
 function bounded(n,max){return Math.max(0,Math.min(max,Number(n)||0))}
 function dolphin(){return '<svg viewBox="0 0 64 40" aria-hidden="true" focusable="false"><path d="M7 25C13 10 27 5 40 12l9-5-2 12c6 4 9 9 10 14l-11-4C35 36 22 32 18 25l-9 8 1-10Z" fill="currentColor"/><path d="m28 13 2-10 9 10M29 28l7 9 3-11" fill="currentColor"/><circle cx="45" cy="20" r="1.5" fill="#f4f7f8"/></svg>'}
 function team(){return '<svg viewBox="0 0 120 62" aria-hidden="true" focusable="false"><g fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M57 23 69 17 78 18 88 8 94 8 97 20 90 24 79 24 72 37 60 37Z"/><path d="m87 10 2-7 4 5m-30 27-6 20m15-21 9 18m-2-29 19 2m-38 1-13 6" fill="none" stroke-width="4"/><path d="M77 26 89 22 99 24 108 14 114 15 115 26 107 30 96 29 89 42 78 42Z"/><path d="m84 40-1 16m9-17 10 15" fill="none" stroke-width="4"/><path d="M14 28h29l-5 17H19Z"/><circle cx="27" cy="46" r="11" fill="#f1f5f7" stroke-width="3"/><path d="M27 35v22M16 46h22m-19-8 16 16m0-16-16 16M38 35l31-8" fill="none" stroke-width="2"/><circle cx="31" cy="10" r="5"/><path d="m30 17-3 13h11l-3-12 11 5 38-6" fill="none" stroke-width="4"/></g></svg>'}
 function visual(key,rows,completed){
  completed=bounded(completed,8);var laps=Math.floor(completed*7/8),last=frames[key]||{laps:0,points:{}};
  var h='<section class="circus-course" aria-label="Circus race progress"><div class="circus-spina"><div class="circus-dolphins" aria-hidden="true">';
  for(var i=0;i<7;i++)h+='<span class="circus-dolphin'+(i<laps?' passed':'')+(i>=last.laps&&i<laps?' turning':'')+'">'+dolphin()+'</span>';
  h+='</div><p class="note">'+completed+' of 8 questions completed · '+laps+' of 7 dolphins turned</p></div><p class="note circus-course-key">Chariots show earned points. Seven dolphins mark progress through eight questions.</p>';
  var next={laps:laps,points:{}};
  rows.forEach(function(row){
   var pts=bounded(row.points,120),pos=100*pts/120,prev=last.points[row.id]===undefined?0:last.points[row.id];next.points[row.id]=pos;
   var color=({blue:'#355a87',green:'#387665',red:'#99545a',white:'#657581'})[row.faction]||'#355a87';
   h+='<div class="circus-course-lane"><div class="circus-course-label"><b>'+esc(row.name)+'</b><span>'+pts+' / 120 points</span></div><div class="circus-course-rail" role="meter" aria-label="'+esc(row.name)+' points" aria-valuemin="0" aria-valuemax="120" aria-valuenow="'+pts+'"><div class="circus-course-runway"><span class="circus-team'+(pos!==prev?' advancing':'')+'" style="--team-color:'+color+';--from:'+prev+'%;--to:'+pos+'%">'+team()+'</span></div></div></div>';
  });
  frames[key]=next;
  return h+'</section>';
 }
 screenCircus=function(){
  var h=oldScreen(),rows=[],completed=0,key;
  if(CP.mode){
   if(!CP.finished&&(CP.round<0||CP.mode==='live'&&(!CP.room||CP.room.status!=='running')||CP.mode==='ghost'&&CP.ghostRound>=7&&Date.now()-CP.qStart>=15000))return h;
   key='shared:'+CP.session;var pack=racePack();if(!pack)return h;
   // Reveal a ghost's current-round performance only after the student's answer locks.
   completed=CP.finished?8:Math.max(0,CP.round)+(CP.answers[CP.round]||CP.mode==='live'&&liveElapsed(CP.room)>=12000?1:0);
   var score=CP.finished?(CP.score||PC.score(pack,raceAnswers())):PC.score(pack.slice(0,completed),raceAnswers().slice(0,completed));
   rows.push({id:'self',name:alias(),points:score.points,faction:pilotFaction()});
   if(CP.mode==='ghost')rows.push({id:'ghost',name:CP.ghost.alias,points:PC.score(pack.slice(0,completed),CP.ghost.answers.slice(0,completed)).points,faction:pilotFaction()==='red'?'blue':'red'});
   if(CP.finished&&CP.mode==='live')rows=CP.board.map(function(r){return {id:r.uid,name:r.alias,points:r.points,faction:(CP.people.find(function(p){return p.uid===r.uid})||{}).faction}});
   h=h.replace(/<div class="pilot-lane">[\s\S]*?<\/strong><\/div>/g,'');
   var mark=h.indexOf('<section class="panel"');if(mark<0)return h;
   return h.slice(0,mark)+visual(key,rows,completed)+h.slice(mark);
  }
  var c=window.__circus,R=c&&c.race;if(!c||c.view!=='race'||!R)return h;
  if(!R.motionKey)R.motionKey='trainer:'+(++serial);key=R.motionKey;
  rows=[{id:'self',name:'You',points:R.me,faction:pilotFaction()},{id:'trainer',name:R.drv.n,points:R.aip,faction:pilotFaction()==='red'?'blue':'red'}];
  completed=R.done?8:R.log.length;
  h=h.replace(/<div class="latin-art-stage cirstage"[\s\S]*?<\/div>/,'');
  var first=h.indexOf('<div class="cirlane">');if(first<0)return h;
  h=h.replace(/<div class="cirlane">[\s\S]*?<\/b><\/div>/g,'');
  return h.slice(0,first)+visual(key,rows,completed)+h.slice(first);
 };
 // Bound view-only memory across repeated practice races.
 ['cir-start','cir-again','pilot-ghost-start','pilot-room-open'].forEach(function(k){var fn=ACT[k];if(fn)ACT[k]=function(){frames={};return fn.apply(this,arguments)}});
 var style=document.createElement('style');style.textContent=`
 .circus-course{padding:18px;border:1px solid #c9d6df;border-radius:16px;background:linear-gradient(#f0f5f8,#e4ecf1);margin:16px 0;color:#253e59;overflow:hidden}
 .circus-spina{text-align:center;border-block:2px solid #bccbd5;padding:8px 0;background:#f9fbfc;border-radius:30px}.circus-spina p{margin:2px 0;font-size:.8rem}
 .circus-dolphins{display:flex;justify-content:center;gap:clamp(3px,2vw,18px)}.circus-dolphin{display:block;width:clamp(26px,6vw,46px);color:#8aa6b6;transform-origin:50% 55%}.circus-dolphin svg{display:block;width:100%}.circus-dolphin.passed{color:#355a87;transform:rotate(180deg)}.circus-dolphin.turning{animation:circus-dive .65s ease both}
 .circus-course-key{font-size:.8rem;margin:12px 0}.circus-course-label{display:flex;justify-content:space-between;gap:8px;font-size:.9rem;flex-wrap:wrap}.circus-course-label b{overflow-wrap:anywhere}.circus-course-label span{font-variant-numeric:tabular-nums}
 .circus-course-rail{height:66px;border-bottom:3px solid #a4b7c5;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(25% - 1px),#cbd7df calc(25% - 1px),#cbd7df 25%);margin-bottom:14px}
 .circus-course-runway{position:relative;margin-right:92px;height:100%}.circus-team{position:absolute;left:var(--to);bottom:0;display:block;width:90px;color:var(--team-color)}.circus-team svg{display:block;width:100%}.circus-team.advancing{animation:circus-advance .65s cubic-bezier(.2,.65,.3,1) both}
 @keyframes circus-advance{from{left:var(--from)}to{left:var(--to)}}@keyframes circus-dive{from{transform:rotate(0)}to{transform:rotate(180deg)}}
 @media(max-width:480px){.circus-course{padding:12px}.circus-course-label{font-size:.8rem}}
 @media(prefers-reduced-motion:reduce){.circus-course *{animation:none!important;transition:none!important}}
 `;document.head.appendChild(style);
})();
