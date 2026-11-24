"""Atrium rewards: the screen stops computing and awarding XP in the browser.

Runs after apply-social.py. Every change is an exact-once replacement, so the build fails if the page changes underneath it.
  * XP comes only from the server ledger (entries written by api/atrium-rewards.js); nothing a browser stores counts.
  * After a reply, a helpful mark, a completed lesson, or follow-up practice, the page asks the server to settle a few named items.
  * Other students' "I'm helping with this" claims are read from the thread, where classmates can see them.
  * A page left open across the update gets a clear "reload" message instead of a bare error code.
"""
from pathlib import Path
root = Path(__file__).resolve().parent
repo = root.parent
s = (repo / 'index.html').read_text()


def replace_once(old, new):
    global s
    assert s.count(old) == 1, (old[:100], s.count(old))
    s = s.replace(old, new, 1)


def replace_between(start, end, new):
    global s
    assert s.count(start) == 1 and s.count(end) == 1, (start[:70], s.count(start), end[:70], s.count(end))
    a = s.index(start)
    b = s.index(end, a)
    s = s[:a] + new + s[b:]


# 1. a new record is no longer seeded from the old local total
replace_once("earned:['lib','con'].map(function(v){var xp=S.xp&&S.xp.atr&&+S.xp.atr[v]||0;return xp>0?{k:'legacy:'+v,v:v,xp:xp,why:'legacy',day:dayOf(Date.now()),t:Date.now()}:null}).filter(Boolean),done:{}",
             "earned:[],done:{}")

# 2. "have" now means "the ledger says so"; local awarding is gone
replace_once("function have(k){return (mine().earned||[]).some(function(e){return e.k===k})}",
             "function have(k){var m=/^fu:(\\d+)$/.exec(k);return !!m&&(mine().earned||[]).some(function(e){return e.why==='followup'&&+e.lesson===+m[1]})}")
replace_between(" function newAwards(){", " function totals(){", " function newAwards(){return []}\n")

# 3. syncing keeps the profile current, then asks the server to settle; XP totals come from the ledger and are marked as such
replace_once("""  var add=newAwards();if(add.length)changed=true;
  if(!changed){totals();return Promise.resolve()}
  return save(function(x){x.done=done;x.mastered=mu;x.earned=(x.earned||[]).concat(add)},true)}""",
"""  if(!changed){totals();settleMine();return Promise.resolve()}
  return save(function(x){x.done=done;x.mastered=mu},true).then(function(saved){if(saved!==false)settleMine();return saved})}""")
replace_between(" function totals(){", " /* ---------- capturing what the student is stuck on", """ function totals(){var lib=0,con=0;(mine().earned||[]).forEach(function(e){if(e.v==='lib')lib+=e.xp;else if(e.v==='con')con+=e.xp});var x=S.xp=S.xp||{};x.atr={lib:lib,con:con,src:'ledger',t:Date.now()};persist()}
 function award(){return Promise.resolve()}
 function friendlyErr(e){var c=e&&(e.code||e.status);if(c==='permission-denied')return 'Your account could not access this Atrium item. Reload and try again; if it continues, contact your instructor.';if(c===429)return 'Please wait a moment and try again.';return 'Something went wrong. Try again in a moment.'}
 /* the server decides what is earned; the page only names which items to look at */
 function serverSettle(h){var s=window.RomanWayData&&window.RomanWayData.social;return s&&s.settle?s.settle(h):Promise.resolve({awarded:[],applied:0})}
 var SETTLING=false;
 function settleMine(extra){
  var social=window.RomanWayData&&window.RomanWayData.social;
  if(!AT.me)return Promise.resolve();
  if(SETTLING&&SETTLING.me===AT.me&&SETTLING.social===social){
   var pending=SETTLING;return pending.promise.then(function(){
    if(AT.me===pending.me&&window.RomanWayData&&window.RomanWayData.social===social)return settleMine(extra)
   })
  }
  var qs={},cl={},me=AT.me;
  (mine().asks||[]).slice(-5).forEach(function(a){qs[me+'_'+a.id]=1});
  (mine().replies||[]).slice(-5).forEach(function(r){qs[r.to+'_'+r.ask]=1});
  clientsOf(me).forEach(function(c){cl[c]=1});
  if(myPatron())cl[me]=1;
  var h={questions:Object.keys(qs).slice(0,10),clients:Object.keys(cl).slice(0,2),followups:(extra&&extra.followups)||[]};
  if(!h.questions.length&&!h.clients.length&&!h.followups.length)return Promise.resolve();
  var task={me:me,social:social};SETTLING=task;
  task.promise=serverSettle(h).then(function(r){if(SETTLING===task)SETTLING=false;
   if(AT.me!==me||!window.RomanWayData||window.RomanWayData.social!==social)return null;
   return r&&r.applied>0?reloadLedger(me,social):null
  },function(e){if(SETTLING===task)SETTLING=false;return null}).catch(function(){return null});return task.promise}
 function reloadLedger(me,social){return social.db.collection('atrium-ledger').get().then(function(q){
  if(AT.me!==me||!window.RomanWayData||window.RomanWayData.social!==social)return;
  Object.keys(AT.docs).forEach(function(k){AT.docs[k].earned=[]});
  q.docs.forEach(function(d){var o=AT.docs[d.id]||(AT.docs[d.id]={});o.earned=(d.data()||{}).earned||[]});totals();if(!AT.reply&&AT.tab!=='ask')render(true)
 })}
""")

