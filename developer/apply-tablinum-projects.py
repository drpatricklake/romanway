"""Keep the course's project workspaces in the Tablīnum in both editions."""
from pathlib import Path

page = Path(__file__).resolve().parents[1] / 'index.html'
source = page.read_text(encoding='utf-8')


def once(old, new):
    global source
    assert source.count(old) == 1, old[:90]
    source = source.replace(old, new, 1)


# Remove the old project list and its lesson-tab injection.
start = source.index('function projWs(L){')
end = source.index('/* ================= NLE-style practice engine', start)
assert "t.push(['proj','Projects'" in source[start:end]
source = source[:start] + source[end:]
once("  else if(tb==='proj')h+=tabProj();\n", '')
legacy_body = "  if(tb==='proj')return tabProj();\n"
assert source.count(legacy_body) == 2
source = source.replace(legacy_body, '')

# Keep the interactive renderers and state in place while registering them as room activities.
section = '/* ================= Caesar Dicit (crossword, Lesson XLVII) and ORBIS (journey, Lesson LI) ================= */'
once(section, 'var TABLINUM_PROJECTS=[];\n\n' + section)
start = source.index(' /* ---------- register the two tabs ---------- */')
end = source.index(" /* ---------- Grimm's Law", start)
assert "addTab(47,'crossword'" in source[start:end] and "addTab(51,'orbis'" in source[start:end]
source = source[:start] + """ TABLINUM_PROJECTS.push(
  {l:47,tab:'crossword',name:'Caesar Dicit: a crossword',body:cwBody,done:function(){return !!(S.cw47&&S.cw47.done)}},
  {l:51,tab:'orbis',name:'ORBIS: an imperial commission',body:orbisBody,done:function(){return !!(S.orbis&&S.orbis.final)}}
 );

""" + source[end:]
once(
    " addTab(35,'grimm','Grimm’s Law',grBody,function(){return !!(S.grimm&&S.grimm.done)},['gate','ladder','etym']);",
    " TABLINUM_PROJECTS.push({l:35,tab:'grimm',name:'Grimm’s Law: how sounds shift',body:grBody,done:function(){return !!(S.grimm&&S.grimm.done)}});",
)
once(
    'In Lesson XXXV you will find the rule behind it, which is called Grimm’s Law.',
    'The Grimm’s Law project for Lesson XXXV is in the Tablīnum.',
)
once(
    """  Ac['open-orbis']=function(){Ac['open-lesson']({dataset:{l:'51'}});V.tab='orbis';render(true);window.scrollTo(0,0)};""",
    """  Ac['open-orbis']=function(){Ac['dm-proj']({dataset:{l:'51',tab:'orbis'}})};""",
)

