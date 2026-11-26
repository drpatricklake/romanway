#!/usr/bin/env python3
"""Fail closed on missing, unexpected or altered RomanWay artwork."""
import argparse
import hashlib
import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--graphics-only', action='store_true', help='Recovery check only; not for release')
parser.add_argument('--deployment', type=Path, help='Actual static deployment directory')
args = parser.parse_args()
def require(condition, message):
    if not condition:
        raise SystemExit('ASSET CHECK FAILED: ' + message)
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
manifest = ROOT / 'assets/manifest.json'
require(manifest.is_file(), 'assets/manifest.json missing; import the reviewed asset bundle')
m = json.loads(manifest.read_text(encoding='utf-8'))
require(m.get('schema') == 1, 'unsupported manifest schema')
entries = m['images']
paths = [e['path'] for e in entries]
require(len(paths) == len(set(paths)), 'duplicate image paths')
expected_sprites = 'backdrops bears comp compi emb frames icons legacy misc mon p1 p2 p3 p4 p5 p6 p7 patc patp pv scenes settings tryon ui wemb wlay wmask wpose'.split()
require({p for p in paths if p.startswith('assets/sprites/')} == {'assets/sprites/' + n + '.webp' for n in expected_sprites}, 'required sprite set differs')
require({p for p in paths if p.startswith('assets/textbook/sheets/')} == {f'assets/textbook/sheets/sheet{i:02d}.jpg' for i in range(14)}, 'required textbook sheet set differs')
figures = [p for p in paths if p.startswith('assets/textbook/figures/')]
require(len(figures) == 218 and len(paths) == 260, 'expected 218 figures and 260 images')
require(all(re.fullmatch(r'assets/textbook/figures/f\d+_L\d+\.jpg', p) for p in figures), 'invalid figure path')
require(len({Path(p).name.split('_')[0] for p in figures}) == 218, 'duplicate figure keys')
for e in entries:
    p = ROOT / e['path']
    require(p.is_file(), 'missing ' + e['path'])
    require(p.stat().st_size == e['bytes'] and sha(p) == e['sha256'], 'integrity mismatch ' + e['path'])
    require(e['width'] > 0 and e['height'] > 0, 'invalid declared dimensions ' + e['path'])
index = m['figure_index']
require(index['path'] == 'assets/textbook/figures-index.csv', 'unexpected figure index path')
p = ROOT / index['path']
require(p.is_file() and sha(p) == index['sha256'], 'figure index missing or changed')
routes = m['legacy_image_routes']
require(len(routes) == 41 and len(set(routes.values())) == 41, 'legacy image route mapping incomplete')
require(all(re.fullmatch(r'[0-9a-f]{32}', k) and v in paths for k,v in routes.items()), 'invalid legacy image mapping')
worksheets = m['worksheets']
require({e['lesson'] for e in worksheets} == set(range(1,7)) and len(worksheets) == 6, 'six worksheets required')
for e in worksheets:
    require(e['path'] == f"assets/worksheets/lesson-{e['lesson']:02}.pdf", 'invalid worksheet path')
    p = ROOT / e['path']
    require(p.is_file() and p.stat().st_size == e['bytes'] and sha(p) == e['sha256'] and p.read_bytes().startswith(b'%PDF-'), 'worksheet missing or altered ' + e['path'])
worksheet_routes = m['legacy_worksheet_routes']
require(len(worksheet_routes) == 6 and set(worksheet_routes.values()) == {e['path'] for e in worksheets}, 'worksheet mapping incomplete')
unresolved = m['unresolved_worksheet_blob_ids']
require(args.graphics_only or not unresolved, 'unresolved worksheet assets: ' + ', '.join(unresolved))
if args.deployment:
    deploy = args.deployment.resolve()
    html = deploy / 'index.html'
    require(html.is_file(), 'deployment index.html missing')
    content = html.read_text(encoding='utf-8')
    require(not re.search(r'/_blob/[0-9a-f]{32}', content) or (args.graphics_only and set(re.findall(r'/_blob/([0-9a-f]{32})', content)) <= set(unresolved)), 'unresolved legacy URL in deployment')
    require("im.src='/_blob/'+SHEETS[s]" not in content, 'legacy textbook loader in deployment')
    by_path = {e['path']: e for e in entries + worksheets}
    for name in set(routes.values()) | set(worksheet_routes.values()) | {'assets/textbook/figures/f168_L54.jpg'}:
        p = deploy / name
        require(p.is_file() and sha(p) == by_path[name]['sha256'], 'deployment missing or altered ' + name)
print('PASS: verified 28 sprite sheets, 14 textbook sheets and 218 figures and six worksheet PDFs; ' + ('graphics-only; not release-ready' if args.graphics_only else 'release source ready'))
