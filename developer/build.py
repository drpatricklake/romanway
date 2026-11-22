from pathlib import Path
import subprocess
root=Path(__file__).resolve().parent
repo=root.parent
s=subprocess.check_output(['git','show','931e0d76deb9711b70af455b3c3dbd0ce1d0a00e:index.html'],cwd=repo).decode()
def replace_once(old,new):
 global s
 assert s.count(old)==1,(old[:90],s.count(old))
 s=s.replace(old,new,1)
replace_once("<script>\n(function(){\n'use strict';", '<script src="/pilot-core.js"></script>\n<script src="/word-forms.js"></script>\n<script>\n(function(){\n\'use strict\';')
# Make legacy module controls consume the verified Firebase class settings.
for module in ['CI','BI','DM']:
 replace_once(f'function load(){{if({module}.busy)return;',f'function load(){{if(window.__pilotApply){{window.__pilotApply();return}}if({module}.busy)return;')
replace_once("function unlocked(r){if(isDone(r.id))","function unlocked(r){if(window.__pilotReadingAssigned&&window.__pilotReadingAssigned(r.id))return true;if(isDone(r.id))")
replace_once("function myFaction(){var call=", "function myFaction(){if(window.__pilotFaction){var own=window.__pilotFaction();if(own)return own}var call=")
replace_once("CI.race={ev:ev,drv:d,stake:stake,items:items", "CI.race={ev:ev,drv:d,stake:stake,ids:pick,items:items")
replace_once('R.log.push({ok:ok,ms:ms})', 'R.log.push({ok:ok,ms:ms,choice:k})')
replace_once('R.res=res;R.net=net;persist();render(true)', 'R.res=res;R.net=net;persist();if(window.__pilotTrainerFinished)window.__pilotTrainerFinished(R);render(true)')
replace_once("L:Math.max(v.lesson,x.L||0),t:x.t","L:Math.max(v.lesson,x.L||0,p[1]==='ac'?(parseAdj(v)&&parseAdj(v).t==='12'?7:20):0),t:x.t")
replace_once("screenCircus=function(){wrapAll();", "window.__circusAPI={pool:pool,trainedSet:trainedSet,drillTabs:drillTabs,EVENTS:EVENTS};\n screenCircus=function(){wrapAll();")
replace_once('memo={v:v,total:total,per:per,streak:streak,days:ds.length};memoT=now;return memo', 'memo={v:v,total:total,per:per,streak:streak,days:ds.length};memoT=now;if(window.__pilotReward)window.__pilotReward(memo);return memo')
replace_once("[wsSubmissionsHtml,notesWritesHtml,readingsInstructorHtml,setsInstructorHtml,pronInstructorHtml,labInstructorHtml]", "[wsSubmissionsHtml,notesWritesHtml,readingsInstructorHtml,setsInstructorHtml,pronInstructorHtml]")
# Authored syntax is the answer key. A dictionary candidate must not override it.
replace_once("for(var i=0;i<n;i++)if(B[i]==='V'||B[i]==='INF')A.verbs.push(i);", "var tags=(window.__LABCL||{})[id];\n  for(var i=0;i<n;i++)if(B[i]==='V'||B[i]==='INF'||tags&&tags.L>=26&&(tags.p||[]).indexOf(i)>=0)A.verbs.push(i);")
replace_once(" You may also tap other participles.", " Include the other participles identified in this sentence’s answer key.")
replace_once('\nrender();\n})();\n</script>\n<script type="module" src="/firebase-auth.js"', '\n'+(root/'pilot-ui.js').read_text()+'\nrender();\n})();\n</script>\n<script type="module" src="/firebase-auth.js"')
(repo/'index.html').write_text(s)

# Apply the Firebase social integration to the rebuilt pilot baseline.
import runpy
runpy.run_path(str(root/"apply-social.py"),run_name="__main__")

# Apply the audited NLE catalogue after the shared integrations.
runpy.run_path(str(root/"apply-nle.py"),run_name="__main__")

# Add score-driven Circus presentation after the shared and NLE integrations.
s= (repo/'index.html').read_text()
end='\nrender();\n})();\n</script>\n<script type="module" src="/firebase-auth.js"'
assert s.count(end)==1
(repo/'index.html').write_text(s.replace(end,'\n'+(root/'circus-motion.js').read_text()+end,1))

# Refine generated practice wording and English input normalization.
s=(repo/'index.html').read_text()
end='\nrender();\n})();\n</script>\n<script type="module" src="/firebase-auth.js"'
assert s.count(end)==1
(repo/'index.html').write_text(s.replace(end,'\n'+(root/'practice-clarity.js').read_text()+end,1))

# Match English calling labels to the selected origin without changing the art or Latin.
runpy.run_path(str(root/'apply-avatar-labels.py'),run_name='__main__')
