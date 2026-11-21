from pathlib import Path
import csv,json,re
root=Path(__file__).resolve().parent
cat=json.loads((root/'nle-corrections.json').read_text())
def plain(v):return re.sub('<[^>]+>','',str(v or ''))
fields=['type','id','lesson','category','issue','before_question','before_options','before_answer','after_question','after_options','after_answer','explanation']
rows=[]
for kind,changes in [('bank',cat['bank']),('fixed set',cat['sets'])]:
 for c in changes:
  b,a=c['before'],c['after']
  rows.append(dict(type=kind,id=c.get('id',str(c.get('set'))+':Q'+str(c.get('index',0)+1)),lesson=a.get('L',''),category=c.get('kind',''),issue=c['reason'],before_question=plain(b.get('q')),before_options=' | '.join(plain(x) for x in b['o']),before_answer=plain(b['o'][b['a']]),after_question=plain(a.get('q')),after_options=' | '.join(plain(x) for x in a['o']),after_answer=plain(a['o'][a['a']]),explanation=plain(a.get('e'))))
for c in cat['passages']:
 rows.append(dict(type='passage',id=c['set']+':'+c['field']+(':'+str(c['index']+1) if 'index' in c else ''),issue=c['reason'],before_question=c.get('before',''),after_question=c['after']))
for c in cat['glosses']:rows.append(dict(type='gloss',id=c['set']+':line'+str(c['line']),after_question=c['text']))
with (root/'NLE-CORRECTIONS.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
print('Exported',len(rows),'editorial rows; these are not all incorrect answer keys.')
