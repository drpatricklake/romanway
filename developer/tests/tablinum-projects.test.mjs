import assert from 'node:assert/strict';
import { action, harness, plain } from './harness.mjs';

const html = process.argv[2] || new URL('../../index.html', import.meta.url).pathname;
const worksheetIds = ['timeline', 'w36', 'w115', 'w125', 'w193', 'w203'];
const activities = [
  { l: '35', tab: 'grimm', heading: 'Grimm’s Law' },
  { l: '47', tab: 'crossword', heading: 'Caesar Dicit' },
  { l: '51', tab: 'orbis', heading: 'ORBIS: a journey through the Roman world' },
];
const retiredTabs = new Set(['proj', ...activities.map(({ tab }) => tab)]);
const existingDraft = 'A draft saved before the navigation changed.';
const revisedDraft = 'An edited draft saved in the Tablīnum.';

function open(edition, seedStorage) {
  const p = harness(html, {
    edition, seedStorage,
    configure(context) { context.URLSearchParams = URLSearchParams; },
  });
  if (edition === 'public-practice') action(p, 'local-start');
  else {
    p.model.state.user = { role: 'student' };
    p.context.RomanWayAuthApp.databaseReady();
  }
  return p;
}

function assertInProjects(p) {
  assert.equal(p.model.view.screen, 'domus');
  assert.equal(p.context.__domus.room, 'tablinum');
  assert.equal(p.context.__domus.sub, 'proj');
}

for (const edition of ['public-practice', 'classroom']) {
  const p = open(edition);
  for (const lesson of ['intro', ...Array.from({ length: 57 }, (_, i) => i + 1)]) {
    action(p, 'open-lesson', { l: String(lesson) });
    assert.equal(p.model.view.screen, 'lesson');
    assert.ok(p.model.lessonTabs().every(([key]) => !retiredTabs.has(key)), 'Lesson ' + lesson);
    assert.doesNotMatch(p.markup(), /data-act="tab" data-tab="(?:proj|grimm|crossword|orbis)"/);
    const hasProjects = p.model.worksheets.some(w => w.project && String(w.lesson) === String(lesson)) ||
      activities.some(({ l }) => l === String(lesson));
    const hasWorksheets = p.model.worksheets.some(w => !w.project && !w.inNotes && !w.inTab && String(w.lesson) === String(lesson));
    if (hasProjects) {
      assert.ok(plain(p.markup()).includes("This lesson’s " + (hasWorksheets ? 'worksheets and projects' : 'projects') + ' are in the Tablinum.'));
      action(p, 'dm-project-list');
      assertInProjects(p);
    } else if (hasWorksheets) {
      assert.match(plain(p.markup()), /This lesson’s worksheets are in the Tablinum\./);
    }
  }

  action(p, 'open-lesson', { l: '13' });
  assert.match(plain(p.markup()), /In demonstrative use, hic and ille are stronger and more frequent than is/);
  const notes = Object.values(p.model.notes).flat().find(segment => segment.id === 'p3b');
  assert.match(notes.lines[0], /In that same use, ~is~ occurs __ .* than ~hic~ and ~ille~/);
  assert.equal(notes.blanks[1].a[0], 'less commonly');

  action(p, 'open-domus', { r: 'tablinum' });
  action(p, 'dm-sub', { s: 'ws' });
  for (const id of worksheetIds) assert.ok(!p.markup().includes('data-id="' + id + '"'), id);
  action(p, 'dm-sub', { s: 'proj' });
  assertInProjects(p);
  assert.equal((p.markup().match(/data-act="dm-proj"/g) || []).length, 9);
  for (const id of worksheetIds) {
    const worksheet = p.model.worksheets.find(w => w.id === id);
    assert.ok(worksheet?.project, id);
    assert.ok(p.markup().includes('data-act="dm-proj" data-id="' + id + '"'), id);
    action(p, 'dm-proj', { id });
    assertInProjects(p);
    assert.equal(p.model.view.ws, id);
    assert.ok(plain(p.markup()).includes(worksheet.title), id);
    if (id === 'w125') {
      assert.ok(plain(p.markup()).includes(edition === 'public-practice'
        ? 'use the same rubric to score your work'
        : 'your instructor will score your presentation'));
    }
    assert.match(p.markup(), /data-act="ws-back">All projects/);
    action(p, 'ws-back');
    assertInProjects(p);
    assert.equal(p.model.view.ws, null);
  }
  for (const { l, tab, heading } of activities) {
    assert.ok(p.markup().includes('data-act="dm-proj" data-l="' + l + '" data-tab="' + tab + '"'), tab);
    action(p, 'dm-proj', { l, tab });
    assertInProjects(p);
    assert.ok(plain(p.markup()).includes(heading), tab);
    assert.match(p.markup(), /data-act="dm-sub" data-s="proj">All projects/);
    action(p, 'dm-sub', { s: 'proj' });
    assertInProjects(p);
  }

  action(p, 'open-avatar');
  action(p, 'open-orbis');
  assertInProjects(p);
  assert.match(plain(p.markup()), /ORBIS: a journey through the Roman world/);
  action(p, 'dm-room', { r: 'lararium' });
  action(p, 'dm-room', { r: 'tablinum' });
  assert.match(p.markup(), /data-act="dm-proj" data-l="51" data-tab="orbis"/);
}

