"""Expose lesson requirements from the original completion expressions."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
page = root.parent / 'index.html'
html = page.read_text(encoding='utf-8')

def once(old, new):
    global html
    assert html.count(old) == 1, old[:100]
    html = html.replace(old, new, 1)

def split_parts(array):
    out, start, depth, quote = [], 0, 0, None
    for i, c in enumerate(array):
        if quote:
            if c == quote and array[i - 1] != '\\':
                quote = None
        elif c in "'\"":
            quote = c
        elif c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
        elif c == ',' and depth == 0:
            out.append(array[start:i].strip())
            start = i + 1
    out.append(array[start:].strip())
    return out

def part(code, kind, refs=(), count=None):
    return 'lessonPartStatus(' + code + ',' + json.dumps(kind) + ',' + json.dumps(refs) + (',' + str(count) if count else '') + ')'

def describe(code):
    if code.startswith('notesStatus('):
        return part(code, 'notes', ['notes'])
    if code.startswith('vocabStatus('):
        return part(code, 'vocab', ['vocab'])
    if code.startswith('ladderStatus('):
        return part(code, 'ladder', ['ladder'])
    if code.startswith('nleState('):
        return part(code, 'nle', ['nle'])
    if match := re.fullmatch(r"labDone\('([^']+)'\)>=(\d+)", code):
        return part(code, 'lab', [match[1]], int(match[2]))
    if 'rdState().tr' in code:
        return part(code, 'reading', ['read'])
    if 'S.ws.' in code:
        return part(code, 'worksheets', list(dict.fromkeys(re.findall(r'S\.ws\.(\w+)', code))))
    if "a.ref==='l3C'" in code:
        return part(code, 'activity', ['l3C'])
    drills = re.findall(r"okRef(?:Of)?\('([^']+)'\)", code)
    sets = re.findall(r"(?:sp|setProgress)\('([^']+)'\)", code)
    if code.startswith('['):
        sets.extend(re.findall(r"'([^']+)'", code.split('].every')[0]))
    refs = list(dict.fromkeys([*drills, *sets]))
    if refs:
        specs = [[ref, 'drill' if ref in drills else 'set'] for ref in refs]
        return part(code, 'group', specs, 8 if '.n>=8' in code else None)
    raise ValueError('Unmapped completion expression: ' + code)

pattern = re.compile(r'parts=\[(.+?)\];(?=\n|return|\[)', re.M)
edits = 0
def arrays(m):
    global edits
    line = html[html.rfind('\n', 0, m.start())+1:m.start()]
    if not ('progress:function' in line or 'if(n===2)' in line or 'if(n===3)' in line or 'else{' in line and "notesStatus('l1')" in m[1] or "notesStatus('l13')" in m[1]):
        return m[0]
    edits += 1
    return 'parts=[' + ','.join(describe(x) for x in split_parts(m[1])) + '];'
html = pattern.sub(arrays, html)
assert edits == 31, edits

once("parts.push(okRef(r))", "parts.push(lessonPartStatus(okRef(r),'group',[[r,'drill']]))")
once("parts.push(s==='mastered'||s==='cleared');\n  parts.push(setsDone()>=3);\n  parts.push(!!((rdState().tr.rr||'').trim()));",
     "parts.push(lessonPartStatus(s==='mastered'||s==='cleared','group',[['dA','drill']]));\n  parts.push(lessonPartStatus(setsDone()>=3,'translationSets',['dB','dC','xA','xB'],3));\n  parts.push(lessonPartStatus(!!((rdState().tr.rr||'').trim()),'reading',['read']));")

for old, new in [
    ("parts.push(notesStatus(lid).s==='done');", "parts.push(lessonPartStatus(notesStatus(lid).s==='done','notes',['notes']));"),
    ("parts.push(vocabStatus(n).s==='done');", "parts.push(lessonPartStatus(vocabStatus(n).s==='done','vocab',['vocab']));"),
    ("parts.push(d.type==='grid'?okRefOf(lid+d.id):sp(lid+d.id))", "parts.push(lessonPartStatus(d.type==='grid'?okRefOf(lid+d.id):sp(lid+d.id),'group',[[lid+d.id,d.type==='grid'?'drill':'set']]))"),
    ("parts.push(labDone(key)>=Math.ceil(S.lab.length/2));", "parts.push(lessonPartStatus(labDone(key)>=Math.ceil(S.lab.length/2),'lab',[key],Math.ceil(S.lab.length/2)));"),
    ("parts.push(sp(lid+'X'));", "parts.push(lessonPartStatus(sp(lid+'X'),'group',[[lid+'X','set']]));"),
    ("parts.push(rds.every(function(r){return !!(rdState().tr[r.id]||'').trim()}));", "parts.push(lessonPartStatus(rds.every(function(r){return !!(rdState().tr[r.id]||'').trim()}),'reading',['read']));"),
    ("parts.push(nleState('nle'+n).done);parts.push(ladderStatus(n).s==='done');", "parts.push(lessonPartStatus(nleState('nle'+n).done,'nle',['nle']));parts.push(lessonPartStatus(ladderStatus(n).s==='done','ladder',['ladder']));"),
]:
    once(old, new)
# Older inactive declarations still return booleans. The helper accepts both shapes.
html = re.sub(r'return \{done:parts\.filter\(Boolean\)\.length,total:(5|[4-9]|parts\.length)\}', r'return summarizeLessonParts(parts,\1)', html)
once("return Object.assign({},r,{done:Math.max(0,r.done-(d?1:0)),total:Math.max(1,r.total-1)})",
     "return Object.assign({},r,{done:Math.max(0,r.done-(d?1:0)),total:Math.max(1,r.total-1),parts:r.parts&&r.parts.filter(function(p){return p.kind!=='ladder'})})")
# Calculate the same entitlement for the meter and the ledger.
once("function sync(){\n  if(!window.__rinfo||!S.user)return;var f=F(),changed=false,n;",
     """function lessonDenarii(done,total){return total?Math.floor(LESSON*done/total):0}
 window.__lessonDenarii=function(n,done,total){
  if(!coinsOn()||!total)return null;
  var ledger=S.forum||{},paid=Math.min(total,(ledger.paid||{})[n]||0);
  var earned=lessonDenarii(paid,total), maximum=lessonDenarii(total,total);
  var qualified=lessonDenarii(Math.max(done,paid),total);
  var gate=D.MONS.some(function(m){return m.t==='gate'&&m.n===n});
  var gatePaid=gate&&(ledger.gp||{})[n],gateReady=gate&&!gatePaid&&gateCleared(n);
  return {earned:earned,pending:qualified-earned,remaining:maximum-qualified,
   gate:gate?{reward:GATEB,earned:!!gatePaid,pending:!!gateReady}:null};
 };
 function sync(){
  if(!window.__rinfo||!S.user)return;var f=F(),changed=false,n;""")
once("Math.floor(LESSON*inf.done/inf.total)-Math.floor(LESSON*paid/inf.total)", "lessonDenarii(inf.done,inf.total)-lessonDenarii(paid,inf.total)")
once("Math.floor(LESSON*ip.d/ip.t)-Math.floor(LESSON*pi/ip.t)", "lessonDenarii(ip.d,ip.t)-lessonDenarii(pi,ip.t)")
old = "function lessonPart(n){var ex=tabsOf(n).filter(function(t){return /^Exercise/.test(t[1])&&okS(t)}).length;return {notes:notes(n)?20:0,ex:ex*10,done:done(n)?30:0,gate:gate(n)?25:0}}"
new = """function lessonXPItems(n){
  var items=[];
  if(notesStatus(n===0?'intro':'l'+n).t)items.push({tab:'notes',name:'Guided notes',xp:20,done:notes(n),type:'notes'});
  if(n===0)return items;
  tabsOf(n).filter(function(t){return /^Exercise/.test(t[1])}).forEach(function(t){items.push({tab:t[0],name:t[1],xp:10,done:okS(t),type:'ex'})});
  items.push({name:'Lesson completion',xp:30,done:done(n),type:'done'});
  if(window.__hasGate&&window.__hasGate(n))items.push({tab:'gate',name:'Gate',xp:25,done:gate(n),type:'gate'});
  return items;
 }
 window.__lessonXPItems=lessonXPItems;
 function lessonPart(n){
  var result={notes:0,ex:0,done:0,gate:0};
  lessonXPItems(n).forEach(function(item){if(item.done)result[item.type]+=item.xp});
  return result;
 }"""
once(old,new)
marker='\nrender();\n})();\n</script>\n<script type="module" src="/app-bootstrap.js"'
once(marker,'\n'+(root/'lesson-checklist.js').read_text(encoding='utf-8')+marker)
page.write_text(html,encoding='utf-8')
