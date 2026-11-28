"""Keep deity card framing and promotion identity consistent in the avatar studio."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'index.html'
source = path.read_text(encoding='utf-8')

def replace_once(old, new):
    global source
    assert source.count(old) == 1, (old, source.count(old))
    source = source.replace(old, new, 1)

replace_once(
    ' function tabPatron(a){',
    ''' function patronCardArt(k){
  if(AT['pp_'+k])return sp('pp_'+k,'patimg');
  var url=A3('gd_'+k);
  if(!url)return '';
  // Match the painted busts in this chooser. Keep full figures in their other views.
  var crop={pales:[158,86],fortuna:[137,69],janus:[126,61]}[k];
  if(!crop)return '<img class="patimg" src="'+url+'" alt="">';
  return '<span class="patimg" style="display:block;position:relative;overflow:hidden;aspect-ratio:192/224" aria-hidden="true"><img src="'+url+'" alt="" style="position:absolute;max-width:none;width:'+crop[0]+'%;height:auto;left:'+(50-crop[1])+'%;top:0"></span>';
 }
 function tabPatron(a){''',
)
replace_once(
    """(AT['pp_'+k]?sp('pp_'+k,'patimg'):'<img class="patimg" src="'+A3('gd_'+k)+'" alt="" style="object-fit:contain">')""",
    'patronCardArt(k)',
)
replace_once(
    """Your purchases stay yours, and your tutēla stays with you.</p><div class="prestgrid">';""",
    """Your purchases stay yours, and your tutēla stays with you.</p><div class="prestid">'+personaFigure(a,'prest-bust',true)+'<b>'+esc(a.name)+'</b></div><div class="prestgrid">';""",
)
replace_once("""<div class="prestcard"><img src="'+A3('pre_'+r+'-'+(a.pres==='m'?'m':'f'))+'" alt=""><b""", """<div class="prestcard"><b""")
replace_once("""<div class="prestcard"><img src="'+selArt(a.calling,a.origin,a.pres)+'" alt=""><b""", """<div class="prestcard"><b""")
replace_once(
    '.prestcard img{height:170px;width:100%;object-fit:contain;background:#f4f1e8;border-radius:6px}',
    '.prestid{display:flex;align-items:center;gap:10px;margin:0 0 10px}.prest-bust{width:64px;aspect-ratio:1;object-fit:contain;border-radius:50%;background:#f4f1e8}',
)
path.write_text(source, encoding='utf-8')
