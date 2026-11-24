import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import vm from 'node:vm';

const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const sharedArt = /data:(image|font)\/[^;\s"'<>]+;base64,[\w+/=]+/g;
const decode = text => text
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
const plain = markup => decode(markup
  .replace(sharedArt, '')
  .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '')
  .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const pack = value => JSON.parse(JSON.stringify(value));

function element() {
  const classes = new Set();
  return {
    innerHTML: '', textContent: '', value: '', dataset: {}, style: {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    addEventListener() {}, removeEventListener() {},
    appendChild(child) { return child; }, insertBefore(child) { return child; },
    insertAdjacentHTML(_, html) { this.innerHTML += html; },
    setAttribute(name, value) { this[name] = value; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {}, remove() {}, scrollIntoView() {},
  };
}

function harness(filename) {
  const exactHtml = readFileSync(filename, 'utf8');
  const scripts = Array.from(exactHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi), (m) => m[1]);
  const app = scripts.find(s => s.includes('latin-proto-lesson1-v1') && s.includes('function render('));
  assert.ok(app, 'Could not locate the main app script');
  const end = /\nrender\(\);\n\}\)\(\);\s*$/;
  assert.match(app, end, 'The app closure moved');
  const hostNodes = new Map(['app', 'macbar', 'nick', 'code'].map(id => [id, element()]));
  const listeners = new Map();
  hostNodes.get('nick').value = 'Review Student';
  const saved = new Map();
  for(const [key,value] of Object.entries(globalThis.seedStorage || {}))saved.set(key,value);
  let at = Date.parse('2026-11-18T16:00:00Z');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [at])); }
    static now() { return at; }
  }
  const math = Object.create(Math);
  let seed = 2033;
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const context = {
    console, Date: Clock, Math: math,
    XMLHttpRequest: class {open(){} send(){} setRequestHeader(){} status=404;responseText=""},
    document: {
      location:{origin:"https://romanway.vercel.app"},
      getElementById(id) { return hostNodes.get(id) ?? null; },
      createElement: element, createTextNode: s => ({ textContent: s }),
      body: element(), head: element(), documentElement: element(),
      readyState: 'complete', activeElement: null,
      addEventListener(name, handler) {
        const list = listeners.get(name) ?? [];
        list.push(handler);
        listeners.set(name, list);
      },
      removeEventListener() {}, contains() { return false; },
      querySelector() { return null; }, querySelectorAll() { return []; },
    },
    localStorage: {
      getItem(k) { return saved.get(k) ?? null; }, setItem(k, v) { saved.set(k, v); },
    },
    navigator: {}, location: { protocol: 'file:', reload() {context.reloaded=true} },
    addEventListener() {}, removeEventListener() {}, scrollTo() {},
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout() { return 0; }, clearTimeout() {},
    setInterval() { return 0; }, clearInterval() {},
    matchMedia() { return { matches: false, addListener() {}, addEventListener() {} }; },
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    fetch: async () => { throw new Error('Offline test'); },
  };
  context.RomanWayConfig = {edition:'classroom'};
  context.window = context;
  context.self = context;
  vm.createContext(context);
  const getOptional = names => names.map(name => `${name}:typeof ${name}==='undefined'?null:${name}`).join(',');
  const hook = `
window.probe = {get state(){return S},get view(){return V},actions:ACT,render:render,lessonTabs:lessonTabs,
  exercises:EX,notes:NOTES_BY,worksheets:WS,lab:LAB,labSets:LABSETS,gradeLatin:gradeLatin,
  scoreSet:scoreSet,credit:credit,lquery:lessonKey,notesStatus:notesStatus,labState:labState,
  ${getOptional(['notesCheck','LAB2','openLab','TABS','LREG','exStatus','LADDER','nleState','ROMAN'])}};
`;
  const labHook = ' function advance(id){var v=st2(id),ph=phasesFor(id)';
  const script = app.replace(labHook, ' window.probeLab={phasesFor,K,kindsFor,vgroups,vcats,vcat,typeAsked,typesFor,canon,clauseFits};\n' + labHook)
    .replace(end, `\n${hook}\nrender();\n})();`);
  for (const [i, raw] of scripts.entries()) {
    vm.runInContext(raw === app ? script : raw, context, {filename: `${basename(filename)}:script${i + 1}`});
  }
  return {
    context, model: context.probe, nodes: hostNodes, saved,
    markup() { return hostNodes.get('app').innerHTML; },
    step(ms = 200) { at += ms; },
    input(id, value) {
      for (const handler of listeners.get('input') ?? []) handler({target:{id,value, dataset:{}, matches:()=>false}});
    },
  };
}

