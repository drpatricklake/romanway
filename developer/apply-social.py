from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent
page=root.parent/'index.html'
s=page.read_text();patch=json.loads((root/'social-integration.json').read_text())
assert hashlib.sha256(s.encode()).hexdigest()==patch['source_sha256'],'Unexpected integration baseline'
lines=s.splitlines(keepends=True)
for op in reversed(patch['changes']):lines[op['start']:op['end']]=op['lines']
page.write_text(''.join(lines))
