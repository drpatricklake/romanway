"""Apply mode selection and local storage to the reproducible classroom app."""
from pathlib import Path
root = Path(__file__).resolve().parent
page = root.parent / 'index.html'
s = page.read_text()
def once(old, new):
    global s
    assert s.count(old) == 1, (old[:100], s.count(old))
    s = s.replace(old, new, 1)
once("<head><script type='text/javascript' >", "<head><script src=\"/app-config.js\"></script><script type='text/javascript' >\nif (window.RomanWayConfig && window.RomanWayConfig.edition === 'classroom') {")
# This captured school-filter script inspects typed values; keep it outside the public mode.
first_end = s.index('</script>', s.index('if (window.RomanWayConfig'))
s = s[:first_end] + '}\n' + s[first_end:]
once('<script src="/pilot-core.js"></script>', '<script src="/local-progress.js"></script>\n<script src="/pilot-core.js"></script>')
once("var LS='latin-proto-lesson1-v1';", "var PUBLIC_PRACTICE = !window.RomanWayConfig || window.RomanWayConfig.edition !== 'classroom';\nvar LS='latin-proto-lesson1-v1';")
once("if(e)e.textContent='Volumes I and II'", "if(e)e.textContent=PUBLIC_PRACTICE?'Public Practice':'Volumes I and II'")
once('  $app.innerHTML=header()+body+chartPanel();', "  if(PUBLIC_PRACTICE)body=body.replace(/Sign-in check/g,'Device progress').replace(/\\(your instructor can read these\\)/g,'(saved on this device)');\n  $app.innerHTML=header()+body+chartPanel();")
once('function persist(){\n  if(!AUTH.uid)', 'function persist(){\n  if(PUBLIC_PRACTICE)return saveLocalProgress?saveLocalProgress():false;\n  if(!AUTH.uid)')
once("if(window.claude&&claude.use)", "if(!PUBLIC_PRACTICE&&window.claude&&claude.use)")
# Legacy service helpers cannot acquire account or shared-data access in local mode.
s = s.replace("window.claude&&window.claude.use?window.claude.use(", "!PUBLIC_PRACTICE&&window.claude&&window.claude.use?window.claude.use(")
once('if(!PC)return;CP.settings=PC.settings(CLOUD.classInfo);', 'if(!PC)return;CP.settings=PC.settings(CLOUD.classInfo);\n if(PUBLIC_PRACTICE){\n  [[window.__circus,\'circus\'],[window.__biblioteca,\'biblioteca\']].forEach(function(pair){if(pair[0]){pair[0].settings=CP.settings[pair[1]];pair[0].loaded=true;pair[0].busy=false;pair[0].canEdit=false;pair[0].err=null}});\n  if(window.__domus){window.__domus.settings={assigned:[]};window.__domus.loaded=true;window.__domus.busy=false;window.__domus.canEdit=false;window.__domus.err=null}\n  return;\n }')
once('if(!PC||!CLOUD.ready)return;', 'if(PUBLIC_PRACTICE||!PC||!CLOUD.ready)return;')
once('\nrender();\n})();\n</script>\n<script type="module" src="/firebase-auth.js"', '\n' + (root/'public-practice-ui.js').read_text() + '\nrender();\n})();\n</script>\n<script type="module" src="/firebase-auth.js"')
once('<script type="module" src="/firebase-auth.js" onerror="window.RomanWayAuthApp.setStatus(\'failed\',\'The sign-in file could not load. Check that firebase-auth.js was deployed alongside this page, then retry.\');"></script>', '<script type="module" src="/app-bootstrap.js"></script>')
page.write_text(s)
