from pathlib import Path
root=Path(__file__).resolve().parent
target=root.parent/'index.html'
s=target.read_text()
marker='/* NLE REVIEW START */'
assert marker not in s, 'Rebuild the baseline before applying NLE changes'
old="function nleView(id,np){\n  var set=NLESETS[id],st=nleState(id),n=0,L='ABCD';"
new="function nleView(id,np){\n  var set=NLESETS[id];nleItems(set);\n  var st=nleState(id),n=0,L='ABCD';"
assert s.count(old)==1, 'NLE renderer changed; review the choice-rotation fix'
s=s.replace(old,new,1)
catalog=(root/'nle-catalog.js').read_text()
data='\n'.join((root/name).read_text() for name in ['nle-fixes.js','nle-style.js','nle-sets.js'])
assert catalog.count('/* NLE_PATCH_DATA */')==1
catalog=catalog.replace('/* NLE_PATCH_DATA */',data)
patch=marker+'\n'+catalog+'\n'+(root/'nle-review.js').read_text()+'\n/* NLE REVIEW END */\n'
end='\nrender();\n})();\n</script>\n<script type="module" src="/firebase-auth.js"'
assert s.count(end)==1, 'App insertion point changed'
target.write_text(s.replace(end,'\n'+patch+end,1))
