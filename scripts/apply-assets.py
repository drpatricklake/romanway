#!/usr/bin/env python3
"""Apply the reviewed assets to the generated HTML, without changing activity logic."""
import base64
import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'assets/manifest.json').read_text())

def apply(html):
    mapping = manifest['legacy_image_routes']
    sheets = re.search(r'var SHEETS=(\[[^\]]+\])', html)
    assert sheets, 'textbook sheet mapping missing'
    old = json.loads(sheets[1])
    if all(k in mapping for k in old):
        assert len(old) == 14
        html = html[:sheets.start(1)] + json.dumps(['/' + mapping[k] for k in old]) + html[sheets.end(1):]
        assert html.count("im.src='/_blob/'+SHEETS[s]") == 1
        html = html.replace("im.src='/_blob/'+SHEETS[s]", 'im.src=SHEETS[s]')
    else:
        assert old == [f'/assets/textbook/sheets/sheet{i:02d}.jpg' for i in range(14)], 'unexpected sheet map'
    taberna = re.search(r'var IMG11=(\{[^\n]+?\});', html)
    assert taberna, 'Lesson XI image mapping missing'
    taberna_id = re.fullmatch(r'@IMG(\d+)@', json.loads(taberna[1])['taberna'])
    assert taberna_id, 'Lesson XI Taberna image must be on a textbook sheet'
    draw = "    c.getContext('2d').drawImage(im,a[1],a[2],a[3],a[4],0,0,a[3],a[4]);"
    upright_draw = f"""    var ctx=c.getContext('2d');
    // Rotate the Lesson XI Taberna crop 180 degrees before encoding the image.
    if(n==={taberna_id[1]})ctx.setTransform(-1,0,0,-1,c.width,c.height);
    ctx.drawImage(im,a[1],a[2],a[3],a[4],0,0,a[3],a[4]);"""
    if upright_draw not in html:
        assert html.count(draw) == 1, 'textbook sheet draw not uniquely identified'
        html = html.replace(draw, upright_draw, 1)
    for key, path in (mapping | manifest['legacy_worksheet_routes']).items():
        html = html.replace('/_blob/' + key, '/' + path)
    remaining = set(re.findall(r'/_blob/([0-9a-f]{32})', html))
    assert remaining <= set(manifest['unresolved_worksheet_blob_ids']), 'unrecognized legacy URLs: ' + str(remaining)
    match = re.search(r'var FIGCAP2=(\{[^\n]+?\});', html)
    assert match, 'Volume II captions missing'
    caps = json.loads(match[1])
    caps['185'] = '<b>185. The Bakery of Modestus, excavated in 1862, by Giuseppe Fiorelli</b> © Melissa Toomey.'
    html = html[:match.start(1)] + json.dumps(caps, ensure_ascii=False) + html[match.end(1):]
    for n in range(154,186):
        pattern = r'(\{"k": "f'+str(n)+r'", "alt": )"Figure '+str(n)+r' from the textbook", "cap": "<b>Figure '+str(n)+r'</b>"\}'
        caption = caps[str(n)]
        title = re.search(r'<b>(.*?)</b>', caption)[1]
        html = re.sub(pattern, lambda m: m[1] + json.dumps(title, ensure_ascii=False) + ', "cap": ' + json.dumps(caption, ensure_ascii=False) + '}', html)
    assert not re.search(r'"cap": "<b>Figure (?:15[4-9]|16\d|17\d|18[0-5])</b>"',html), 'placeholder caption remains'
    jpg = base64.b64encode((ROOT/'assets/textbook/figures/f168_L54.jpg').read_bytes()).decode('ascii')
    html, count = re.subn(r'("f168": ")[A-Za-z0-9+/=]+(")',lambda m:m[1]+jpg+m[2],html)
    assert count == 1, 'Figure 168 inline image not uniquely identified'
    assert '© Melissa Toomey.' in caps['185']
    return html

if __name__ == '__main__':
    path = ROOT/'index.html'
    original = path.read_text(encoding='utf-8')
    result = apply(original)
    assert apply(result) == result, 'asset patch must be idempotent'
    path.write_text(result, encoding='utf-8')
    print('Applied named asset routes, Volume II captions and Figure 168')