function action(probe, key, data = {}) {
  assert.equal(typeof probe.model.actions[key], 'function', `Missing app action ${key}`);
  const result = probe.model.actions[key]({ dataset: data });
  probe.step();
  return result;
}

function lessons(probe) {
  const { model } = probe;
  const captures = [];
  const failures = [];
  for (const lesson of ['intro', ...Array.from({ length: 57 }, (_, i) => i + 1)]) {
    try {
      action(probe, 'open-lesson', { l: String(lesson) });
      assert.equal(model.view.screen, 'lesson');
      const tabs = pack(model.lessonTabs());
      for (const [key, label] of tabs) {
        try {
          action(probe, 'tab', { tab: key });
          assert.equal(model.view.tab, key);
          assert.ok(probe.markup().includes('<main'), 'No main content');
          captures.push([lesson, key, label, digest(plain(probe.markup()))]);
        } catch (e) { failures.push({lesson, key, error: e.message}); }
      }
    } catch (e) { failures.push({lesson, error: e.message}); }
  }
  return { captures, failures };
}

function grading(probe) {
  const { model } = probe;
  const settings = model.state.settings;
  const checks = {};
  function grade(value, answers) { return model.credit(model.gradeLatin(value, answers)); }
  settings.macrons = 'lenient';
  checks.lenient = grade('LAUDO', ['laudō']);
  settings.macrons = 'strict';
  checks.strict = grade('laudo', ['laudō']);
  checks.decomposed = grade('laudo\u0304', ['laudō']);
  checks.wrong = grade('laudat', ['laudō']);
  settings.macrons = 'lenient';
  action(probe, 'open-lesson', { l: '1' });
  const answers = [
    'we praise', 'they prepare', 'you frighten', 'he saves',
    'I do not advise', 'he is', 'we carry', 'she calls', 'you (pl.) frighten', 'you carry',
    'they are praising', 'he warns', 'we are advising', 'you (pl.) do not keep',
    'you (sing.) are calling', 'she prepares', 'we frighten', 'you (pl.) carry', 'they warn',
    'we do not name',
  ];
  const score = model.scoreSet(model.exercises.B.items, answers.map(a => [a]));
  checks.lessonOne = [score.correct, score.total];
  const t = Date.now();
  const savedAttempts = model.state.attempts;
  try {
    model.state.attempts = [{t,kind:'exercise',ref:'B',correct:15,total:20}];
    checks.belowThreshold = model.exStatus('B').s;
    model.state.attempts.push({t:t+1,kind:'practice',ref:'B',correct:8,total:10});
    checks.practiceAtThreshold = model.exStatus('B').s;
  } finally { model.state.attempts = savedAttempts; }
  return checks;
}

function sentenceLab(probe) {
  const { context, model } = probe;
  const data = context.__LABCL ?? {};
  const lab = context.probeLab;
  const known = Object.entries(data).sort(([x], [y]) => x.localeCompare(y, 'en'));
  const errors = [];
  let spans = 0;
  for (const [id, meta] of known) {
    const sentence = model.lab[id];
    if (!sentence) { errors.push(`${id}:no sentence`); continue; }
    for (const c of meta.c ?? []) {
      spans += 1;
      if (c.s < 0 || c.e < c.s || c.e >= sentence.toks.length) errors.push(`${id}:invalid span ${c.s}–${c.e}`);
      if (lab && !lab.clauseFits(sentence,c,c.s,c.e)) errors.push(`${id}:keyed bracket would fail`);
      if (lab && lab.typeAsked(id,c) && !c.a.map(lab.canon).some(a => lab.typesFor(id).includes(a))) {
        errors.push(`${id}:no accepted clause type in menu`);
      }
    }
    if (model.LAB2) try { model.LAB2.analyze(id); } catch (e) { errors.push(`${id}:${e.message}`); }
    if (lab) {
      if (lab.phasesFor(id).includes('type')) {
        const accepted = meta.k === 'compound-complex' ? ['compound','complex'] : [meta.k];
        if (!lab.kindsFor(id).some(([kind]) => accepted.includes(kind))) errors.push(`${id}:no accepted sentence type in menu`);
      }
      if (lab.phasesFor(id).includes('verbs')) {
        const visible = lab.vcats(id).map(([kind]) => kind);
        for (const group of lab.vgroups(id)) {
          if (!visible.includes(lab.vcat(id,group.k))) errors.push(`${id}:no accepted verb type in menu for token ${group.k}`);
        }
      }
    }
  }
  const sample = lab && labRoundTrip(probe, known);
  return {sentences: Object.keys(model.lab).length, keyed:known.length, sample,
    sets:Object.keys(model.labSets).length, spans, digest:digest(JSON.stringify(known)), errors};
}

