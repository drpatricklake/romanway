"""Render the selected scroll activities using the existing reading and exercise records."""
from pathlib import Path

page = Path(__file__).resolve().parents[1] / 'index.html'
source = page.read_text(encoding='utf-8')


def once(old, new):
    global source
    assert source.count(old) == 1, old[:80]
    source = source.replace(old, new, 1)


once('function readingCard(rd){', "function readingCard(rd, options){")
once("+lookedList(rd)+translateBox(rd)+'</section>'", "+lookedList(rd)+(options&&options.translation===false?'':translateBox(rd))+'</section>'")
once(
    " function task(){var t=BI.settings&&BI.settings.task;return (t==='tr'||t==='both')?t:'mc'}",
    """ var options=[['read','Reading only'],['tr','Translation'],['mc','Multiple choice'],['both','Translation and multiple choice']];
 function task(){
  var t=PUBLIC_PRACTICE?(S.biblio||{}).forumTask:BI.settings&&BI.settings.task;
  return (t==='tr'||t==='both'||(PUBLIC_PRACTICE&&t==='read'))?t:'mc';
 }
 function forumOptions(){
  if(!PUBLIC_PRACTICE)return '';
  return '<section class="panel bb-options" role="group" aria-label="Reading and exercise options"><p style="margin:0 0 .75rem;font-weight:600">How would you like to work?</p><div class="seg">'+options.map(function(option){
   return '<button type="button" data-act="bb-forum-task" data-k="'+option[0]+'" aria-pressed="'+(task()===option[0])+'">'+option[1]+'</button>';
  }).join('')+'</div><p class="note">Your choice and work are saved on this device.</p></section>';
 }
 function needsTranslation(t){return t==='tr'||t==='both'}
 function needsQuestions(t){return t==='mc'||t==='both'}
 function translationMinimum(r){return Math.max(8,Math.round(r.lines.join(' ').split(/\\s+/).length*0.4))}""",
)
once(
    "return t==='both'?(mc&&trOK(id)):(t==='tr'?trOK(id):mc)",
    "return t==='read'?!!((bs().read||{})[id]||mc||trOK(id)):(t==='both'?(mc&&trOK(id)):(t==='tr'?trOK(id):mc))",
)
# A legacy ladder requirement must not lock the supplementary scroll it points to.
once(
    " function lessonComplete(n){try{var i=window.__rinfo(n);return !!(i&&i.live&&i.total&&i.done>=i.total)}catch(e){return false}}",
    """ function lessonComplete(n){
  try{
   var i=window.__rinfo(n);
   if(!i||!i.live||!i.total)return false;
   if(i.done>=i.total)return true;
   var parts=lessonProgress(n).parts;
   if(!parts||!parts.some(function(p){return p.kind==='ladder'}))return false;
   var core=parts.filter(function(p){return p.kind!=='ladder'});
   return core.length>0&&core.every(function(p){return p.done});
  }catch(e){return false}
 }""",
)
# Preserve a previously opened Forum scroll when the learner switches activities.
once("if(isDone(r.id))return true;var m=mode();", "if(isDone(r.id)||(PUBLIC_PRACTICE&&bs().seen[r.id]))return true;var m=mode();")
# Reading alone records completion without creating a new reward rule. Initialize existing credits
# under the original MC behavior when the first visit is in reading-only mode.
once(
    "  rungs().forEach(function(r){if(!isDone(r.id)||b.paid[r.id])return;",
    """  if(task()==='read'&&!first)return;
  rungs().forEach(function(r){
   var qualified=task()==='read'?!!nleState(r.id).done:isDone(r.id);
   if(!qualified||b.paid[r.id])return;""",
)
once("f.add(PAY);b.days[t]=n+1;b.paid[r.id]=2", "b.days[t]=n+1;b.paid[r.id]=2;f.add(PAY)")
once("function trPanel(r){var t=task();if(t==='mc')return '';", "function trPanel(r){if(!needsTranslation(task()))return '';")
once("need=Math.max(8,Math.round(r.lines.join(' ').split(/\\s+/).length*0.4)),done=trOK(id)", "need=translationMinimum(r),done=trOK(id)")
start = source.index("   var rv=(window.__ART||{}).scroll_reveal;")
end = source.index("\n   S.ladderOpen=null}", start)
source = source[:start] + """   var rv=(window.__ART||{}).scroll_reveal,t=task();
   if(r&&unlocked(r)){
    var instruction={read:'Read at your own pace. You can mark the scroll as read when you finish.',tr:'Then write your translation.',mc:'Then answer the questions.',both:'Then write your translation and answer the questions.'}[t];
    var readButton=t==='read'?(isDone(open)?'<p class="note" role="status">Read</p>':'<button class="btn sm" data-act="bb-mark-read" data-id="'+esc(open)+'">Mark as read</button>'):'';
    return h+'<div class="sec"><button class="btn ghost" data-act="ld-back">Back to the Biblioteca</button></div>'+
     (rv?'<div class="bbreveal" aria-hidden="true"><img src="'+rv.u+'" alt="" data-cue="scroll-open"></div>':'')+
     '<div class="sec prose"><h2>'+esc(r.title)+'</h2><p class="note">Tap a word for help, or switch help off. '+instruction+'</p></div>'+
     forumOptions()+readingCard(readingById(open),{translation:needsTranslation(t)})+trPanel(r)+(needsQuestions(t)?nleView(open,true):'')+readButton+'</main>';
   }""" + source[end:]