# 4. XP counts toward the virtues only when it came from the ledger; the old local total is ignored
replace_once("var atr=xs().atr||{};v.liberalitas+=atr.lib||0;v.constantia+=atr.con||0;",
             "var atr=xs().atr||{};if(atr.src==='ledger'){v.liberalitas+=atr.lib||0;v.constantia+=atr.con||0}")

# 5. follow-up practice: record the completion, then ask the server whether it earns
replace_once("A['at-fu-check']=function(){var F=AT.fu;if(!F)return;F.done=true;if(F.eligible&&!have('fu:'+F.L)){F.award=true;award('fu:'+F.L,'con',XP_FOLLOWUP,{why:'followup',lesson:F.L})}else render()};",
"""A['at-fu-check']=function(){var F=AT.fu;if(!F)return;F.done=true;
   if(F.eligible&&!have('fu:'+F.L)){
    getDb().then(function(db){return db?db.doc('followups/'+F.L).set({}):null}).then(function(){return settleMine({followups:[F.L]})}).then(function(){F.award=have('fu:'+F.L);render(true)},function(e){AT.msg=friendlyErr(e);render()})
   }else render()};""")

# 6. a helpful mark is followed by a request to settle it
replace_once("d.thanks=d.thanks.concat([{reply:r,helper:h,ask:a,t:Date.now()}])})};",
             "d.thanks=d.thanks.concat([{reply:r,helper:h,ask:a,t:Date.now()}])}).then(function(){return settleMine()})};")

# 7. claims are read from the thread, where classmates can see them
replace_between(" function claimsOn(", " function noteHtml(",
" function claimsOn(asker,askId){var out=[];((AT.docs[asker]||{}).claims||[]).forEach(function(c){if(c.ask===askId&&c.uid!==AT.me&&Date.now()-c.t<CLAIM_MIN*60000)out.push({uid:c.uid,t:c.t})});return out}\n")

# 8. the instructor's view: the start of server rewards, reviewed starting balances, and no zero-XP rows
replace_once("AT.set={approve:d.approve!==false,ok:d.ok||{},hidden:d.hidden||{}}", "AT.set={approve:d.approve!==false,ok:d.ok||{},hidden:d.hidden||{},rewardsFrom:d.rewardsFrom}")
replace_once("Account names appear only in this tab.</p></div>';",
             "Account names appear only in this tab.</p>'+(AT.set.rewardsFrom?'':'<p class=\"note\" style=\"margin:.5em 0 0\"><b>Server rewards have not started.</b> No XP is paid until the developer reviews the starting balances and sets the start time (see docs/atrium-mapping.md).</p>')+'</div>';")
replace_once("(AT.docs[k].earned||[]).forEach(function(e){led.push({uid:k,e:e})})", "(AT.docs[k].earned||[]).forEach(function(e){if(e.xp>0)led.push({uid:k,e:e})})")
replace_once("followup:'Follow-up practice'}[x.e.why]", "followup:'Follow-up practice',baseline:'Starting balance (reviewed)'}[x.e.why]")

# 9. Permission failures do not by themselves prove that a page is outdated.
replace_once("The Atrium could not be loaded ('+esc(AT.err)+').",
             "'+(AT.err==='permission-denied'?'Your account could not access this Atrium item. Reload and try again; if it continues, contact your instructor.':'The Atrium could not be loaded ('+esc(AT.err)+').')+'")

# Save outcomes are explicit: never discard a reply draft after a rejected write.
replace_once("AT.docs[AT.me]=d;AT.msg='';totals()", "AT.docs[AT.me]=d;AT.err='';AT.msg='';totals();return true")
replace_once("function(e){AT.err=code(e)})}).then(function(){if(!quiet)render(true)})}",
             "function(e){AT.err='';AT.msg=friendlyErr(e);return false})}).then(function(saved){if(!quiet)render(true);return saved})}")