function labRoundTrip(probe, known) {
  const { model, context } = probe;
  const lab = context.probeLab;
  // Use a Lesson III item that offers sentence classification.
  const [id, meta] = known.find(([id, v]) => v.L === 3 && lab.phasesFor(id).includes('type'));
  action(probe, 'open-lesson', {l:'3'});
  action(probe, 'tab', {tab:'xA'});
  assert.ok(probe.markup().includes(`data-id="${id}"`), 'Sample sentence missing in Lab list');
  action(probe, 'lab-open', {id});
  const {v2} = model.labState(id);
  assert.equal(v2.phase, 'type');
  action(probe,'lab3-kind',{v:meta.k === 'simple'?'compound':'simple'});
  assert.equal(v2.x3.kindOk,false);
  action(probe,'lab3-kind',{v:meta.k === 'compound-complex'?'compound':meta.k});
  assert.equal(v2.x3.kindOk,true);
  action(probe,'lab2-next');
  assert.equal(v2.phase,'verbs');
  for (const i of model.LAB2.analyze(id).verbs) action(probe,'lab2-tok',{id,i:String(i)});
  action(probe,'lab2-verbs');
  if (v2.x3.vsOn) {
    for (const group of lab.vgroups(id)) action(probe,'lab3-vs',{i:String(group.k),v:lab.vcat(id,group.k)});
    action(probe,'lab3-vscheck');
  }
  assert.notEqual(v2.phase,'verbs');
  action(probe,'lab2-pref',{v:'off'});
  assert.equal(v2.phase,'translate');
  const translation = 'A sample translation stored in this offline review.';
  probe.input('lab2-tr',translation);
  action(probe,'lab2-finish');
  assert.equal(model.labState(id).done,true);
  assert.equal(model.labState(id).tr2,translation);
  const persisted = JSON.parse(probe.saved.get('latin-proto-lesson1-v1'+(probe.model.state.user.uid?':firebase:'+probe.model.state.user.uid:'')));
  assert.equal(persisted.lab[id].tr2,translation);
  action(probe,'lab2-pref',{v:'full'});
  action(probe,'lab-back',{id});
  return {id, rejectedWrongType:true, acceptedCorrectType:true, acceptedVerbs:true, savedTranslation:true};
}

function progression(probe) {
  const { context, model } = probe;
  const hooks = ['__rinfo', '__xp', '__fc', '__hasGate', '__gateCleared'].filter(key => context[key]);
  const out = { hooks, start: context.__rinfo?.(1), ranks: pack(context.__xp?.RANKS ?? []) };
  if (!context.__xp || !context.__rinfo || !context.__fc) return out;
  action(probe, 'open-lesson', {l:'1'});
  const notes = model.notes.l1;
  const initialLearned = Object.keys(model.state.codex?.ch ?? {}).length;
  for (const group of notes) for (const check of group.checks) model.state.checks[check.id] = {done:true};
  model.render();
  assert.ok(Object.keys(model.state.codex.ch).length > initialLearned, 'Completion did not chisel Codex notes');
  assert.equal(model.notesStatus('l1').s,'done');
  out.chiseledAfterNotes = Object.keys(model.state.codex.ch).filter(i => context.__cxKeep[i]).length;
  out.sapientiaFromNotes = context.__xp.compute().v.sapientia;
  probe.step();
  model.state.arena = {w: 1};
  model.state.circus = {stats: {w: 1}};
  const a = context.__xp.compute();
  out.oneWinPerMode = [a.v.fortitudo, a.v.virtus];
  out.liberalitas = a.v.liberalitas;
  const old = context.__rinfo;
  try {
    context.__rinfo = n => n === 38 ? { live:true, done:1, total:1 } : old(n);
    model.state.av = { done:true, calling:'textile', pres:'f', name:'Iulia', patron:'Minerva',
      origin:'latin', owned:{}, worn:{} };
    model.view.screen = 'home';
    model.render();
    out.prestigePromptAt38 = plain(probe.markup()).includes('Lesson XXXVIII: a new path is open.');
  } finally { context.__rinfo = old; }
  return out;
}