once("var DM={room:'tablinum',sub:'record',lf:null", "var DM={room:'tablinum',sub:'record',project:null,lf:null")
start = source.index(" var EXTRA=[{l:35,tab:'grimm'")
end = source.index('\n', start)
assert "tab:'orbis'" in source[start:end]
source = source[:start] + source[end+1:]
once("The projects of the course. Each opens in its own lesson.", "Open a project to work on it here.")
once(
    """  var rows=EXTRA.map(function(e){return {l:e.l,n:e.n,done:e.done(),act:'data-act="dm-proj" data-l="'+e.l+'" data-tab="'+e.tab+'"'}}).concat(projWs().map(function(w){return {l:w.lesson,n:(w.code?w.code+' ':'')+w.title,done:wsStatus(w)==='done',act:'data-act="ws-open" data-id="'+w.id+'"'}}));""",
    """  var rows=TABLINUM_PROJECTS.map(function(p){
   return {l:p.l,n:p.name,status:p.done()?'done':'new',act:'data-act="dm-proj" data-l="'+p.l+'" data-tab="'+p.tab+'"'};
  }).concat(projWs().map(function(w){
   return {l:w.lesson,n:(w.code?w.code+' ':'')+w.title,status:wsStatus(w),act:'data-act="dm-proj" data-id="'+w.id+'"'};
  }));""",
)
once(
    """  return h+rows.map(function(r){return '<div class="dmrow"><div style="flex:1 1 220px"><b>'+esc(r.n)+'</b><div class="note">'+lname(r.l)+'</div></div>'+(r.done?'<span class="chip ok">Done</span>':'')+'<button class="btn sm" '+r.act+'>Open</button></div>'}).join('')}""",
    """  return h+rows.map(function(r){
   var status=r.status==='done'?'<span class="chip ok">Done</span>':(r.status==='started'?chipFor(r.status):'');
   return '<div class="dmrow"><div style="flex:1 1 220px"><b>'+esc(r.n)+'</b><div class="note">'+lname(r.l)+'</div></div>'+status+
    '<button class="btn sm" '+r.act+' aria-label="Open '+esc(r.n)+'">Open</button></div>';
  }).join('')}""",
)
once("window.__domusRoom=function(r){DM.room=r;", "window.__domusRoom=function(r){DM.room=r;DM.project=null;")
once(
    """  if(DM.room==='lararium')return h+lararium()+'</main>';""",
    """  if(DM.room==='lararium')return h+lararium()+'</main>';
  if(DM.project){
   return h+'<div class="crumb"><button class="link" data-act="dm-sub" data-s="proj">All projects</button></div>'+
    '<p class="note">'+lname(DM.project.l)+'</p>'+DM.project.body()+'</main>';
  }""",
)
once(
    """    :'<div class="crumb"><button class="link" data-act="ws-back">All worksheets</button></div>""",
    """    :'<div class="crumb"><button class="link" data-act="ws-back">'+(ws.project?'All projects':'All worksheets')+'</button></div>""",
)
once(
    """ var _la=labActs;labActs=function(A){_la(A);
  A['open-domus']=function(t){V.screen='domus';V.ws=null;if(t&&t.dataset&&t.dataset.r)DM.room=t.dataset.r;if(!DM.loaded)load();window.scrollTo(0,0);render(true)};
  A['open-virtutes']=function(){V.screen='domus';V.ws=null;DM.room='tablinum';DM.sub='record';window.scrollTo(0,0);render(true)};
  A['dm-room']=function(t){DM.room=t.dataset.r;V.ws=null;render(true)};
  A['dm-sub']=function(t){DM.sub=t.dataset.s;V.ws=null;render(true)};
  A['dm-ws']=function(t){DM.lf=t.dataset.l;V.screen='domus';V.ws=null;DM.room='tablinum';DM.sub='ws';if(!DM.loaded)load();window.scrollTo(0,0);render(true)};
  A['dm-proj']=function(t){A['open-lesson']({dataset:{l:t.dataset.l}});V.tab=t.dataset.tab;render(true);window.scrollTo(0,0)};""",
    """ function clearTablinumItem(){DM.project=null;V.ws=null;V.mapSel=null}
 function enterTablinum(sub){
  clearTablinumItem();
  V.screen='domus';DM.room='tablinum';DM.sub=sub;
 }
 var _la=labActs;labActs=function(A){_la(A);
  A['open-domus']=function(t){V.screen='domus';clearTablinumItem();if(t&&t.dataset&&t.dataset.r)DM.room=t.dataset.r;if(!DM.loaded)load();render(true)};
  A['open-virtutes']=function(){enterTablinum('record');render(true)};
  A['dm-room']=function(t){DM.room=t.dataset.r;clearTablinumItem();render(true)};
  A['dm-sub']=function(t){DM.sub=t.dataset.s;clearTablinumItem();render(true)};
  A['dm-ws']=function(t){DM.lf=t.dataset.l;enterTablinum('ws');if(!DM.loaded)load();render(true)};
  A['dm-proj']=function(t){
   var w=wsById(t.dataset.id);
   var p=TABLINUM_PROJECTS.find(function(p){return p.l===+t.dataset.l&&p.tab===t.dataset.tab});
   if(!(w&&w.project)&&!p)return;
   enterTablinum('proj');
   if(w&&w.project)V.ws=w.id;
   else DM.project=p;
   if(!DM.loaded)load();
   render(true);
  };""",
)
once(
    """ 'ws-open':function(t){V.ws=t.dataset.id;V.mapSel=null;render(true)},""",
    """ 'ws-open':function(t){
  var w=wsById(t.dataset.id);
  if(w&&w.project)return ACT['dm-proj'](t);
  V.ws=t.dataset.id;V.mapSel=null;render(true);
 },""",
)
once(
    """if(window.__domus.room==='tablinum'&&!V.ws){var assigned=pilotAssignments();""",
    """if(window.__domus.room==='tablinum'&&!V.ws&&!window.__domus.project){var assigned=pilotAssignments();""",
)

page.write_text(source, encoding='utf-8')