replace_once("}).then(function(){AT.reply=null;AT.msg='';return sync()}).then(function(){render(true)})};",
             "}).then(function(saved){if(!saved){render(true);return}AT.reply=null;AT.msg='';return sync()}).then(function(){render(true)})};")
(repo / 'index.html').write_text(s)

# Discussion reads are the loading boundary. Progress writes and real-name lookup follow in the background.
replace_once(".then(function(){AT.loaded=true;return sync()}).then(function(){", ".then(function(){AT.loaded=true;AT.syncing=true;var me=AT.me,social=window.RomanWayData&&window.RomanWayData.social;var started=Date.now();Promise.resolve().then(sync).catch(function(){return false}).then(function(saved){if(AT.me!==me||!window.RomanWayData||window.RomanWayData.social!==social)return;AT.syncing=saved===false?'failed':false;AT.syncMs=Date.now()-started;if(!AT.reply&&AT.tab!=='ask')render(true)});return null}).then(function(){")
replace_once("if(AT.canEdit&&u.profiles)return u.profiles(Object.keys(AT.docs)).then(function(ps){AT.real={};Object.keys(ps||{}).forEach(function(k){AT.real[k]=(ps[k]&&ps[k].name)||''})},function(){})", "if(AT.canEdit&&u.profiles){var me=AT.me,social=window.RomanWayData&&window.RomanWayData.social;u.profiles(Object.keys(AT.docs)).then(function(ps){if(AT.me!==me||!window.RomanWayData||window.RomanWayData.social!==social)return;AT.real={};Object.keys(ps||{}).forEach(function(k){AT.real[k]=(ps[k]&&ps[k].name)||''});if(!AT.reply&&AT.tab!=='ask')render(true)},function(){})}")
replace_once("A['at-reply']=function(t){AT.reply=", "A['at-reply']=function(t){if(AT.syncing&&!AT.canEdit){AT.msg=AT.syncing==='failed'?'Your lesson eligibility could not be updated. Select Refresh to retry.':'Updating your lesson eligibility. Please wait a moment.';render();return}AT.reply=")
# Keep the queue visible, but do not start a claim before the mastery profile reaches Firebase.
replace_once("else if(!open)ex+=", "else if(AT.syncing&&!AT.canEdit)ex+='<p class=\"note\">'+(AT.syncing==='failed'?'Your lesson eligibility could not be updated. Select Refresh to retry.':'Updating your lesson eligibility…')+'</p>';else if(!open)ex+=")
# On-device timing contains durations and operation labels only, never names, answers or identifiers.
replace_once("if(AT.busy)return;AT.busy=true;AT.err=null;", "if(AT.busy)return;AT.busy=true;AT.err=null;AT.openedAt=Date.now();")
replace_once(".then(function(){AT.busy=false;render(true)})}", ".then(function(){AT.busy=false;AT.readMs=Date.now()-AT.openedAt;render(true)})}")
replace_once("var h=art+'<div class=\"panel\"><h2 style=\"margin:0 0 .3em;font-size:1.3rem\">The Atrium", "var diag=window.RomanWayAtriumTiming||{};var h=art+(AT.loaded?'<details class=\"panel\"><summary>Loading diagnostics</summary><pre>'+esc(JSON.stringify({discussionMs:AT.readMs,eligibilityMs:AT.syncing?'updating':AT.syncMs,database:diag},null,2))+'</pre></details>':'')+'<div class=\"panel\"><h2 style=\"margin:0 0 .3em;font-size:1.3rem\">The Atrium")
# Ignore late save callbacks after sign-out/account changes.
replace_once("return db.doc('atrium/'+AT.me).set(d).then(function(){AT.docs[AT.me]=d;",
             "var savingMe=AT.me,savingSocial=window.RomanWayData&&window.RomanWayData.social;return db.doc('atrium/'+savingMe).set(d).then(function(){if(AT.me!==savingMe||!window.RomanWayData||window.RomanWayData.social!==savingSocial)return false;AT.docs[savingMe]=d;")
replace_once("function(e){AT.err='';AT.msg=friendlyErr(e);return false}",
             "function(e){if(AT.me!==savingMe||!window.RomanWayData||window.RomanWayData.social!==savingSocial)return false;AT.err='';AT.msg=friendlyErr(e);return false}")
(repo / 'index.html').write_text(s)
