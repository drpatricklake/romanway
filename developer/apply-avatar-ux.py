from pathlib import Path
p=Path(__file__).resolve().parents[1]/'index.html'
s=p.read_text(encoding='utf-8')
def replace(old,new):
    global s
    assert s.count(old)==1, 'Expected exactly one match: '+old[:100]
    s=s.replace(old,new)
replace(' function setup(){\n  var a=A(),h=', ''' function selectionFigure(id,a,cls){
  var candidate={calling:id,pres:a.pres||'f',origin:a.origin},f=artFor(candidate);
  if(f)return sp(f.key,cls);
  var u=selArt(id,candidate.origin,candidate.pres);
  return u?'<img class="'+cls+'" src="'+u+'" alt="">':'';
 }
 function artDiagnostics(){return new URLSearchParams(window.location.search).get('devArt')==='1'}
 function setup(){
  var a=A(),h=''')
replace("im=selArt(c.id,a.origin,a.pres||'f'),","")
replace("""(im?'<img class="avc-img" src="'+im+'" alt="">':'')""","selectionFigure(c.id,a,'avc-img')")
replace("""(selArt(c.id,a.origin,a.pres)?'<img src="'+selArt(c.id,a.origin,a.pres)+'" alt="">':'')""","selectionFigure(c.id,a,'avsel-img')")
replace('.avsel img{','.avsel .avsel-img{')
replace('.avcard .avc-img{','.avcard .sp.avc-img{aspect-ratio:auto}.avsel .sp.avsel-img{height:auto;flex:none}.avcard .avc-img{')
replace(".concat([['art','Art status']])",".concat(artDiagnostics()?[['art','Art status']]:[])")
replace('>Scene</button>','>Scene with tutēla</button>')
replace("var a=A();\n  if(!a.done)return setup();","var a=A();\n  if(!artDiagnostics()&&V.avTab==='art')V.avTab='portrait';\n  if(!a.done)return setup();")
replace("Ac['av-tab']=function(t){V.avTab=t.dataset.t;go()};","Ac['av-tab']=function(t){V.avTab=t.dataset.t==='art'&&!artDiagnostics()?'portrait':t.dataset.t;go()};")
p.write_text(s,encoding='utf-8')
print('Applied avatar selection consistency, scene label and opt-in art diagnostics')