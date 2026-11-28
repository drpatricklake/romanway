"""Connect the Forum homepage to the existing civic, academic, and persona views."""
from pathlib import Path

root = Path(__file__).resolve().parent
page = root.parent / 'index.html'
source = page.read_text(encoding='utf-8')


def once(old, new):
    global source
    assert source.count(old) == 1, old[:100]
    source = source.replace(old, new, 1)


once("else if(V.screen==='avatar')body=screenAvatar();", "else if(V.screen==='avatar'||V.screen==='tabernae'||V.screen==='arca')body=screenAvatar();")
once("  var a=A();\n  if(!artDiagnostics()", """  var a=A();
  if(PUBLIC_PRACTICE&&V.screen==='tabernae')return '<main class="wrap"><div class="crumb"><button class="link" data-act="home">Forum</button></div>'+
   '<h1>Tabernae</h1>'+(a.done?tabMarket(a):'<p>Choose your Persōna to shop for its clothing and equipment.</p><button class="btn" data-act="open-avatar">Choose your Persōna</button>')+'</main>';
  if(PUBLIC_PRACTICE&&V.screen==='arca'){
   var names=Object.keys(a.owned).filter(function(id){return a.owned[id]}).map(function(id){
    var item=D.items.find(function(i){return i.id===id});
    return item?iname(item):(CBY[cid(id)]||{}).name||id;
   });
   return '<main class="wrap"><div class="crumb"><button class="link" data-act="home">Forum</button></div><h1>Arca</h1>'+
    '<section class="panel"><h2>Dēnāriī</h2><p><b>'+bal()+'</b> denarii</p></section>'+
    '<section class="panel"><h2>Rēs <span class="note">(Possessions)</span></h2>'+
    (names.length?'<ul>'+names.map(function(name){return '<li>'+esc(name)+'</li>'}).join('')+'</ul>':'<p>No possessions yet.</p>')+
    '<button class="btn ghost" data-act="forum-persona-tab" data-t="wardrobe">Vestīmenta (Wardrobe)</button></section></main>';
  }
  if(!artDiagnostics()""")
once(" function compOf(a){var id=cid(a.worn.Companion||'');return a.owned[id]&&CBY[id]?CBY[id]:null}", """ function compOf(a){var id=cid(a.worn.Companion||'');return a.owned[id]&&CBY[id]?CBY[id]:null}
 window.__tablinumCompanion=function(){
  var a=S.av,c=a&&a.done&&compOf(a);
  return c?'<section class="panel fh-companion"><h2>Comes <span class="note">(Companion)</span></h2>'+
   sp('cp_'+c.id,'','width:90px')+'<p>'+esc(c.name||c.id)+'</p></section>':'';
 };""")
once("""function tabs(){var t=[['portrait','Portrait'],['path','Your path'],['wardrobe','Wardrobe'],['market','Market'],['comp','Companions'],['patron','Tutēla']].concat""",
     """function tabs(){var t=(PUBLIC_PRACTICE?
  [['portrait','Effigiēs (Portrait)'],['path','Aetātēs (Stages)'],['wardrobe','Vestīmenta (Wardrobe)'],['market','Tabernae (Market)'],['comp','Comitēs (Companions)'],['patron','Tutēla (Guardian)']]:
  [['portrait','Portrait'],['path','Your path'],['wardrobe','Wardrobe'],['market','Market'],['comp','Companions'],['patron','Tutēla']]).concat""")
once(""">Your avatar</h1>'+tabs()""", """>'+(PUBLIC_PRACTICE?'Persōna':'Your avatar')+'</h1>'+tabs()""")
once("""<h1 style="font-size:2.1rem;margin-bottom:.1em">Choose your calling</h1>""",
     """<h1 style="font-size:2.1rem;margin-bottom:.1em">'+(PUBLIC_PRACTICE?'Choose your Persōna':'Choose your calling')+'</h1>""")
once(""">Portrait</button><button data-act="av-view" data-v="scene" aria-pressed="'+sc+'">Scene with tutēla</button>""",
     """">'+(PUBLIC_PRACTICE?'Effigiēs (Portrait)':'Portrait')+'</button><button data-act="av-view" data-v="scene" aria-pressed="'+sc+'">'+(PUBLIC_PRACTICE?'Scaena cum Tutēlā (Scene)':'Scene with tutēla')+'</button>""")
