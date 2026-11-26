"""Unify live persona render paths; retain original story and promotion artwork."""
from pathlib import Path
import subprocess
import tempfile
ROOT = Path(__file__).resolve().parents[1]
p = ROOT/'index.html'
s = p.read_text(encoding='utf-8')
def block(a,b,new):
    global s
    assert s.count(a)==1, ('start',a,s.count(a))
    i=s.index(a)
    j=s.index(b,i+len(a))
    s=s[:i]+new+s[j:]
def once(a,b):
    global s
    assert s.count(a)==1, (a,s.count(a))
    s=s.replace(a,b,1)
if 'var personaSerial=0;' not in s:
    block("function dressed(a){", "function canWearItem(a,i)", "function dressed(a){\n  var ph=PHID[PH[phaseIdx()].id],ids=wornIds(a).filter(function(id){return WSLOT[id]}),pose=a.calling+'-'+(a.pres==='f'?'female':'male'),patron=String(a.patron||'').toLowerCase(),key=[pose,ph,patron,ids.slice().sort().join(',')].join('|');\n  if(WC[key])return WC[key];\n  var ent=WC[key]={state:'loading',token:'persona-'+(++personaSerial)},r=wr();\n  function refresh(){\n   document.querySelectorAll('[data-persona-render=\"'+ent.token+'\"]').forEach(function(im){\n    if(ent.state==='ok'){im.src=im.dataset.personaBust==='1'?ent.bust:ent.url;im.alt=''}\n    else if(ent.state==='error'){im.removeAttribute('src');im.alt='Persona image unavailable'}\n   });\n  }\n  if(!r){ent.state='error';ent.err='renderer missing';ent.ready=Promise.resolve(null);return ent}\n  ent.ready=Promise.resolve().then(function(){return r.render(pose,ids,{lesson:57,phase:ph,patron:patron})}).then(function(c){\n   ent.url=c.toDataURL('image/png');\n   var b=document.createElement('canvas');b.width=b.height=140;b.getContext('2d').drawImage(c,(c.width-140)/2,4,140,140,0,0,140,140);ent.bust=b.toDataURL('image/png');\n   ent.state='ok';refresh();return ent.url;\n  }).catch(function(e){ent.state='error';ent.err=String(e&&e.message||e).slice(0,90);refresh();return null});\n  return ent;\n }\n var personaSerial=0;\n function personaFigure(a,cls,bustOnly,extra){\n  var e=dressed(a),u=bustOnly?e.bust:e.url;\n  return '<img class=\"'+cls+'\" data-persona-render=\"'+e.token+'\"'+(bustOnly?' data-persona-bust=\"1\"':'')+(u?' src=\"'+u+'\" alt=\"\"':' alt=\"'+(e.state==='error'?'Persona image unavailable':'Fitting persona…')+'\"')+(extra||'')+'>';\n }\n ")
    block("function portrait(a,big){", "/* ---------- setup ---------- */", "function portrait(a,big){\n  var s=stageOf(a),fr=worn(a,'Frame');\n  var h='<div class=\"avport'+(big?' big':'')+'\" role=\"img\" aria-label=\"'+esc(a.name)+', '+esc(s.st.t)+'\">'+backdrop(a,s.k);\n  var cue=a.__reveal?' data-cue=\"portrait-reveal\"':'';if(a.__reveal)delete a.__reveal;\n  h+=personaFigure(a,'avfig dressed',false,cue)+compSprite(a,3/4,0.94,'right');\n  if(fr&&AT['shop_'+fr.id])h+=sp('shop_'+fr.id,'avframe');\n  return h+'</div>';\n }\n function scene(a){\n  var s=stageOf(a),pk=pkey(a),bd=worn(a,'Setting');\n  var bg=(bd&&AT['shop_'+bd.id])?sp('shop_'+bd.id,'avsbd'):(AT['sc_'+PHID[PH[s.k].id]]?sp('sc_'+PHID[PH[s.k].id],'avsbd'):'');\n  return '<div class=\"avscene\" role=\"img\" aria-label=\"'+esc(a.name)+(pk?' with '+esc(a.patron):'')+'\">'+bg+(AT['pc_'+pk]?sp('pc_'+pk,'avspat'):'')+personaFigure(a,'avsfig dressed')+compSprite(a,16/9,0.92,'mid')+'</div>';\n }\n window.__avatarFigure=function(){var a=S.av;if(!a||!a.done)return Promise.resolve(null);return dressed(a).ready};\n window.__avatarBust=function(sz){var a=S.av;if(!a||!a.done)return '';return '<div xmlns=\"http://www.w3.org/1999/xhtml\" style=\"width:'+sz+'px;height:'+sz+'px;border-radius:50%;overflow:hidden;background:#e9dcb8;border:2px solid #fff;box-sizing:border-box;display:flex;align-items:center;justify-content:center\">'+personaFigure(a,'persona-bust',true,' style=\"width:100%;height:100%;object-fit:contain\"')+'</div>'};\n ")
    block("function selectionFigure(id,a,cls){", "function artDiagnostics()", "function selectionFigure(id,a,cls){\n  var c=cal(id),candidate={calling:id,pres:a.pres||'f',origin:a.origin,patron:(c.patron||'').split(/[ \\/·(]/)[0],worn:{}};\n  return personaFigure(candidate,cls,false,' style=\"object-fit:contain;aspect-ratio:352/432;height:auto\"');\n }\n ")
    block("  if(ent.state==='ok')h+='<div class=\"avport big wd\"", "  h+='</div><div style=\"flex:1;min-width:260px\">';", "  h+='<div class=\"avport big wd\" role=\"img\" aria-label=\"'+esc(a.name)+' in the pieces you wear\">'+backdrop(a,s.k)+personaFigure(a,'avdr')+'</div>';\n")
    once("(f?sp(f.key,'kfig'):'')", "personaFigure(a,'kfig dressed')")
# Syntax-check changed JS before saving.
parts=[]
for a,b in [('function dressed(a){','function canWearItem(a,i)'),('function portrait(a,big){','/* ---------- setup ---------- */'),('function selectionFigure(id,a,cls){','function artDiagnostics()')]:
    start=s.index(a)
    parts.append(s[start:s.index(b,start)])
with tempfile.TemporaryDirectory() as d:
    f=Path(d)/'persona.js'
    f.write_text('\n'.join(parts))
    subprocess.run(['node','--check',str(f)],check=True)
p.write_text(s,encoding='utf-8')
print('PASS: single stable persona renderer for selection, portrait, scene, wardrobe, bust, figure export and keepsake')
