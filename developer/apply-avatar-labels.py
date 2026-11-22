"""Keep origin-specific English calling names beside their existing Latin titles."""
from pathlib import Path
import json
repo=Path(__file__).resolve().parent.parent
p=repo/'index.html'
s=p.read_text()
labels={
 'household':['Head of household','Household leader'],
 'priest':['Augur','Augur'],
 'baker':['Baker','Cook'],
 'service':['Enslaved household servant','Captive'],
 'farmer':['Farmer','Gardener'],
 'herder':['Shepherd','Cattle herder'],
 'stoneworker':['Stoneworker','Metalworker'],
 'metalworker':['Smith','Bronzeworker'],
 'dancer':['Artisan','Dancer'],
 'textile':['Weaver','Potter'],
 'soldier':['Foot soldier','Horse rider'],
 'hunter':['Hunter','Archer'],
 'sailor':['Fisher','Sailor'],
 'musician':['Poet','Lyre player'],
 'scribe':['Scribe','Record keeper']}
anchor=' function ctitle(a){'
assert s.count(anchor)==1
helper=' var ORIGIN_EN='+json.dumps(labels,ensure_ascii=False,separators=(',',':'))+';\n function callingEnglish(id,a){var names=ORIGIN_EN[id];return names?names[a.origin===\'latin\'?0:1]:(cal(id)||{}).name||\'\'}\n'
s=s.replace(anchor,helper+anchor,1)
# Only student-facing setup/portrait labels; leave the shared catalogue untouched.
start=s.index(' function setup(') if ' function setup(' in s else s.rfind('\n function ',0,s.index('Choose your calling</h1>'))
end=s.index(' function itemsFor(a)',start)
part=s[start:end]
assert part.count('esc(c.name)')==2
s=s[:start]+part.replace('esc(c.name)','esc(callingEnglish(c.id,a))')+s[end:]
old="esc(s.c.name)+(a.prestige?"
assert s.count(old)==1
s=s.replace(old,"esc(callingEnglish(s.c.id,a))+(a.prestige?",1)
p.write_text(s)
