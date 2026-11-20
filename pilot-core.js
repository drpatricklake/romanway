/* Shared, pure calculations for the Roman Way classroom pilot. */
(function (root) {
  'use strict';
  const virtues = ['sapientia','constantia','fortitudo','virtus','pietas','liberalitas'];
  const stepNames = {TYPE:'Sentence type',V:'Verbs',VSORT:'Sorting verbs',CLAUSE:'Clause boundaries',CTYPE:'Clause types',SUBJ:'Subject',CASE:'Cases',USE:'Uses of cases',MOD:'Modifiers',S:'Subject',PN:'Predicate nominative',INF:'Infinitives',DO:'Direct object',IO:'Indirect object',PP:'Prepositional phrases',VOC:'Vocative',AB:'Ablative'};
  const defaults = {
    learning:{threshold:80,macrons:'lenient',practiceLen:10,vocabRule:false,dailyGoal:10,classGoal:500,newPerDay:5,models:'after',aiFeedback:false,autoAddLooked:true,readingU:true,showDrafts:true,lab:'full',labLock:false,forumMode:'coins'},
    circus:{assign:'calling',stakes:true,paidRounds:5,liveEnabled:true,ghostEnabled:true},
    biblioteca:{mode:'sequence',through:0,task:'mc',paid:5},
  };
  function settings(data={}) {
    return {learning:{...defaults.learning,...data.learning,threshold:data.threshold??data.learning?.threshold??80},circus:{...defaults.circus,...data.circus},biblioteca:{...defaults.biblioteca,...data.biblioteca}};
  }
  const number = n => Number.isFinite(n) ? n : 0;
  const accuracy = (correct,total) => total>0 ? Math.round(100*correct/total) : null;
  function stepScores(attempts) {
    const by = {}, seen = new Set();
    for (const a of attempts||[]) {
      if (a.kind!=='lab' || !a.steps) continue;
      const key=a.id||`${a.ref}:${a.t}`;
      if (seen.has(key)) continue; // Each sentence's first completed analysis, not repeated practice.
      seen.add(key);
      for (const [step,value] of Object.entries(a.steps)) {
        if (value===null||value===undefined) continue;
        const s=by[step]||(by[step]={name:stepNames[step]||step,correct:0,total:0});
        s.total++; if (value===true||value===1) s.correct++;
      }
    }
    for(const s of Object.values(by)) s.accuracy=accuracy(s.correct,s.total);
    return by;
  }
  function assignmentStatus(state,assignment,registry={}) {
    const id=assignment.targetId;
    if(assignment.kind==='worksheet'||assignment.kind==='project'&&assignment.source==='worksheet') {
      const w=state.ws?.[id];return w?.sub?'submitted':w?.vals&&Object.values(w.vals).some(v=>String(v).trim())?'started':'not-started';
    }
    if(assignment.kind==='project') {
      const p=state[id];return p?.done||p?.final?'completed':p?'started':'not-started';
    }
    if(assignment.kind==='reading') {
      const mc=!!state.nle?.[id]?.done,tr=!!state.biblio?.tr?.[id],task=registry.readingTask||'mc';
      return (task==='tr'?tr:task==='both'?mc&&tr:mc)?'completed':state.nle?.[id]||tr?'started':'not-started';
    }
    if(assignment.kind==='circus') return state.circus?.runs?.[id]?'completed':(state.attempts||[]).some(a=>a.ref===id)?'started':'not-started';
    return (state.attempts||[]).some(a=>a.ref===id&&a.kind!=='practice')?'completed':(state.attempts||[]).some(a=>a.ref===id)?'started':'not-started';
  }
  function summarize(state,registry={},base={}) {
    const attempts=state.attempts||[];
    const lab=attempts.filter(a=>a.kind==='lab');
    const circus=state.circus||{},stats=circus.stats||{};
    const reading=(registry.rungs||[]).filter(r=>assignmentStatus(state,{kind:'reading',targetId:r.id},registry)==='completed').map(r=>r.id);
    const assignmentStates={};
    for(const a of registry.assignments||[]) assignmentStates[a.id]=assignmentStatus(state,a,registry);
    const xp=state.pilot?.xp||{total:0,v:Object.fromEntries(virtues.map(v=>[v,0]))};
    return {...base,schema:2,
      circus:{training:Object.keys(circus.runs||{}).length,wins:number(stats.w),losses:number(stats.l),draws:number(stats.d),shared:number(state.pilot?.sharedRuns)},
      biblioteca:{completed:reading.length,ids:reading,translations:Object.values(state.biblio?.tr||{}).filter(Boolean).length},
      lab:{completed:new Set(lab.map(a=>a.id||`${a.ref}:${a.t}`)).size,steps:stepScores(attempts)},
      xp:{total:number(xp.total),v:Object.fromEntries(virtues.map(v=>[v,number(xp.v?.[v])]))},
      denarii:number(state.forum?.coins),assignments:assignmentStates,
      telemetry:{startedAt:state.pilot?.startedAt||null,events:(state.pilot?.events||[]).length,baseline:state.pilot?.baseline||null},
    };
  }
  function capture(state,context='other',at=Date.now()) {
    const p=state.pilot=state.pilot||{};
    const snapshot={coins:number(state.forum?.coins),attempts:(state.attempts||[]).length,training:Object.keys(state.circus?.runs||{}).length,biblioteca:Object.values(state.nle||{}).filter(v=>v?.done).length};
    p.events=p.events||[];
    if(!p.baseline){p.startedAt=at;p.baseline={...snapshot,xp:p.xp||null};p.previous=snapshot;return;}
    const previous=p.previous||snapshot;
    const changes={};for(const key of Object.keys(snapshot))if(snapshot[key]!==previous[key])changes[key]=snapshot[key]-previous[key];
    if(Object.keys(changes).length) p.events.push({at,context,changes});
    p.previous=snapshot;
  }
  function captureXP(state,value,context='other',at=Date.now()) {
    const p=state.pilot=state.pilot||{};
    const next={total:number(value.total),v:{...value.v}};
    if(!p.xp){p.xp=next;if(p.baseline&&!p.baseline.xp)p.baseline.xp=next;return;}
    const change={};for(const v of virtues){const delta=number(next.v[v])-number(p.xp.v?.[v]);if(delta)change[v]=delta;}
    if(Object.keys(change).length)(p.events=p.events||[]).push({at,context,changes:{xp:change}});
    p.xp=next;
  }
  function tally(events) {
    const sources={};
    for(const e of events||[]) {
      const row=sources[e.context]||(sources[e.context]={events:0,earned:0,spent:0,xp:0});
      row.events++;const n=number(e.changes?.coins);row.earned+=Math.max(0,n);row.spent+=Math.max(0,-n);
      row.xp+=Object.values(e.changes?.xp||{}).reduce((s,n)=>s+number(n),0);
    }
    return sources;
  }
  const byCalling={sailor:'blue',dancer:'blue',musician:'blue',baker:'blue',farmer:'green',hunter:'green',merchant:'green',herder:'green',textile:'green',soldier:'red',metalworker:'red',actor:'red',stoneworker:'red',service:'red',scribe:'white',priest:'white',household:'white',banker:'white'};
  function hash(text){let n=0;for(const c of String(text))n=(Math.imul(n,31)+c.charCodeAt(0))>>>0;return n;}
  function faction(uid,calling,override,mode='calling',classmates=[]) {
    if(['blue','green','red','white'].includes(override)) return override;
    if(mode==='calling'&&byCalling[calling])return byCalling[calling];
    const ids=[...new Set([...classmates.map(s=>s.uid),uid])].sort();
    return ['blue','green','red','white'][Math.max(0,ids.indexOf(uid))%4];
  }
  function questionPack(ids,itemById) {
    const seen=new Set(),out=[];
    for(const id of ids) {
      if(seen.has(id))continue;seen.add(id);
      const it=itemById(id);
      if(!it||!Array.isArray(it.o)||it.o.length<2||!Number.isInteger(it.a)||it.a<0||it.a>=it.o.length)continue;
      out.push({id,lesson:it.L,q:String(it.q),options:it.o.map(String),answer:it.a,explanation:String(it.e||'')});
    }
    return out;
  }
  function points(correct,ms){return correct?10+Math.round(5*Math.max(0,1-Math.max(0,Math.min(12000,number(ms)))/12000)):0;}
  function score(pack,answers) {
    let total=0,correct=0;const rows=pack.map((q,i)=>{
      const a=answers[i]||{choice:-1,ms:12000},ok=a.choice===q.answer;
      const p=points(ok,a.ms);total+=p;if(ok)correct++;
      return {id:q.id,choice:a.choice,correct:ok,ms:a.ms,points:p};
    });
    return {points:total,correct,total:pack.length,accuracy:accuracy(correct,pack.length),rows};
  }
  function standings(results) {
    const groups=Object.fromEntries(['blue','green','red','white'].map(f=>[f,{points:0,races:0,students:new Set()}]));
    for(const r of results)if(r.eligible&&groups[r.faction]){const g=groups[r.faction];g.points+=r.points;g.races++;g.students.add(r.uid);}
    return Object.entries(groups).map(([f,g])=>({faction:f,points:g.points,races:g.races,students:g.students.size})).sort((a,b)=>b.points-a.points);
  }
  function csvField(value){let s=String(value??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  root.RomanWayPilot={virtues,stepNames,defaults,settings,stepScores,assignmentStatus,summarize,capture,captureXP,tally,faction,questionPack,points,score,standings,csvField};
})(typeof window==='undefined'?globalThis:window);
