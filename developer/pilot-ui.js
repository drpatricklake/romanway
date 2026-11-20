/* Classroom pilot extension. Runs inside the app closure, after identity hooks. */
var PC=window.RomanWayPilot;
var CP={tab:'roster',started:false,teacherWatch:null,unsub:[],assignments:[],classmates:[],rooms:[],ghosts:[],results:[],settings:PC?PC.settings():null,busy:false,error:'',message:'',context:'startup',selectedRoom:null,room:null,people:[],roomStop:null,peopleStop:null,mode:null,ghost:null,answers:[],round:-1,choice:null,answerBusy:false,finished:false,finishBusy:false,score:null,board:[],qStart:0,ghostRound:0,profileSignature:'',assignmentRevision:0};
window.__pilot=CP;
if(PC&&window.__circusAPI){window.__circusAPI.EVENTS.formae.types.push('ac','pf');window.__circusAPI.EVENTS.mixed.types.push('ac','pf');window.__circusAPI.EVENTS.formae.d='Nouns, verbs, adjectives, and pronouns'}
function pilotRender(){var e=document.activeElement;if(e&&e.matches&&e.matches('input,textarea,select'))return;render()}
function pilotError(e){CP.error=e&&e.code==='permission-denied'?'Shared classroom access was denied. Confirm class approval and publish the new Firestore rules.':(e&&e.message)||'The classroom service could not connect.';pilotRender()}
function classroom(){if(!window.RomanWayData||!window.RomanWayData.classroom)throw new Error('The classroom connection is not ready.');return window.RomanWayData.classroom}
function alias(){return String(S.av&&S.av.name||'Charioteer '+String(AUTH.uid||'').slice(-4)).slice(0,60)}
function pilotFaction(uid,calling,override){return PC.faction(uid||AUTH.uid,calling||(S.av&&S.av.calling),override||(CLOUD.member&&CLOUD.member.faction),CP.settings.circus.assign,CP.classmates)}
var factionNames={blue:'Blues',green:'Greens',red:'Reds',white:'Whites'};
window.__pilotFaction=function(){if(!PC)return null;var id=pilotFaction();return {id:id,n:factionNames[id],c:{blue:'#1f4b8c',green:'#2f7a3a',red:'#a8412f',white:'#e9e3d0'}[id],t:id==='white'?'#3a3220':'#fff'}};
window.__pilotReadingAssigned=function(id){return pilotAssignments().some(function(a){return a.kind==='reading'&&a.targetId===id})};
function pilotAssignments(){return CP.assignments.filter(function(a){return !a.audience.length||a.audience.indexOf(AUTH.uid)>=0})}
function pilotApply(){
 if(!PC)return;CP.settings=PC.settings(CLOUD.classInfo);
 var settings=CP.settings,signature=JSON.stringify(settings.learning);
 if(S.user&&S.pilotClassSettings!==signature){
  var learning=Object.assign({},settings.learning);delete learning.lab;delete learning.labLock;delete learning.forumMode;
  S.settings=Object.assign({},S.settings,learning);S.labPref=settings.learning.lab;S.labLock=settings.learning.labLock;S.forumMode=settings.learning.forumMode;S.pilotClassSettings=signature;
 }
 if(S.user&&settings.learning.labLock){S.labPref=settings.learning.lab;S.labLock=true}
 [[window.__circus,'circus'],[window.__biblioteca,'biblioteca']].forEach(function(pair){if(pair[0]){pair[0].settings=settings[pair[1]];pair[0].canEdit=false;pair[0].loaded=true;pair[0].busy=false;pair[0].err=null}});
 if(window.__domus){window.__domus.settings={assigned:pilotAssignments().filter(function(a){return a.kind==='worksheet'||a.source==='worksheet'}).map(function(a){return a.targetId})};window.__domus.canEdit=CLOUD.teacher;window.__domus.loaded=true;window.__domus.busy=false;window.__domus.err=null}
}
window.__pilotApply=pilotApply;
function pilotStop(){CP.unsub.splice(0).forEach(function(f){f()});if(CP.teacherWatch)CP.teacherWatch();CP.teacherWatch=null;CP.started=false;CP.assignments=[];CP.classmates=[];CP.rooms=[];CP.ghosts=[];CP.results=[];CLOUD.rows=[];CLOUD.student=null;CLOUD.selected=null;CP.mode=null}
function pilotRoster(){if(CLOUD.teacher&&!CP.teacherWatch&&CP.started)CP.teacherWatch=classroom().watchRoster(function(rows){CLOUD.rows=rows;if(V.screen==='instructor')pilotRender()},pilotError);else if(!CLOUD.teacher&&CP.teacherWatch){CP.teacherWatch();CP.teacherWatch=null;CLOUD.rows=[];CLOUD.student=null;CLOUD.selected=null}}
function pilotProfile(){
 if(!CP.started||!window.__circusAPI)return;
 var trained=window.__circusAPI.trainedSet(),eligible=Object.keys(trained).filter(function(k){return k!=='__n'}).map(Number);
 var value={alias:alias(),calling:(S.av&&S.av.calling)||'',eligible:eligible,week:String(weekStart(todayIdx())),weekPractice:goalStats().classMine},signature=JSON.stringify(value);
 if(CP.profileSignature===signature)return;CP.profileSignature=signature;
 classroom().profile(value).catch(function(e){CP.profileSignature='';pilotError(e)});
}
function pilotStart(){
 if(!PC||!CLOUD.ready)return;
 var allowed=CLOUD.teacher||CLOUD.member&&CLOUD.member.status==='active';
 if(!allowed){if(CP.started)pilotStop();return;}
 pilotApply();
 if(!CP.started){
  CP.started=true;CP.error='';
  CP.unsub.push(classroom().watchAssignments(function(a){CP.assignments=a;CP.assignmentRevision++;if(S.user)S.pilotAssignments=a.map(function(x){return x.id}).sort().join('|');pilotApply();persist();if(V.screen==='instructor'||V.screen==='domus'||V.screen==='home')pilotRender()},pilotError));
  CP.unsub.push(classroom().watchClassmates(function(a){CP.classmates=a;if(V.screen==='circus'||V.screen==='instructor'&&CP.tab==='circus')pilotRender()},pilotError));
  CP.unsub.push(classroom().watchRooms(function(a){CP.rooms=a;if(V.screen==='circus'&&!CP.mode||V.screen==='instructor'&&CP.tab==='circus')pilotRender()},pilotError));
  CP.unsub.push(classroom().watchGhosts(function(a){CP.ghosts=a;if(V.screen==='circus'&&!CP.mode)pilotRender()},pilotError));
  CP.unsub.push(classroom().watchResults(function(a){CP.results=a;if(V.screen==='circus'||V.screen==='instructor'&&CP.tab==='circus')pilotRender()},pilotError));
  classroom().syncClock().catch(pilotError);
 }
 pilotRoster();pilotProfile();publishPendingGhosts();
}
if(PC){
 var previousSummary=cloudSummary;
 cloudSummary=function(){return PC.summarize(S,{assignments:CP.assignments,rungs:LADDER,readingTask:CP.settings.biblioteca.task},previousSummary())};
 var priorPersist=persist;
 persist=function(){if(AUTH.uid&&S.user){if(CLOUD.ready&&CP.settings.learning.labLock){S.labPref=CP.settings.learning.lab;S.labLock=true}PC.capture(S,CP.context);}
  var result=priorPersist();if(CP.started)Promise.resolve().then(pilotProfile);return result;};
 window.__pilotReward=function(value){if(!AUTH.uid||!S.user)return;var old=S.pilot&&S.pilot.xp?JSON.stringify(S.pilot.xp):null;PC.captureXP(S,value,CP.context);if(old!==JSON.stringify(S.pilot.xp))Promise.resolve().then(function(){if(CLOUD.ready)persist()})};
 ['member','teacher','classInfo'].forEach(function(k){var prior=window.RomanWayAuthApp.databaseHooks[k];window.RomanWayAuthApp.databaseHooks[k]=function(value){prior(value);pilotApply();pilotStart()}});
 window.RomanWayAuthApp.databaseHooks.classInfo=function(data){CLOUD.classInfo=data;pilotApply();if(CLOUD.ready){persist();pilotStart();if(V.screen==='instructor'||V.screen==='signin')pilotRender()}};
 var priorReady=window.RomanWayAuthApp.databaseReady;window.RomanWayAuthApp.databaseReady=function(){priorReady();pilotStart()};
 var priorApply=window.RomanWayAuthApp.databaseHooks.apply;window.RomanWayAuthApp.databaseHooks.apply=function(data){priorApply(data);pilotApply()};
}
function pilotTask(fn){if(CP.busy)return;CP.busy=true;CP.error='';return Promise.resolve().then(fn).catch(pilotError).finally(function(){CP.busy=false;pilotRender()})}
function num(value){return Number.isFinite(value)?value:0}
function stat(value){return value==null?'—':esc(value)}
function table(headers,rows){return '<div class="pilot-table"><table><thead><tr>'+headers.map(function(h){return '<th scope="col">'+esc(h)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(v){return '<td>'+v+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>'}
function rosterPanel(){
 var rows=CLOUD.rows.map(function(r){var s=r.profile&&r.profile.summary||{},v=s.xp&&s.xp.v||{},uid=' data-uid="'+esc(r.uid)+'"';
  var actions=r.status==='active'?'<button class="btn sm ghost" data-act="teacher-student"'+uid+'>View work</button> <button class="btn sm ghost" data-act="teacher-decline"'+uid+'>Remove access</button>':'<button class="btn sm" data-act="teacher-approve"'+uid+'>Approve</button>'+(r.status==='pending'?' <button class="btn sm ghost" data-act="teacher-decline"'+uid+'>Decline</button>':'');
  return ['<b>'+esc(r.displayName)+'</b><br>'+esc(r.email)+(s.persona?'<br><span class="lat">'+esc(s.persona)+'</span>':''),esc(r.status),stat(s.completed),s.accuracy==null?'—':stat(s.accuracy)+'%',s.circus?stat(s.circus.training)+' runs · '+stat(s.circus.shared)+' shared':'Awaiting sync',s.biblioteca?stat(s.biblioteca.completed)+' scrolls':'Awaiting sync',s.lab?stat(s.lab.completed):'Awaiting sync',s.xp?stat(s.xp.total):'Awaiting sync',stat(s.denarii),r.profile&&r.profile.updatedAt?esc(new Date(r.profile.updatedAt.toMillis()).toLocaleString()):'—',actions];
 });
 return '<section class="panel"><h2>Student progress</h2><p>Records update as students save online. Accuracy includes practice and repeated attempts. Older records fill in the new columns when the student next signs in.</p><button class="btn ghost sm" data-act="teacher-refresh">Refresh</button> <button class="btn ghost sm" data-act="teacher-csv">Roster CSV</button> <button class="btn ghost sm" data-act="pilot-step-csv">Sentence Lab CSV</button>'+table(['Student','Membership','Lessons','Accuracy','Circus','Biblioteca','Lab sentences','XP','Denarii','Last saved','Actions'],rows)+(rows.length?'':'<p>No class requests yet.</p>')+'</section>';
}
function stepPanel(){
 var aggregates={};CLOUD.rows.forEach(function(r){var steps=r.profile&&r.profile.summary&&r.profile.summary.lab&&r.profile.summary.lab.steps||{};Object.keys(steps).forEach(function(k){var a=aggregates[k]||(aggregates[k]={correct:0,total:0});a.correct+=num(steps[k].correct);a.total+=num(steps[k].total)})});
 return '<section class="panel"><h2>Sentence Lab steps</h2><p>Each sentence contributes its first completed analysis. An unfinished or unused step contributes no score.</p>'+table(['Step','Correct first try','Opportunities','Accuracy'],Object.keys(aggregates).map(function(k){var r=aggregates[k];return [esc(PC.stepNames[k]||k),stat(r.correct),stat(r.total),r.total?Math.round(100*r.correct/r.total)+'%':'—']}))+'</section>';
}
function studentExtra(){
 if(!CLOUD.student||!CLOUD.selected)return '';
 var data=CLOUD.student,summary=PC.summarize(data,{assignments:CP.assignments,rungs:LADDER,readingTask:CP.settings.biblioteca.task}),h='<section class="panel"><h2>Circus, Biblioteca, and virtues</h2>';
 h+=table(['Circus training runs','Shared races','Library scrolls','Sentence Lab sentences','Denarii'],[[stat(summary.circus.training),stat(summary.circus.shared),stat(summary.biblioteca.completed),stat(summary.lab.completed),stat(summary.denarii)]]);
 h+=table(PC.virtues,[[...PC.virtues.map(function(k){return stat(summary.xp.v[k])})]]);
 h+=table(['Lab step','First-try correct','Opportunities','Accuracy'],Object.keys(summary.lab.steps).map(function(k){var s=summary.lab.steps[k];return [esc(s.name),stat(s.correct),stat(s.total),stat(s.accuracy)+'%']}));
 h+='<h3>Assignments</h3>'+table(['Assignment','Status'],CP.assignments.filter(function(a){return !a.audience.length||a.audience.indexOf(CLOUD.selected)>=0}).map(function(a){return [esc(a.title),esc(PC.assignmentStatus(data,a,{readingTask:CP.settings.biblioteca.task}))]}));
 h+='<h3>Reward activity</h3><p>Measured activity starts when this version is first used. Existing balances and XP are kept as a starting baseline.</p>'+rewardTable(data.pilot&&data.pilot.events||[]);
 return h+'</section>';
}
function rewardTable(events){var totals=PC.tally(events);return table(['Activity','Events','Denarii earned','Denarii spent','XP change'],Object.keys(totals).map(function(k){var r=totals[k];return [esc(k),stat(r.events),stat(r.earned),stat(r.spent),stat(r.xp)]}))}
function assignmentCatalog(){
 var out=WS.filter(function(w){return !w.inNotes&&!w.inTab}).map(function(w){return {id:'ws_'+w.id,kind:w.project?'project':'worksheet',source:'worksheet',targetId:w.id,title:(w.code?w.code+' ':'')+w.title,lesson:w.lesson==='intro'?0:+w.lesson}});
 [{id:'grimm',lesson:35,title:'Grimm’s Law'},{id:'cw47',lesson:47,title:'Caesar Dicit'},{id:'orbis',lesson:51,title:'ORBIS commission'}].forEach(function(p){out.push({id:'project_'+p.id,kind:'project',source:'project',targetId:p.id,title:p.title,lesson:p.lesson})});
 LADDER.forEach(function(r){out.push({id:'reading_'+r.id,kind:'reading',source:'biblioteca',targetId:r.id,title:r.title,lesson:r.L})});
 if(window.__circusAPI)for(var n=1;n<=57;n++)window.__circusAPI.drillTabs(n).forEach(function(t){out.push({id:'circus_'+t[0],kind:'circus',source:'circus',targetId:t[0],title:'Lesson '+ROMAN[n-1]+' '+t[1],lesson:n})});
 return out;
}
function assignmentsPanel(){
 var h='<section class="panel"><h2>Assignments from the Tablinum and practice areas</h2><p>Assign to the class or one approved student. Existing worksheets and projects keep their answers and submission logic.</p><div class="pilot-fields"><label>Material<select id="pilot-assignment">'+assignmentCatalog().map(function(a){return '<option value="'+esc(a.id)+'">'+esc((a.lesson?'Lesson '+ROMAN[a.lesson-1]:'Introduction')+' · '+a.title)+'</option>'}).join('')+'</select></label><label>Due date (optional)<input type="date" id="pilot-due"></label><label>Audience<select id="pilot-audience"><option value="all">Whole class</option>'+CLOUD.rows.filter(function(r){return r.status==='active'}).map(function(r){return '<option value="'+esc(r.uid)+'">'+esc(r.displayName)+'</option>'}).join('')+'</select></label></div><button class="btn" data-act="pilot-assign">Publish assignment</button>';
 h+=table(['Assignment','Due','Audience','Submitted / completed','Actions'],CP.assignments.map(function(a){var applicable=CLOUD.rows.filter(function(r){return r.status==='active'&&(!a.audience.length||a.audience.indexOf(r.uid)>=0)}),done=applicable.filter(function(r){var s=r.profile&&r.profile.summary&&r.profile.summary.assignments&&r.profile.summary.assignments[a.id];return s==='submitted'||s==='completed'}).length;return [esc(a.title),esc(a.due||'—'),a.audience.length?esc((CLOUD.rows.find(function(r){return r.uid===a.audience[0]})||{}).displayName||'Selected student'):'Whole class',done+' / '+applicable.length,'<button class="btn sm ghost" data-act="pilot-unassign" data-id="'+esc(a.id)+'">Remove assignment</button>']}));
 return h+'<p class="note">Removing an assignment keeps all student work. Completion updates on each student’s next online save.</p></section>';
}
function selectField(id,label,value,options){return '<label>'+esc(label)+'<select id="'+id+'">'+options.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(value)===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></label>'}
function numberField(id,label,value,min,max){return '<label>'+esc(label)+'<input id="'+id+'" type="number" min="'+min+'" max="'+max+'" value="'+esc(value)+'"></label>'}
function checkField(id,label,value){return '<label class="pilot-check"><input id="'+id+'" type="checkbox"'+(value?' checked':'')+'> '+esc(label)+'</label>'}
function settingsPanel(){
 var l=CP.settings.learning,c=CP.settings.circus,b=CP.settings.biblioteca;
 var h='<section class="panel"><h2>Learning and feedback</h2><div class="pilot-fields">';
 h+=numberField('p-threshold','Required-practice accuracy (%)',l.threshold,0,100)+selectField('p-macrons','Macrons',l.macrons,[['lenient','Accept missing macrons'],['strict','Require macrons']])+selectField('p-practiceLen','Practice questions',l.practiceLen,[[5,'5'],[10,'10'],[15,'15']])+selectField('p-models','Model translations',l.models,[['off','Hidden'],['after','After the student writes'],['always','Always available']])+numberField('p-dailyGoal','Daily study goal',l.dailyGoal,1,100)+numberField('p-classGoal','Class practice goal',l.classGoal,1,100000)+numberField('p-newPerDay','New vocabulary per day',l.newPerDay,1,100)+selectField('p-lab','Sentence Lab default',l.lab,[['full','Full Lab'],['anchors','Key sentences full'],['light','Stripped-down Lab'],['off','Translate only']])+selectField('p-forumMode','Personal economy',l.forumMode,[['coins','Denarii and purchases'],['merit','No spendable coins']]);
 h+='</div>'+checkField('p-vocabRule','Require vocabulary review below the threshold',l.vocabRule)+checkField('p-autoAddLooked','Add looked-up words to review',l.autoAddLooked)+checkField('p-readingU','Use U in reading text',l.readingU)+checkField('p-showDrafts','Show draft material',l.showDrafts)+checkField('p-labLock','Lock the class Sentence Lab setting',l.labLock)+'<p class="note">AI translation feedback remains off until a separate provider is configured. Existing human-readable model answers remain available.</p><button class="btn" data-act="pilot-save-learning">Save learning settings</button></section>';
 h+='<section class="panel"><h2>Circus</h2><div class="pilot-fields">'+selectField('p-factionMode','Automatic factions',c.assign,[['calling','By calling'],['even','Even split']])+numberField('p-paidRounds','Staked trainer races per day',c.paidRounds,0,50)+'</div>'+checkField('p-stakes','Allow stakes in existing trainer races',c.stakes)+checkField('p-liveEnabled','Allow teacher-led live rounds',c.liveEnabled)+checkField('p-ghostEnabled','Allow classmate ghost races',c.ghostEnabled)+'<p>Shared races use no stakes. The first five shared finishes each day count toward the faction competition. All further races remain available for practice.</p><button class="btn" data-act="pilot-save-circus">Save Circus settings</button></section>';
 h+='<section class="panel"><h2>Biblioteca</h2><div class="pilot-fields">'+selectField('p-bibMode','Scroll access',b.mode,[['sequence','As lessons are completed'],['through','Open through a lesson'],['all','All scrolls open']])+numberField('p-bibThrough','Open through lesson',b.through,0,57)+selectField('p-bibTask','Scroll work',b.task,[['mc','Questions'],['tr','Translation'],['both','Both']])+numberField('p-bibPaid','Paid new scrolls per day',b.paid,0,50)+'</div><button class="btn" data-act="pilot-save-biblioteca">Save Biblioteca settings</button></section>';
 return h;
}
function factionPanel(){return '<section class="panel"><h2>Faction assignments</h2><p>Individual overrides take priority over the automatic assignment. Saving an even split distributes the approved roster across all four factions.</p>'+table(['Student','Faction','Apply'],CLOUD.rows.filter(function(r){return r.status==='active'}).map(function(r){return [esc(r.displayName),'<select id="faction-'+esc(r.uid)+'">'+['auto','blue','green','red','white'].map(function(f){return '<option value="'+f+'"'+((r.faction||'auto')===f?' selected':'')+'>'+(f==='auto'?'Automatic':factionNames[f])+'</option>'}).join('')+'</select>','<button class="btn sm ghost" data-act="pilot-faction" data-uid="'+esc(r.uid)+'">Save</button>']}))+'</section>'}
function standingsPanel(){return '<section class="panel"><h2>Faction competition · last seven days</h2><p>First five shared race results per student per UTC day. Scores already earned stay with the faction represented at that finish. No coins are wagered.</p>'+table(['Faction','Points','Counted races','Students'],PC.standings(CP.results).map(function(g){return [factionNames[g.faction],stat(g.points),stat(g.races),stat(g.students)]}))+'</section>'}
function circusTeacherPanel(){return '<section class="panel"><h2>Host a live round</h2><p>Eight shared questions. Each round gives twelve seconds to answer and three seconds to review. Students must have trained the lessons in the question set.</p><div class="pilot-fields"><label>Title<input id="p-roomTitle" maxlength="100" value="Class Circus round"></label>'+selectField('p-roomEvent','Event','mixed',[['mixed','Pompa · mixed'],['cursus','Cursus · vocabulary'],['quad','Quadrīga · principal parts'],['formae','Formae · forms']])+numberField('p-roomLesson','Questions through lesson',Math.min(57,Math.max(1,Number(V.lesson)||1)),1,57)+'</div><button class="btn" data-act="pilot-room-create"'+(!CP.settings.circus.liveEnabled?' disabled':'')+'>Open lobby</button></section>'+roomList()+standingsPanel()+factionPanel()}
function telemetryPanel(){
 var h='<section class="panel"><h2>Pilot reward evidence</h2><p>The release records balances, virtue changes, completed work, purchases, and the activity that triggered each change. Existing progress is a baseline, so earlier earnings are not counted as new.</p><p>Keep the current prices and XP thresholds for the initial pilot. Compare earning rates, spending, repeat practice, and progress before changing them.</p><button class="btn" data-act="pilot-telemetry-csv">Export measured reward events</button><p class="note">The export contains approved students’ app activity only. It does not record keystrokes or browsing outside the app.</p></section>';
 var rows=CLOUD.rows.filter(function(r){return r.status==='active'}).map(function(r){var s=r.profile&&r.profile.summary||{},t=s.telemetry||{};return [esc(r.displayName),t.startedAt?esc(new Date(t.startedAt).toLocaleString()):'Awaiting next sign-in',stat(t.events),stat(s.denarii),stat(s.xp&&s.xp.total)]});
 return h+'<section class="panel">'+table(['Student','Measurement began','Events','Current denarii','Current XP'],rows)+'</section>';
}
var priorTeacher=screenTeacherCloud;
screenTeacherCloud=function(){
 if(!PC||!CLOUD.teacher)return priorTeacher();
 var h='<main class="wrap"><div class="crumb"><button class="link" data-act="home">All lessons</button></div><h1>Instructor dashboard</h1><p>Real student records, assignments, and class settings.</p><div class="tabs" role="tablist">'+[['roster','Students'],['assignments','Assignments'],['settings','Class settings'],['circus','Circus & factions'],['pilot','Pilot evidence'],['access','Class access']].map(function(t){return '<button class="tab" role="tab" aria-selected="'+(CP.tab===t[0])+'" data-act="pilot-teacher-tab" data-tab="'+t[0]+'">'+t[1]+'</button>'}).join('')+'</div>';
 if(CP.error)h+='<p class="alert" role="alert">'+esc(CP.error)+'</p>';
 if(CLOUD.error)h+='<p class="alert" role="alert">'+esc(CLOUD.error)+'</p>';
 if(CP.message)h+='<p role="status">'+esc(CP.message)+'</p>';
 if(CP.tab==='roster')h+=rosterPanel()+stepPanel()+studentExtra()+teacherStudentHtml();
 else if(CP.tab==='assignments')h+=assignmentsPanel();else if(CP.tab==='settings')h+=settingsPanel();else if(CP.tab==='circus')h+=circusTeacherPanel();else if(CP.tab==='pilot')h+=telemetryPanel();
 else h+='<section class="panel"><h2>Class code</h2><p><b>'+esc(CLOUD.code||'Loading…')+'</b></p><p>Students enter this code under Account. Approve membership in Students.</p><button class="btn ghost" data-act="teacher-new-code">Replace class code</button></section>';
 return h+'</main>';
};
function values(id){var e=document.getElementById(id);return e?e.value:''}
function checked(id){var e=document.getElementById(id);return !!(e&&e.checked)}
function bounded(id,min,max){var value=Number(values(id));if(!Number.isInteger(value)||value<min||value>max)throw new Error('Choose a whole number from '+min+' to '+max+'.');return value}
ACT['pilot-teacher-tab']=function(el){CP.tab=el.dataset.tab;CP.error='';CP.message='';render(true)};
ACT['pilot-save-learning']=function(){return pilotTask(async function(){var l={threshold:bounded('p-threshold',0,100),macrons:values('p-macrons'),practiceLen:bounded('p-practiceLen',5,15),vocabRule:checked('p-vocabRule'),dailyGoal:bounded('p-dailyGoal',1,100),classGoal:bounded('p-classGoal',1,100000),newPerDay:bounded('p-newPerDay',1,100),models:values('p-models'),aiFeedback:false,autoAddLooked:checked('p-autoAddLooked'),readingU:checked('p-readingU'),showDrafts:checked('p-showDrafts'),lab:values('p-lab'),labLock:checked('p-labLock'),forumMode:values('p-forumMode')};await classroom().saveSettings('learning',l);CP.message='Learning settings saved for the class.'})};
ACT['pilot-save-circus']=function(){return pilotTask(async function(){var c={assign:values('p-factionMode'),stakes:checked('p-stakes'),paidRounds:bounded('p-paidRounds',0,50),liveEnabled:checked('p-liveEnabled'),ghostEnabled:checked('p-ghostEnabled')};await classroom().saveSettings('circus',c);if(c.assign==='even'){var rows=CLOUD.rows.filter(function(r){return r.status==='active'}).sort(function(a,b){return a.uid.localeCompare(b.uid)});for(var i=0;i<rows.length;i++)await classroom().setFaction(rows[i].uid,['blue','green','red','white'][i%4]);}CP.message='Circus settings saved.'})};
ACT['pilot-save-biblioteca']=function(){return pilotTask(async function(){await classroom().saveSettings('biblioteca',{mode:values('p-bibMode'),through:bounded('p-bibThrough',values('p-bibMode')==='through'?1:0,57),task:values('p-bibTask'),paid:bounded('p-bibPaid',0,50)});CP.message='Biblioteca settings saved.'})};
ACT['pilot-faction']=function(el){return pilotTask(async function(){await classroom().setFaction(el.dataset.uid,values('faction-'+el.dataset.uid));CP.message='Faction override saved.'})};
ACT['pilot-assign']=function(){return pilotTask(async function(){var a=assignmentCatalog().find(function(a){return a.id===values('pilot-assignment')});if(!a)throw new Error('Choose an assignment.');var audience=values('pilot-audience'),key=a.id+(audience==='all'?'':'_'+audience);await classroom().assignment(Object.assign({},a,{id:key,due:values('pilot-due'),audience:audience==='all'?[]:[audience]}));CP.message='Assignment published.'})};
ACT['pilot-unassign']=function(el){return pilotTask(function(){return classroom().removeAssignment(el.dataset.id)})};
ACT['dm-assign']=function(el){return pilotTask(async function(){var id='ws_'+el.dataset.id,a=CP.assignments.find(function(a){return a.id===id});if(a)await classroom().removeAssignment(id);else{var material=assignmentCatalog().find(function(a){return a.targetId===el.dataset.id&&a.source==='worksheet'});if(material)await classroom().assignment(Object.assign({},material,{due:'',audience:[]}));}})};
['cir-mode','bb-mode','bb-task','bb-paid'].forEach(function(k){ACT[k]=function(){V.screen='instructor';CP.tab='settings';render(true)}});
ACT['teacher-csv']=function(){var keys=['Student','Email','Roman name','Membership','Lessons complete','Recorded accuracy','Circus training','Shared Circus races','Biblioteca scrolls','Lab sentences','XP','Denarii'].concat(PC.virtues);var rows=[keys];CLOUD.rows.forEach(function(r){var s=r.profile&&r.profile.summary||{};rows.push([r.displayName,r.email,s.persona,r.status,s.completed,s.accuracy,s.circus&&s.circus.training,s.circus&&s.circus.shared,s.biblioteca&&s.biblioteca.completed,s.lab&&s.lab.completed,s.xp&&s.xp.total,s.denarii].concat(PC.virtues.map(function(k){return s.xp&&s.xp.v&&s.xp.v[k]})))});downloadFile('Roman-Way-class-progress.csv',rows.map(function(r){return r.map(PC.csvField).join(',')}).join('\n'),'text/csv;charset=utf-8')};
ACT['pilot-step-csv']=function(){var rows=[['Student','Email','Step','Correct first try','Opportunities','Accuracy']];CLOUD.rows.forEach(function(r){var by=r.profile&&r.profile.summary&&r.profile.summary.lab&&r.profile.summary.lab.steps||{};Object.keys(by).forEach(function(k){rows.push([r.displayName,r.email,by[k].name,by[k].correct,by[k].total,by[k].accuracy])})});downloadFile('Roman-Way-Sentence-Lab-steps.csv',rows.map(function(r){return r.map(PC.csvField).join(',')}).join('\n'),'text/csv;charset=utf-8')};
ACT['pilot-telemetry-csv']=function(){return pilotTask(async function(){var rows=[['Student','Email','Time','Activity','Denarii change','XP change','Attempts change','Training change','Reading change']];for(var r of CLOUD.rows.filter(function(r){return r.status==='active'})){var state=await window.RomanWayData.student(r.uid);for(var e of state&&state.pilot&&state.pilot.events||[])rows.push([r.displayName,r.email,new Date(e.at).toISOString(),e.context,e.changes.coins||0,Object.values(e.changes.xp||{}).reduce(function(a,b){return a+b},0),e.changes.attempts||0,e.changes.training||0,e.changes.biblioteca||0]);}downloadFile('Roman-Way-pilot-reward-events.csv',rows.map(function(r){return r.map(PC.csvField).join(',')}).join('\n'),'text/csv;charset=utf-8');CP.message='Pilot evidence exported.'})};
var priorDomus=screenDomus;
screenDomus=function(){pilotApply();var h=priorDomus();if(CP.mode&&window.__domus.room==='atrium')CP.mode=null;if(window.__domus.room==='tablinum'&&!V.ws){var assigned=pilotAssignments();h=h.replace('</h1>','</h1>'+studentAssignmentsHtml(assigned));}return h};
function studentAssignmentsHtml(list){if(!list.length)return '';return '<section class="panel"><h2>Assigned by your instructor</h2>'+list.map(function(a){return '<div class="dmrow"><div style="flex:1 1 220px"><b>'+esc(a.title)+'</b><p class="note">'+esc(PC.assignmentStatus(S,a,{readingTask:CP.settings.biblioteca.task}))+(a.due?' · due '+esc(a.due):'')+'</p></div><button class="btn sm" data-act="pilot-open-assignment" data-id="'+esc(a.id)+'">Open</button></div>'}).join('')+'</section>'}
ACT['pilot-open-assignment']=function(el){var a=CP.assignments.find(function(a){return a.id===el.dataset.id});if(!a)return;if(a.source==='worksheet')return ACT['ws-open']({dataset:{id:a.targetId}});if(a.kind==='project')return ACT['dm-proj']({dataset:{l:String(a.lesson),tab:a.targetId==='cw47'?'crossword':a.targetId}});if(a.kind==='reading'){ACT['open-biblioteca']();return ACT['bb-read']({dataset:{id:a.targetId}})}if(a.kind==='circus')return ACT['cir-train']({dataset:{n:String(a.lesson),tab:a.targetId}})};
/* Shared Circus: synchronized teacher-led rounds and asynchronous classmate ghosts. */
function raceText(value){return esc(value).replace(/&lt;(\/?)(b|i|em|u|strong|sup|sub)&gt;/g,'<$1$2>')}
function eligibleFor(questions){var trained=window.__circusAPI?window.__circusAPI.trainedSet():{};return questions.every(function(q){return !!trained[q.lesson]})}
function roomList(){
 return '<section class="panel"><h2>Live rounds</h2>'+(!CP.settings.circus.liveEnabled?'<p>Your instructor has paused live rounds.</p>':CP.rooms.length?CP.rooms.map(function(r){var ended=r.startsAt&&classroom().now()>=r.startsAt.toMillis()+120000,can=eligibleFor(r.questions||[]),open=r.status==='lobby'?'Open lobby':r.status==='cancelled'?'Cancelled':ended?'Results':'In progress';return '<div class="dmrow"><div style="flex:1 1 210px"><b>'+esc(r.title)+'</b><div class="note">'+esc(open)+' · '+esc(r.event)+'</div></div>'+(r.status==='cancelled'?'':'<button class="btn sm ghost" data-act="pilot-room-open" data-id="'+esc(r.id)+'"'+(!CLOUD.teacher&&!can?' disabled':'')+'>'+esc(open)+'</button>')+'</div>'+(!CLOUD.teacher&&!can?'<p class="note">Train the lessons in this round to enter.</p>':'')}).join(''):'<p>No live round is open. Your instructor can open one from Teacher → Circus & factions.</p>')+'</section>';
}
function sharedCircusMenu(){
 if(!CP.started)return '<section class="panel"><h2>Classmate races</h2><p>Join your class under Account and wait for instructor approval to open shared races. Trainer races remain available.</p></section>';
 var ghosts=CP.ghosts.filter(function(g){return g.uid!==AUTH.uid&&eligibleFor(g.questions||[])});
 var recentPoints=(S.pilot&&S.pilot.lastRacePoints)||60;
 ghosts.sort(function(a,b){return Math.abs(a.points-recentPoints)-Math.abs(b.points-recentPoints)});ghosts=ghosts.slice(0,6);
 return (CP.error?'<p class="alert" role="alert">'+esc(CP.error)+'</p>':'')+roomList()+'<section class="panel"><h2>Race a classmate’s ghost</h2><p>Answer the same eight questions from a classmate’s saved trainer race. No waiting and no stake. These are the six closest eligible ghosts from the latest sixty shared runs.</p>'+(!CP.settings.circus.ghostEnabled?'<p>Your instructor has paused ghost races.</p>':ghosts.length?ghosts.map(function(g){return '<div class="dmrow"><div style="flex:1 1 220px"><b>'+esc(g.alias)+'</b> · '+stat(g.points)+' points<div class="note">'+stat(g.correct)+' / 8 correct · '+esc(g.event)+'</div></div><button class="btn sm" data-act="pilot-ghost-start" data-id="'+esc(g.id)+'">Race this ghost</button></div>'}).join(''):'<p>No eligible classmate ghost yet. Finish a trainer race to share the first one. Only trained lessons appear.</p>')+'</section>'+standingsPanel();
}
function clearRoom(){CP.session=(CP.session||0)+1;CP.answerBusy=false;CP.finishAttempted=false;if(CP.roomStop)CP.roomStop();if(CP.peopleStop)CP.peopleStop();CP.roomStop=null;CP.peopleStop=null;CP.room=null;CP.people=[];CP.selectedRoom=null;CP.finished=false;CP.finishBusy=false;CP.answers=[];CP.round=-1;CP.choice=null;CP.score=null;CP.board=[]}
function selectRoom(id){
 clearRoom();CP.selectedRoom=id;CP.mode='live';V.screen='circus';CP.error='';
 CP.roomStop=classroom().watchRoom(id,function(room){CP.room=room;if(!room){CP.error='This round is no longer available.';CP.mode=null}else if(room.status==='cancelled')CP.error='Your instructor cancelled this round. No result or faction points are awarded.';pilotRender()},pilotError);
 CP.peopleStop=classroom().watchParticipants(id,function(people){CP.people=people;pilotRender()},pilotError);
 return classroom().ownAnswers(id).then(function(answers){CP.answers=answers;pilotRender()});
}
ACT['pilot-room-create']=function(){return pilotTask(async function(){if(!CLOUD.teacher)throw new Error('Only your instructor can open a live round.');var event=values('p-roomEvent'),upto=bounded('p-roomLesson',1,57),ids=window.__arenaAPI.genIds(window.__circusAPI.EVENTS[event].types,upto);ids=shuffle(ids);var pack=PC.questionPack(ids,window.__arenaAPI.itemById).slice(0,8);if(pack.length!==8)throw new Error('Not enough questions for this event and lesson range.');var room=await classroom().createRoom({title:values('p-roomTitle')||'Class Circus round',event:event,questions:pack});await selectRoom(room);})};
ACT['pilot-room-open']=function(el){return pilotTask(function(){return selectRoom(el.dataset.id)})};
ACT['pilot-room-join']=function(){return pilotTask(async function(){if(!CP.room||!eligibleFor(CP.room.questions))throw new Error('Train the lessons in this question set first.');await classroom().joinRoom(CP.room.id,alias(),pilotFaction());CP.message='You are in the round. Wait for your instructor to start.'})};
ACT['pilot-room-start']=function(){return pilotTask(function(){return classroom().startRoom(CP.room.id)})};
ACT['pilot-room-cancel']=function(){return pilotTask(function(){return classroom().cancelRoom(CP.room.id)})};
ACT['pilot-circus-menu']=function(){clearRoom();CP.mode=null;CP.ghost=null;CP.message='';if(window.__circus)window.__circus.view='menu';V.screen='circus';render(true)};
ACT['pilot-ghost-start']=function(el){
 var ghost=CP.ghosts.find(function(g){return g.id===el.dataset.id});if(!ghost||!CP.settings.circus.ghostEnabled||!eligibleFor(ghost.questions))return;
 clearRoom();CP.mode='ghost';CP.ghost=ghost;CP.answers=[];CP.ghostRound=0;CP.round=0;CP.qStart=Date.now();CP.choice=null;CP.finished=false;CP.error='';V.screen='circus';window.__circus.view='menu';render(true);
};
function liveIndex(room){return room&&room.startsAt?Math.floor((classroom().now()-room.startsAt.toMillis())/15000):-1}
function liveElapsed(room){return room&&room.startsAt?classroom().now()-room.startsAt.toMillis()-Math.max(0,liveIndex(room))*15000:0}
function myParticipant(){return CP.people.find(function(p){return p.uid===AUTH.uid})}
ACT['pilot-race-answer']=function(el){
 if(CP.answerBusy||CP.finished)return;var choice=+el.dataset.choice;
 if(CP.mode==='ghost'){
  var i=CP.ghostRound;if(CP.answers[i]||Date.now()-CP.qStart>12000)return;
  CP.answers[i]={choice:choice,ms:Math.round(Math.min(12000,Date.now()-CP.qStart))};CP.choice=choice;render();return;
 }
 var room=CP.room,round=liveIndex(room);if(!room||room.status!=='running'||!myParticipant()||round<0||round>7||liveElapsed(room)>12000||CP.answers[round]&&CP.answers[round].choice!==-1)return;
 CP.answerBusy=true;CP.error='';var session=CP.session;
 return classroom().answer(room.id,round,choice,liveElapsed(room)).then(function(answer){if(session===CP.session){CP.answers[round]=answer;CP.choice=answer.choice}},pilotError).finally(function(){if(session===CP.session){CP.answerBusy=false;render()}});
};
function raceAnswers(){return CP.mode==='ghost'?CP.answers:Array.from({length:8},function(_,i){return CP.answers[i]||{choice:-1,ms:12000}})}
function racePack(){return CP.mode==='ghost'?CP.ghost.questions:CP.room.questions}
function persistSharedResult(result,pack,answers){
 var p=S.pilot=S.pilot||{};p.savedResults=p.savedResults||{};
 if(p.savedResults[result.id])return;
 var score=PC.score(pack,answers),opponent=CP.mode==='ghost'?CP.ghost.points:null;
 var top=CP.mode==='live'&&CP.board.length?CP.board[0].points:null;
 var winning=CP.mode==='ghost'?score.points>opponent:score.points===top&&CP.board.filter(function(s){return s.points===top}).length===1;
 var draw=CP.mode==='ghost'?score.points===opponent:score.points===top&&!winning;
 var c=S.circus=S.circus||{},stats=c.stats=c.stats||{w:0,l:0,d:0};if(winning)stats.w++;else if(draw)stats.d++;else stats.l++;
 p.savedResults[result.id]={at:Date.now(),points:score.points,correct:score.correct,kind:CP.mode};p.sharedRuns=num(p.sharedRuns)+1;p.lastRacePoints=score.points;CP.context='circus:'+CP.mode+':finish';persist();
}
async function finishShared(){
 if(CP.finishBusy||CP.finished||CP.finishAttempted)return;var session=CP.session;CP.finishAttempted=true;CP.finishBusy=true;CP.error='';
 try{
  if(CP.mode==='live'){
   if(!CP.room||CP.room.status!=='running')return;
   CP.answers=await classroom().ownAnswers(CP.room.id);CP.board=await classroom().roomScores(CP.room.id);
  }
  if(session!==CP.session)return;
  var pack=racePack(),answers=raceAnswers();CP.score=PC.score(pack,answers);
  if(CLOUD.member&&CLOUD.member.status==='active'&&(CP.mode==='ghost'||myParticipant())){
   var result=await classroom().result(CP.mode==='ghost'?'ghost':'live',CP.mode==='ghost'?CP.ghost.id:CP.room.id,answers,pilotFaction(),alias());
   if(session!==CP.session)return;
   persistSharedResult(result,pack,result.answers||answers);CP.factionCounted=result.eligible&&!result.replay;CP.replay=!!result.replay;
  }else CP.factionCounted=false;
  CP.finished=true;
 }catch(e){pilotError(e)}finally{if(session===CP.session){CP.finishBusy=false;pilotRender()}}
}
ACT['pilot-finish-retry']=function(){CP.finishAttempted=false;return finishShared()};
function lane(name,points,other){return '<div class="pilot-lane"><b>'+esc(name)+'</b><div class="pilot-track"><span style="width:'+Math.min(100,100*num(points)/120)+'%;background:'+(other?'#698a97':'#304d88')+'"></span></div><strong>'+stat(points)+'</strong></div>'}
function sharedResultHtml(){
 var pack=racePack(),score=CP.score||PC.score(pack,raceAnswers()),h='<section class="panel" data-cue="race-finish"><h2>Race finished</h2><p>'+score.correct+' of 8 correct · '+score.points+' points.</p>';
 if(CP.mode==='ghost')h+=lane(alias(),score.points)+lane(CP.ghost.alias,CP.ghost.points,true)+'<p>'+esc(score.points>CP.ghost.points?'You won the ghost race.':score.points===CP.ghost.points?'A draw.':'A call to practise — try another race when you are ready.')+'</p>';
 else h+=table(['Charioteer','Points','Correct'],CP.board.map(function(s){return [esc(s.alias),stat(s.points),stat(s.correct)+' / 8']}));
 h+='<p>'+(CP.replay?'Practice replay. Your first recorded result for this race is retained.':CP.factionCounted?'This finish counts for your faction.':'This finish does not add faction points. Your first five eligible finishes each UTC day count.')+'</p><h3>Review</h3>';
 score.rows.forEach(function(a,i){var q=pack[i];h+='<details class="subm"><summary>'+(a.correct?'✓ Correct':'Review')+' · '+raceText(q.q)+'</summary><p><b>Correct answer:</b> '+raceText(q.options[q.answer])+'</p><p>'+raceText(q.explanation)+'</p></details>'});
 return h+'<button class="btn" data-act="pilot-circus-menu">Back to the Circus</button></section>';
}
function sharedRaceScreen(){
 var h='<main class="wrap"><div class="crumb"><button class="link" data-act="pilot-circus-menu">The Circus</button></div><h1>'+(CP.mode==='ghost'?'Ghost race':CP.room?esc(CP.room.title):'Live round')+'</h1>';
 if(CP.error)h+='<p class="alert" role="alert">'+esc(CP.error)+'</p>';
 if(CLOUD.teacher&&CP.mode==='live'&&CP.room&&CP.room.status==='running')h+='<p><button class="btn ghost sm" data-act="pilot-room-cancel">Cancel round</button></p>';
 if(CP.finished)return h+sharedResultHtml()+'</main>';
 if(CP.mode==='live'){
  var room=CP.room;if(!room)return h+'<p role="status">Loading the round…</p></main>';
  if(room.status==='cancelled')return h+'<p>This round was cancelled.</p></main>';
  if(room.status==='lobby')return h+'<section class="panel"><h2>The lobby</h2><p>Ready: '+CP.people.length+' charioteers. Twelve seconds per question, followed by three seconds to review.</p><ul>'+CP.people.map(function(p){return '<li>'+esc(p.alias)+' · '+factionNames[p.faction]+'</li>'}).join('')+'</ul>'+(!CLOUD.teacher&&!myParticipant()?'<button class="btn" data-act="pilot-room-join">Join this round</button>':'<p>'+(CLOUD.teacher?'Host view. Start once your students have joined.':'You have joined. Wait for your instructor.')+'</p>')+(CLOUD.teacher?'<button class="btn" data-act="pilot-room-start"'+(!CP.people.length?' disabled':'')+'>Start round</button> <button class="btn ghost" data-act="pilot-room-cancel">Cancel round</button>':'')+'</section></main>';
  var round=liveIndex(room),elapsed=liveElapsed(room);
  if(round<0)return h+'<section class="panel"><h2>Get ready</h2><p id="pilot-countdown" role="status">Starting in '+Math.ceil((room.startsAt.toMillis()-classroom().now())/1000)+'…</p></section></main>';
  if(round>=8)return h+'<section class="panel"><p role="status">'+(CP.finishBusy?'Saving the shared result…':'The round has finished.')+'</p>'+(!CP.finishBusy?'<button class="btn" data-act="pilot-finish-retry">Load and save results</button>':'')+'</section></main>';
  CP.round=round;
 }else{CP.round=CP.ghostRound;var elapsed=Date.now()-CP.qStart;if(CP.ghostRound>=7&&elapsed>=15000)return h+'<section class="panel"><p role="status">'+(CP.finishBusy?'Saving the ghost result…':'The race has finished.')+'</p>'+(!CP.finishBusy?'<button class="btn" data-act="pilot-finish-retry">Save results</button>':'')+'</section></main>';}
 var q=racePack()[CP.round],answer=CP.answers[CP.round],closed=elapsed>=12000,answered=answer&&answer.choice!==-1,can=CP.mode==='ghost'||myParticipant();
 var progress=PC.score(racePack().slice(0,CP.round),raceAnswers().slice(0,CP.round));
 h+=lane(alias(),progress.points);if(CP.mode==='ghost')h+=lane(CP.ghost.alias,PC.score(CP.ghost.questions.slice(0,CP.round),CP.ghost.answers.slice(0,CP.round)).points,true);
 h+='<section class="panel"><p>Question '+(CP.round+1)+' of 8 · <span id="pilot-seconds">'+Math.max(0,Math.ceil((12000-elapsed)/1000))+'</span> seconds</p><div class="pilot-time"><span id="pilot-time" style="width:'+Math.max(0,100*(12000-elapsed)/12000)+'%"></span></div><h2 class="lat">'+raceText(q.q)+'</h2><div class="pilot-answers">'+q.options.map(function(o,k){return '<button class="btn ghost'+(answered&&answer.choice===k?' pilot-picked':'')+'" data-act="pilot-race-answer" data-choice="'+k+'"'+(!can||closed||answered||CP.answerBusy?' disabled':'')+'>'+raceText(o)+'</button>'}).join('')+'</div>';
 if(closed||answered)h+='<p role="status">'+(answered&&answer.choice===q.answer?'Correct. ':answered?'Review this one. ':'Time is up. ')+'<b>'+raceText(q.options[q.answer])+'</b> '+raceText(q.explanation)+'</p>';
 if(!can)h+='<p>You are watching this round. Join the next lobby to take part.</p>';
 return h+'</section></main>';
}
var priorCircus=screenCircus;
screenCircus=function(){pilotApply();if(PC&&CP.mode)return sharedRaceScreen();var h=priorCircus();if(PC&&window.__circus.view==='menu'){h=h.replace(/<div class="panel" style="margin-top:\.8em;opacity:\.8"><b>Live rounds with your classmates<\/b>[\s\S]*?<\/div>/,'');h=h.replace('</main>',sharedCircusMenu()+'</main>')}return h};
var lastTick='';
setInterval(function(){
 if(!PC||V.screen!=='circus'||!CP.mode||CP.finished)return;
 if(CP.mode==='live'){
  if(!CP.room||CP.room.status!=='running')return;
  var round=liveIndex(CP.room),elapsed=liveElapsed(CP.room),tick=round+':'+(elapsed>=12000);
  if(round<0){var c=document.getElementById('pilot-countdown');if(c)c.textContent='Starting in '+Math.max(0,Math.ceil((CP.room.startsAt.toMillis()-classroom().now())/1000))+'…';}
  if(round>=8){finishShared();return;}
  if(tick!==lastTick){lastTick=tick;render();}
 }else{
  var elapsed=Date.now()-CP.qStart;
  if(elapsed>=12000&&!CP.answers[CP.ghostRound]){CP.answers[CP.ghostRound]={choice:-1,ms:12000};render();}
  if(elapsed>=15000){if(CP.ghostRound>=7){finishShared();return;}CP.ghostRound++;CP.round=CP.ghostRound;CP.qStart=Date.now();CP.choice=null;render();}
 }
 var e=document.getElementById('pilot-seconds'),bar=document.getElementById('pilot-time');if(e)e.textContent=Math.max(0,Math.ceil((12000-elapsed)/1000));if(bar)bar.style.width=Math.max(0,100*(12000-elapsed)/12000)+'%';
},200);
window.__pilotTrainerFinished=function(R){
 if(!PC||!AUTH.uid||!R||!R.done||R.pilotGhost)return;
 var pack=PC.questionPack(R.ids||[],function(id){return R.items[(R.ids||[]).indexOf(id)]});if(pack.length!==8)return;
 R.pilotGhost=true;var pending={id:crypto.randomUUID().replace(/-/g,''),alias:alias(),event:R.ev,questions:pack,answers:R.log.map(function(a){return {choice:a.choice,ms:Math.min(12000,Math.round(a.ms))}})};
 var p=S.pilot=S.pilot||{};(p.pendingGhosts=p.pendingGhosts||[]).push(pending);persist();publishPendingGhosts();
};
var publishingGhosts=false;
async function publishPendingGhosts(){
 if(!CP.started||publishingGhosts||!CP.settings.circus.ghostEnabled)return;
 publishingGhosts=true;try{var pending=S.pilot&&S.pilot.pendingGhosts||[];while(pending.length){await classroom().publishGhost(pending[0]);pending.shift();persist();}}catch(e){pilotError(e)}finally{publishingGhosts=false}
}
ACT['pilot-ghost-retry']=function(){return publishPendingGhosts()};
/* The full form index and its source audit are available in the Codex. */
var formIndex=null;
if(window.RomanWayForms){
 if(!AUTOMAP)buildAuto();
 // Retain existing sentence-specific case keys before extending dictionary candidates.
 Object.keys(LAB).forEach(function(id){LAB2.analyze(id)});
 formIndex=window.__wordForms=window.RomanWayForms.build({vocabulary:VOC,legacy:AUTOMAP,glosses:LEX,sentences:LAB,clauseTags:window.__LABCL});
 window.__AM=AUTOMAP;
 Object.keys(formIndex.forms).forEach(function(k){var entries=formIndex.forms[k],parses=[];entries.forEach(function(e){var p=e.parse;if(e.pos==='participle')p=e.tense+' '+e.voice+' part., '+p;if(parses.indexOf(p)<0)parses.push(p)});if(!AUTOMAP[k])AUTOMAP[k]={lemma:entries[0].lemma,parses:parses,parse:parses.join(' or '),mean:entries[0].meaning}});

 var priorAuto=autoEntry;
 autoEntry=function(word){var found=formIndex.lookup(word);if(!found.length)return priorAuto(word);var lemmas=[],meanings=[],parses=[];found.forEach(function(e){if(lemmas.indexOf(e.lemma)<0)lemmas.push(e.lemma);if(e.meaning&&meanings.indexOf(e.meaning)<0)meanings.push(e.meaning);var p=e.pos==='participle'?e.tense+' '+e.voice+' part., '+e.parse:e.parse;if(p!=='dictionary headword'&&parses.indexOf(p)<0)parses.push(p)});return [lemmas.join(' / '),parses.slice(0,12).join(' or '),meanings.join('; '),''];};
}
function wordFormPanel(){var a=formIndex&&formIndex.audit();return '<details class="panel"><summary><b>Word-form index</b></summary><p>'+(a?a.covered+' of '+a.unique+' distinct Sentence Lab surface forms have an entry. Entries preserve alternate analyses and include an observed-form supplement. One source spelling, repperiēs, is flagged for review.':'The word-form file did not load.')+'</p><label>Look up a form <input id="pilot-word" placeholder="e.g. captā, essent, quōrum"></label> <button class="btn sm" data-act="pilot-word">Look up</button><div id="pilot-word-results"></div><p class="note">The index lists possible forms. The sentence’s authored tags decide what the word is doing here.</p></details>'}
var priorAppendix=screenAppendix;screenAppendix=function(){return priorAppendix().replace('</main>',wordFormPanel()+'</main>')};
ACT['pilot-word']=function(){var word=values('pilot-word'),list=formIndex?formIndex.lookup(word):[],e=document.getElementById('pilot-word-results');if(e)e.innerHTML=list.length?table(['Lemma','Analysis','Meaning','Source'],list.map(function(x){return [esc(x.lemma),esc((x.pos==='participle'?x.tense+' '+x.voice+' participle · ':'')+x.parse),esc(x.meaning),esc(x.source)]})):'<p>No analysis is recorded for this form yet.</p>'};
/* Track the activity that caused a reward. No answer text or keystrokes enter the ledger. */
Object.keys(ACT).forEach(function(key){var fn=ACT[key];if(typeof fn!=='function')return;ACT[key]=function(){CP.context=V.screen+':'+key;var data=arguments[0]&&arguments[0].dataset;if(data&&['av-buy','av-cbuy','forum-buy'].indexOf(key)>=0&&data.id)CP.context+=':'+String(data.id).slice(0,100);else if(data&&key==='nle-check'&&data.s)CP.context+=':'+String(data.s).slice(0,100);return fn.apply(this,arguments)}});
var approvedAction=ACT['teacher-approve'];ACT['teacher-approve']=async function(el){await approvedAction(el);if(CP.settings.circus.assign==='even'){var rows=CLOUD.rows.filter(function(r){return r.status==='active'}).sort(function(a,b){return a.uid.localeCompare(b.uid)}),i=rows.findIndex(function(r){return r.uid===el.dataset.uid});if(i>=0)await classroom().setFaction(el.dataset.uid,['blue','green','red','white'][i%4]);}};
var pilotStyle=document.createElement('style');pilotStyle.textContent='.top-in,.top-r{flex-wrap:wrap}.top-r{justify-content:flex-end}.pilot-table{overflow-x:auto;margin:.8rem 0}.pilot-table table{width:100%;border-collapse:collapse}.pilot-table th,.pilot-table td{text-align:left;padding:.65rem;border-bottom:1px solid #d7dfe6;vertical-align:top}.pilot-table th{background:#eef2f6;color:#253e59;font-size:.86rem}.pilot-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:1rem 0}.pilot-fields label{display:grid;gap:6px}.pilot-fields select,.pilot-fields input{max-width:100%;width:100%}.pilot-check{display:flex;gap:9px;align-items:center;margin:.6rem 0}.pilot-lane{display:grid;grid-template-columns:minmax(90px,160px) 1fr 40px;gap:12px;align-items:center;margin:14px 0}.pilot-track{height:16px;border-radius:20px;background:#e0e7ed;overflow:hidden}.pilot-track span{display:block;height:100%;transition:width .5s ease}.pilot-answers{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.pilot-picked{outline:3px solid #547889}.pilot-time{height:6px;background:#dfe6ed;margin-bottom:20px}.pilot-time span{display:block;background:#385d82;height:100%}@media(prefers-reduced-motion:reduce){.pilot-track span{transition:none}}';document.head.appendChild(pilotStyle);

classTotals=function(){var g=goalStats(),week=String(weekStart(todayIdx())),others=CP.classmates.filter(function(p){return p.uid!==AUTH.uid&&p.uid!=='ZU5goPmM28X40rVridJLtZ9JcBu2'&&p.week===week}).reduce(function(total,p){return total+num(p.weekPractice)},0);return {total:others+(CLOUD.teacher?0:g.classMine),mine:g.classMine,goal:S.settings.classGoal}};