once("  var bg=(window.__ART||{}).bg_biblio;", "  h+=forumOptions();\n  var bg=(window.__ART||{}).bg_biblio;")
once("sc=done?nleScore(r.id):null", "sc=needsQuestions(task())&&nleState(r.id).done?nleScore(r.id):null")
once("if(window.__fc&&window.__fc.coinsOn&&window.__fc.coinsOn())h+=", "if(task()!=='read'&&window.__fc&&window.__fc.coinsOn&&window.__fc.coinsOn())h+=")
once("  A['bb-trdone']=function(t){var id=t.dataset.id,need=+t.dataset.need,", """  A['bb-forum-task']=function(t){
   var next=t.dataset.k;
   if(!PUBLIC_PRACTICE||!S.user||!options.some(function(o){return o[0]===next}))return;
   bs().forumTask=next;BI.trmsg='';persist();render(true);
  };
  A['bb-mark-read']=function(t){
   var id=t.dataset.id,r=LADDER.find(function(r){return r.id===id});
   if(!PUBLIC_PRACTICE||!S.user||task()!=='read'||S.ladderOpen!==id||!r||!unlocked(r))return;
   var b=bs();b.read=b.read||{};if(!b.read[id]){b.read[id]=Date.now();persist()}render(true);
  };
  A['bb-trdone']=function(t){
   var id=t.dataset.id,r=LADDER.find(function(r){return r.id===id});
   if(!S.user||!needsTranslation(task())||S.ladderOpen!==id||!r||!unlocked(r))return;
   var need=translationMinimum(r),""")
once("  A['bb-read']=function(t){var b=bs();", """  A['bb-read']=function(t){var r=LADDER.find(function(r){return r.id===t.dataset.id});
   if(!S.user||!r||!unlocked(r))return;
   BI.trmsg='';var b=bs();""")
once("<h1 style=\"font-size:2.1rem;margin-bottom:.1em\">Biblioteca</h1>", "<h1 style=\"font-size:2.1rem;margin-bottom:.1em\">Bibliothēca</h1>")
# Normalize the existing instructor option labels while retaining its saved keys.
once("['mc','Questions'],['tr','Translation'],['both','Both']", "['mc','Multiple choice'],['tr','Translation'],['both','Translation and multiple choice']")
once("'Opens when you finish Lesson '+ROMAN[r.L-1]", "'Opens after the core work in Lesson '+ROMAN[r.L-1]")
page.write_text(source, encoding='utf-8')