function games(probe) {
  const { context, model } = probe;
  action(probe, 'open-forum');
  action(probe, 'forum-tab', {t:'today'});
  const option = probe.markup().match(/data-act="forum-day"[^>]+data-tg="(\d+)"/);
  assert.ok(option, "Today's Forum question missing");
  let balance = context.__fc.coins();
  for (let i = 0; i < 2; i++) action(probe, 'forum-day', {tg:option[1],o:option[1]});
  const forumReward = context.__fc.coins() - balance;
  assert.equal(forumReward,1);
  action(probe, 'open-arena');
  const arena = context.__arena.state();
  arena.upto = 3;
  balance = context.__fc.coins();
  const previousWins = model.state.arena.w;
  action(probe, 'ar-ludus');
  const rounds = arena.m.items.length;
  assert.equal(rounds,10);
  for (let i = 0; i < rounds; i++) {
    const correct = arena.m.items[arena.m.i].a;
    action(probe, 'ar-ans', {k:String(correct)});
    action(probe, 'ar-next');
  }
  const arenaReward = context.__fc.coins() - balance;
  assert.equal(model.state.arena.w - previousWins,1);
  const persisted = JSON.parse(probe.saved.get('latin-proto-lesson1-v1'+(probe.model.state.user.uid?':firebase:'+probe.model.state.user.uid:'')));
  assert.equal(persisted.arena.w,model.state.arena.w);
  return {forumReward, rounds, won:true, arenaReward, savedWin:true};
}

function run(filename) {
  const probe = harness(filename);
  assert.ok(plain(probe.markup()).includes('Start learning'), 'Student launch screen absent');
  action(probe, 'login-student');
  assert.equal(probe.model.state.user.name, 'Review Student');
  return {
    grades: grading(probe), lab: sentenceLab(probe),
    lessons: lessons(probe), progression: progression(probe), games: games(probe),
  };
}

const [html,modulePath]=process.argv.slice(2);
const p=harness(html);
let observer,initialization=0,popupError=null;
const auth={};
p.context.mockFirebase={sdk:{initializeApp(config){assert.equal(config.projectId,'latinrw');return {}}},auth:{
 getAuth(){return auth},browserSessionPersistence:'session',async setPersistence(){},
 onAuthStateChanged(a,fn){observer=fn;fn(null)},GoogleAuthProvider:class{setCustomParameters(p){assert.equal(p.prompt,'select_account')}},
 async signInWithPopup(){if(popupError)throw popupError;await observer({uid:'alice',displayName:'Alice',email:'alice@example.edu'})},
 async signOut(){await observer(null)}
}};
p.context.mockData={createStore(firebaseApp,identity,hooks){assert.equal(identity.uid,'alice');return {
 async initialize(state){initialization++;hooks.access({teacher:false,member:null,classInfo:{threshold:80}});hooks.apply({...state,notes:{cloud:true}});hooks.status('saved','Saved online')},
 queue(){},async flush(){},stop(){}
}}};
const source=readFileSync(modulePath,'utf8')
 .replace("import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js')",'Promise.resolve(window.mockFirebase.sdk)')
 .replace("import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js')",'Promise.resolve(window.mockFirebase.auth)')
 .replace("import('./firebase-data.js')",'Promise.resolve(window.mockData)');
await vm.runInContext('(async()=>{'+source+'\n})()',p.context);
popupError={code:'auth/popup-blocked'};await p.context.RomanWayAuth.signIn();
assert.ok(p.markup().includes('blocked the Google window'));
popupError=null;await p.context.RomanWayAuth.signIn();
assert.equal(initialization,1);assert.equal(p.model.state.notes.cloud,true);
assert.equal(p.model.state.user.role,'student');assert.ok(p.markup().includes('Saved online'));
await observer({uid:'alice',displayName:'Alice',email:'alice@example.edu'});
assert.equal(initialization,1,'Auth refresh must not initialize storage twice');
await p.context.RomanWayAuth.signOut();assert.ok(p.context.reloaded);
console.log('PASS Google-to-Firestore startup, blocked-popup feedback, cloud data application, repeated auth events, and sign-out cleanup.');
