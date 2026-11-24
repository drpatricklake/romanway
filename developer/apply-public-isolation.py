"""Keep classroom features in shared source but omit them in Public Practice."""
from pathlib import Path
import json
page=Path(__file__).resolve().parent.parent/'index.html'
s=page.read_text()
def once(old,new):
 global s
 assert s.count(old)==1,(old[:100],s.count(old))
 s=s.replace(old,new,1)
once('  if(PUBLIC_PRACTICE)body=body.replace(', '  if(PUBLIC_PRACTICE)body=publicPracticeMarkup(body).replace(')
once("  h+='<section class=\"panel\"><h3 style=\"margin:0 0 .3em\">Class goal this week", "  if(!PUBLIC_PRACTICE)h+='<section class=\"panel\"><h3 style=\"margin:0 0 .3em\">Class goal this week")
once('  h+=rankedPanel();', '  if(!PUBLIC_PRACTICE){h+=rankedPanel();')
once('  if(s.hist.length)h+=', '  }\n  if(s.hist.length)h+=')
once("  h+='<div class=\"panel\"><h3 style=\"margin:0 0 .3em\">The live Colosseum", "  if(!PUBLIC_PRACTICE)h+='<div class=\"panel\"><h3 style=\"margin:0 0 .3em\">The live Colosseum")
once(' function loadPriv(){', ' function loadPriv(){if(PUBLIC_PRACTICE)return Promise.resolve();')
once(' function loadCp(){', ' function loadCp(){if(PUBLIC_PRACTICE)return Promise.resolve();')
once(' function refreshAll(){', ' function refreshAll(){if(PUBLIC_PRACTICE)return;')
once('function sharedCircusMenu(){', "function sharedCircusMenu(){if(PUBLIC_PRACTICE)return '';")
once('window.__pilotTrainerFinished=function(R){', 'window.__pilotTrainerFinished=function(R){if(PUBLIC_PRACTICE)return;')
once('async function publishPendingGhosts(){', 'async function publishPendingGhosts(){if(PUBLIC_PRACTICE)return;')
once('window.__atriumView=function(art){', "window.__atriumView=function(art){if(PUBLIC_PRACTICE)return art+'<section class=\"panel\"><h2>The Atrium</h2><p>In Roman homes, patrons received their clients here. Peer tutoring and shared messages are available in the classroom edition.</p><p>Your Public Practice work stays on this device.</p></section>';")
once(' function decorate(){var main=', ' function decorate(){if(PUBLIC_PRACTICE)return;var main=')
once('var h=_jpAT();if(promptedToday())return h;', 'var h=_jpAT();if(PUBLIC_PRACTICE||promptedToday())return h;')
# Select fixed interface copy before learner values are inserted into markup.
# A render-time replacement would also rewrite matching words in saved answers.
prefix, public_ui = s.split('/* Browser-only learner mode.', 1)
for old,new in {
 'Your instructor can read it.':'Your translation stays on this device.',
 'Your answers save as you type, and your instructor can read them.':'Your answers save as you type on this device.',
 'Your work saves as you type, and your instructor reads it.':'Your work saves as you type on this device.',
 '(your instructor can read these)':'(saved on this device)',
 'Written responses go to your instructor.':'Written responses stay on this device.',
 'saved for your instructor':'saved on this device',
 'Save and share with my instructor':'Save and check',
 'Submit worksheet':'Save and check',
 'Submit again':'Save and check',
 'Submitted':'Saved and checked',
 'submit again':'check again',
 'when you submit':'when you check your work',
 'submit your report':'save your report on this device',
 'Submit my commission report':'Save my commission report',
 ' submitted</span>':' checked</span>',
}.items():
 assert old in prefix, old
 prefix=prefix.replace(old, "'+(PUBLIC_PRACTICE?"+json.dumps(new)+":"+json.dumps(old)+")+'")
s=prefix+'/* Browser-only learner mode.'+public_ui
# The full UI is regenerated on every build, so all changes remain reproducible.
page.write_text(s)
