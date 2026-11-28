import assert from 'node:assert/strict';
import { harness, action, plain } from './harness.mjs';

const p=harness(process.argv[2]||'index.html',{
  edition:'public-practice',
  configure(c){c.URLSearchParams=URLSearchParams}
});
action(p,'local-start');
assert.match(p.markup(),/<main[^>]*><section class="panel avbar cta">/);
assert.match(p.markup(),/id="cloud-status" class="fh-storage"[^>]*>Saved on this device/);
assert.doesNotMatch(p.markup(),/Only the Introduction and Lessons I and XIII are built|Chiseled into the Codex/);
action(p,'open-avatar');
action(p,'av-pick',{id:'textile'});
action(p,'av-create');
action(p,'home');
const next=p.context.__lessonChecklist(1).next;
assert.match(plain(p.markup()),/Continue: Guided notes/);
assert.equal(next.id,'notes');
assert.match(p.markup(),/aria-label="Roman date"/);
assert.match(p.markup(),/data-act="forum-day"/);
assert.match(p.markup(),/fh-signature/);
assert.match(p.markup(),/All six virtues count equally toward rank/);
assert.equal((p.markup().match(/class="fh-virtue(?: |")/g)||[]).length,6);
const controls=[...p.markup().matchAll(/<button class="btn([^"]*)"/g)].filter(m=>!m[1].includes('ghost'));
assert.equal(controls.length,1);

action(p,'lesson-checklist-go',{l:'1',tab:'notes'});
assert.equal(p.model.view.tab,'notes');
for(const segment of p.model.notes.l1){
  for(const check of segment.checks)p.model.state.checks[check.id]={done:true,ok:true,first:true,wrong:[],tries:1};
}
p.model.render();
assert.match(p.markup(),/Chiseled into the Codex/);
action(p,'home');
assert.doesNotMatch(p.markup(),/Chiseled into the Codex/);
action(p,'open-appendix');
assert.equal(p.model.view.screen,'appendix');
action(p,'open-road');
assert.match(p.markup(),/id="roadpanel"/);
assert.match(p.markup(),/data-act="open-lesson" data-l="57"/);
assert.doesNotMatch(p.markup(),/Only the Introduction and Lessons I and XIII are built/);

action(p,'home');
const correct=[...p.markup().matchAll(/data-act="forum-day" data-o="(\d+)" data-tg="(\d+)"/g)].find(m=>m[1]===m[2]);
const before=p.model.state.forum.coins;
action(p,'forum-day',{o:correct[1],tg:correct[2]});
assert.equal(p.model.state.forum.coins,before+1);
action(p,'forum-day',{o:correct[1],tg:correct[2]});
assert.equal(p.model.state.forum.coins,before+1);
action(p,'forum-monuments');
assert.equal(p.model.view.fTab,'map');
assert.equal(p.model.view.screen,'forum');

action(p,'open-tabernae');
assert.equal(p.model.view.screen,'tabernae');
assert.match(p.markup(),/<h1>Tabernae<\/h1>/);
const progress=p.context.__rinfo;
// Open the market's lesson gates for the purchase checks only.
p.context.__rinfo=()=>({live:true,total:1,done:1});
p.model.state.forum.coins=500;
p.model.render();
const item=p.markup().match(/data-act="av-buy" data-id="([^"]+)"(?![^>]*disabled)/);
assert.ok(item,'Marketplace has an available item');
action(p,'av-buy',{id:item[1]});
assert.ok(p.model.state.av.owned[item[1]]);
assert.ok(Object.values(p.model.state.av.worn).includes(item[1]));
assert.ok(p.model.state.forum.coins<500);
const balance=p.model.state.forum.coins;
action(p,'av-wear',{id:item[1]});
assert.ok(!Object.values(p.model.state.av.worn).includes(item[1]));
p.context.__rinfo=progress;
action(p,'open-arca');
assert.match(p.markup(),/<h1>Arca<\/h1>/);
assert.ok(plain(p.markup()).includes(balance+' denarii'));
assert.doesNotMatch(p.markup(),/No possessions yet/);
action(p,'open-domus',{r:'atrium'});
assert.match(p.markup(),/Honōrēs/);
const reopened=harness(process.argv[2]||'index.html',{edition:'public-practice',
  seedStorage:Object.fromEntries(p.saved),configure(c){c.URLSearchParams=URLSearchParams}
});
action(reopened,'local-start');
assert.equal(reopened.model.state.forum.coins,balance);
assert.ok(reopened.model.state.av.owned[item[1]]);
assert.ok(!Object.values(reopened.model.state.av.worn).includes(item[1]));
console.log('PASS Forum home: onboarding, next task, civic reward, Via, Codex notice, marketplace, ledger, honors, and reload.');