// Saved work retains its original worksheet and interactive project keys on both sides of reload.
const forum = open('public-practice');
const field = forum.model.worksheets.find(w => w.id === 'w115').items
  .flatMap(item => item.f || []).find(f => f.k === 'text' && f.rows > 1);
forum.model.state.ws.w115 = { vals: { [field.id]: existingDraft } };
forum.model.state.grimm = { strange: 'A saved cognate observation.', done: true };
forum.model.state.cw47 = { g: 'I'.padEnd(225, ' '), done: true };
forum.model.state.orbis = { from: 'Roma', to: 'Ostia', final: true };
action(forum, 'local-save');
const resumed = open('public-practice', Object.fromEntries(forum.saved));
action(resumed, 'open-lesson', { l: '11' });
action(resumed, 'ws-open', { id: 'w115' });
assertInProjects(resumed);
assert.match(plain(resumed.markup()), /A draft saved before the navigation changed/);
resumed.input('wf-' + field.id, revisedDraft, { ws: 'w115', fid: field.id });
action(resumed, 'ws-submit', { id: 'w115' });
const reloaded = open('public-practice', Object.fromEntries(resumed.saved));
action(reloaded, 'dm-proj', { id: 'w115' });
assertInProjects(reloaded);
assert.match(plain(reloaded.markup()), /An edited draft saved in the Tablīnum/);
assert.ok(reloaded.model.state.ws.w115.sub);
for (const { l, tab } of activities) {
  action(reloaded, 'dm-proj', { l, tab });
  assertInProjects(reloaded);
  if (tab === 'grimm') assert.match(reloaded.markup(), /A saved cognate observation/);
  if (tab === 'crossword') assert.match(reloaded.markup(), /data-cw="0,0"[^>]+value="I"/);
  if (tab === 'orbis') assert.match(reloaded.markup(), /data-ob="from"[^>]+value="Roma"/);
}

const classroom = open('classroom');
classroom.context.__pilot.assignments = [
  { id: 'ws_w115', kind: 'project', source: 'worksheet', targetId: 'w115', lesson: 11, title: 'Roman History Discussion', audience: [] },
  { id: 'project_cw47', kind: 'project', source: 'project', targetId: 'cw47', lesson: 47, title: 'Caesar Dicit', audience: [] },
];
for (const [id, title] of [['ws_w115', 'Roman History Discussion'], ['project_cw47', 'Caesar Dicit']]) {
  action(classroom, 'open-domus', { r: 'tablinum' });
  assert.ok(classroom.markup().includes('data-act="pilot-open-assignment" data-id="' + id + '"'), id);
  action(classroom, 'pilot-open-assignment', { id });
  assertInProjects(classroom);
  assert.ok(plain(classroom.markup()).includes(title), title);
}

console.log('PASS Introduction and 57 lessons in both editions; all nine projects open in the Tablīnum; saved work and Classroom assignment links survive.');