once("RANKS:RANKS,VIR:VIR};", "RANKS:RANKS,VIR:VIR,signature:sigOf};")
start = source.index("  var g=sigOf();\n  if(g){var gq=")
end = source.index("  h+='<div class=\"xpgrid\">", start)
honors = source[start:end]
source = source[:start] + "  var g=sigOf();\n  if(!PUBLIC_PRACTICE)h+=signatureHonors(m);\n" + source[end:]
once(" screenVirtutes=function(){var m=compute(),r=rankOf(m),ep=epithet(m),x=xs();", """ function signatureHonors(m){
  var x=xs(),h='';
""" + honors + """  return h;
 }
 window.__signatureHonors=function(){return signatureHonors(compute())};
 screenVirtutes=function(){var m=compute(),r=rankOf(m),ep=epithet(m),x=xs();""")
once("if(DM.room==='atrium')return h+atrium()+'</main>';", """if(DM.room==='atrium')return h+atrium()+(PUBLIC_PRACTICE?'<section aria-label="Honōrēs (Honors)"><h2>Honōrēs</h2>'+
   (window.__signatureHonors()||'<p>Choose your Persōna to discover its honors.</p>')+'</section>':'')+'</main>';""")
once("return h+record()+'</main>'};", "return h+(PUBLIC_PRACTICE?window.__tablinumCompanion():'')+record()+'</main>'};")
once("function roomTabs(){var R=[['tablinum','Tablinum'],['atrium','Atrium'],['lararium','Lararium']];", """function roomTabs(){var R=PUBLIC_PRACTICE?
  [['tablinum','Tablīnum (Study)'],['atrium','Ātrium (Hall)'],['lararium','Larārium (Shrine)']]:
  [['tablinum','Tablinum'],['atrium','Atrium'],['lararium','Lararium']];""")
once(" function tabToday(){", " function tabToday(compact){")
once("""rec=f.day[k]||{},h='<div class="panel"><p class="note" style="margin:0">Today, by the Roman reckoning, is""",
     """rec=f.day[k]||{},h=compact?'':'<div class="panel"><p class="note" style="margin:0">Today, by the Roman reckoning, is""")
once(" screenForum=function(){\n  sync();", """ window.__civicForum={
  date:function(){return romanDate(new Date())},
  saying:function(){return tabToday(true)},
  monuments:function(){
   var recorded=F().mon,earned=D.MONS.filter(function(m){return recorded[m.id]}).sort(function(a,b){return recorded[a.id]-recorded[b.id]});
   return {earned:earned.length,total:D.MONS.length,latest:earned.at(-1)};
  }
 };
 screenForum=function(){
  sync();""")

# A Forum learner sees a new chisel notice on the guided notes that earned it.
once(" function refresh(){var c=cx(),first=!c.init,any=false;", """ var moment=null;
 function refresh(){var c=cx(),first=!c.init,any=false;
  var inNotes=V.screen==='lesson'&&V.tab==='notes';
  if(moment&&(!inNotes||V.lesson!==moment.lesson))moment=null;""")
once("if(!first)c.fresh.push(+i)", """if(!first){
    if(!PUBLIC_PRACTICE)c.fresh.push(+i);
    else if(inNotes){moment=moment||{lesson:V.lesson,ids:[]};moment.ids.push(+i)}
   }""")
once("function freshText(){var c=cx(),f=c.fresh;", "function freshText(f){")
once("function banner(cls){var c=cx();if(!c.fresh.length)return '';", """function banner(cls){
  var f=PUBLIC_PRACTICE?(cls==='cxlesson'&&moment?moment.ids:[]):cx().fresh;
  if(!f.length)return '';""")
once("'+freshText()+'</div>", "'+freshText(f)+'</div>")
once("A['codex-dismiss']=function(){cx().fresh=[];", "A['codex-dismiss']=function(){moment=null;cx().fresh=[];")
once("A['codex-open']=function(){cx().fresh=[];", "A['codex-open']=function(){moment=null;cx().fresh=[];")

once("\nrender();\n})();\n</script>\n<script type=\"module\" src=\"/app-bootstrap.js\"",
     "\n"+(root/'forum-home.js').read_text(encoding='utf-8')+
     "\nrender();\n})();\n</script>\n<script type=\"module\" src=\"/app-bootstrap.js\"")
page.write_text(source, encoding='utf-8')
