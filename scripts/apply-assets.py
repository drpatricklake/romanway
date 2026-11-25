#!/usr/bin/env python3
"""Apply the reviewed assets to generated HTML without changing activity logic."""
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
    for key, path in mapping.items():
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
