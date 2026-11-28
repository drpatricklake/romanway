/* Public Practice civic home. Existing lesson and market actions own their state. */
(function(){
  if(!PUBLIC_PRACTICE)return;

  function button(action,label,extra){
    return '<button type="button" class="btn ghost" data-act="'+action+'"'+(extra||'')+'>'+label+'</button>';
  }
  function art(key,cls){
    var asset=(window.__ART||{})[key];
    return asset?'<img class="'+cls+'" src="'+asset.u+'" alt="">':'';
  }
  function standing(){
    var xp=window.__xp,m=xp.compute(),rank=xp.RANKS[xp.rankOf(m)],signature=xp.signature();
    return '<section class="panel fh-standing" aria-label="Your standing"><div class="fh-rank">'+art('rank_'+rank.id,'fh-rank-image')+
      '<div><h2>'+esc(S.av&&S.av.pres==='f'?rank.f:rank.m)+'</h2><p>'+m.total+' XP</p></div></div>'+
      '<div class="fh-virtues" aria-label="Virtues">'+xp.VIR.map(function(v){
        var highlighted=signature===v.id;
        return '<details class="fh-virtue'+(highlighted?' fh-signature':'')+'"><summary aria-label="'+esc(v.n+' · '+m.v[v.id]+' XP'+
          (highlighted?' · signature virtue':''))+'">'+art('vir_'+v.id,'fh-virtue-image')+'<span>'+m.v[v.id]+'</span></summary>'+
          '<p><b>'+esc(v.n)+'</b> · '+esc(v.en)+'</p>'+(highlighted?
          '<p>The ring marks your Persōna’s signature virtue. Its XP unlocks its own honors. All six virtues count equally toward rank.</p>':'')+'</details>';
      }).join('')+'</div>'+button('open-virtutes','Virtūtēs (Record)')+'</section>';
  }
  function monuments(){
    var m=window.__civicForum.monuments();
    return '<section class="panel fh-monuments"><h2>Monuments</h2><p class="note">'+m.earned+' of '+m.total+' earned</p>'+
      (m.latest?window.__sp('mon_'+m.latest.id,'fh-monument-image')+'<p>'+esc(m.latest.name)+'</p>':
        '<p>Finish lessons and close gates to earn monuments.</p>')+button('forum-monuments','View monuments')+'</section>';
  }
  function courseView(legacy){
    var road=legacy.indexOf('<section class="panel journey" id="roadpanel"');
    var goals=legacy.indexOf('<div class="goals">',road);
    if(road<0||goals<0)return legacy;
    var roadEnd=legacy.lastIndexOf('</section>',goals)+'</section>'.length;
    return '<main class="wrap"><div class="crumb"><button class="link" data-act="home">Forum</button></div><h1>Via <span class="note">(The Road)</span></h1>'+
      legacy.slice(road,roadEnd)+legacy.slice(goals);
  }
  var legacyHome=screenHome;
  screenHome=function(){
    var legacy=legacyHome().replace(/<p class="protonote">[\s\S]*?<\/p>/,'');
    if(V.screen==='via')return courseView(legacy);
    var setup=legacy.match(/<section class="panel avbar cta">[\s\S]*?<\/section>/);
    var next=legacy.match(/<section class="panel lc lc-next"[^>]*>[\s\S]*?<\/section>/);
    var primary=next?next[0]:'<section class="fh-next"><button class="btn" data-act="open-road">Review the Via</button></section>';
    var awards=legacy.match(/<section class="panel (?:prestprompt|xppromo)"[^>]*>[\s\S]*?<\/section>/g)||[];
    var practice=legacy.match(/<div class="alert" role="status">[\s\S]*?<\/div>/);
    var review=reviewCounts();
    return '<main class="wrap fh">'+(setup?setup[0].replace('Choose your calling','Choose your Persōna'):'')+
      '<section class="fh-hero"><div><p class="fh-date lat" aria-label="Roman date">'+esc(window.__civicForum.date())+'</p><h1>Forum</h1>'+
      (S.av&&S.av.done?'<p class="fh-greeting">Salvē, '+esc(S.av.name)+'.</p>':'')+'</div>'+
      (!setup?primary:'')+'</section>'+
      '<nav class="fh-places" aria-label="Forum places">'+button('open-road','Via',' aria-label="Via (The Road)"')+
      button('forum-persona-tab','Persōna',' data-t="portrait"')+button('open-tabernae','Tabernae',' aria-label="Tabernae (Market)"')+
      button('open-domus','Domus',' data-r="tablinum"')+button('open-appendix','Codex')+
      button('open-biblioteca','Bibliothēca')+button('open-spectacula','Spectācula')+
      button('open-arca','Arca',' aria-label="Arca (Wallet and possessions)"')+'</nav>'+
      awards.join('')+(practice?practice[0]:'')+
      '<div class="fh-civic"><div class="fh-today">'+window.__civicForum.saying()+'</div>'+
      standing()+monuments()+'</div>'+
      '<p class="fh-review">'+button(review.due||review.newN?'rev-start':'rev-more',review.due?'Review · '+review.due+' due':'Review vocabulary')+'</p></main>';
  };

  ACT['open-road']=function(){V.screen='via';render(true)};
  ACT['forum-monuments']=function(){V.fTab='map';ACT['open-forum']()};
  ACT['open-tabernae']=function(){V.screen='tabernae';render(true)};
  ACT['open-arca']=function(){V.screen='arca';render(true)};
  ACT['forum-persona-tab']=function(t){V.avTab=t.dataset.t;ACT['open-avatar']()};
  var oldHeader=header;
  header=function(){
    return oldHeader().replace('id="cloud-status" role','id="cloud-status" class="fh-storage" role')
      .replace('>Device progress</button>','>Progress settings</button>');
  };
  var oldMarkup=publicPracticeMarkup;
  publicPracticeMarkup=function(html){
    return oldMarkup(html).replace(/data-act="home">(All lessons|Back to lessons)<\/button>/g,'data-act="home">Forum</button>');
  };

  var style=document.createElement('style');
  style.textContent=`
    .fh{--fh-gold:#d8bd80}.fh-hero{display:grid;grid-template-columns:1fr minmax(0,1.15fr);align-items:end;gap:1.5rem;padding:clamp(1rem,3vw,2rem);margin:.4rem 0 0;background:#203c5a;color:#fff;border-radius:12px 12px 0 0;border-top:4px solid var(--fh-gold)}
    .fh-hero h1{font-size:clamp(2.5rem,6vw,4.2rem);line-height:1;margin:.22em 0 .12em;color:inherit}.fh-hero p{margin:.2rem 0}.fh-date{color:#f0d99e;font-size:clamp(1rem,2.4vw,1.28rem)}.fh-greeting{overflow-wrap:anywhere}
    .fh-hero .lc-next{background:var(--surface);color:var(--ink);margin:0;min-width:0}.fh-hero .lc-next .btn{white-space:normal;text-align:left}.fh-next{justify-self:end}
    .fh-places{display:flex;flex-wrap:wrap;gap:.45rem;padding:.75rem;background:var(--surface);border:1px solid var(--line);border-top:0;border-radius:0 0 12px 12px;margin-bottom:1rem}.fh-places .btn{font-weight:650}
    .fh-civic{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1.1fr) minmax(0,.85fr);gap:.8rem;align-items:start}.fh-civic .panel{margin:0;padding:.9rem}.fh-civic h2{font-size:1.4rem;margin:0 0 .25rem}.fh-civic p{margin:.3rem 0 .6rem}
    .fh-rank{display:flex;gap:.6rem;align-items:center}.fh-rank-image{width:3.25rem;height:3.25rem;object-fit:contain}.fh-virtues{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem;margin:.6rem 0}
    .fh-virtue{min-width:0}.fh-virtue summary{list-style:none;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:.24rem;padding:.32rem;cursor:pointer;min-height:2.6rem;font-size:.82rem}.fh-virtue summary::-webkit-details-marker{display:none}
    .fh-virtue[open]{grid-column:1/-1}.fh-virtue p{font-size:.86rem}.fh-signature summary{border:2px solid var(--brass)}.fh-virtue-image{width:1.35rem;height:1.35rem;object-fit:contain}
    .fh-monument-image{display:block;max-height:140px;max-width:100%;margin:.4rem 0}.fh-review{margin-top:.7rem}.fh-storage{background:var(--surface-2);border-radius:1rem;padding:.25rem .58rem;overflow-wrap:anywhere}
    @media(max-width:760px){.fh-civic{grid-template-columns:repeat(2,minmax(0,1fr))}.fh-today{grid-column:1/-1}}
    @media(max-width:490px){.fh-hero,.fh-civic{grid-template-columns:minmax(0,1fr);gap:.65rem}.fh-hero .lc-next{margin-top:.3rem}.fh-next{justify-self:start}.fh .c2opts .btn{white-space:normal}.top-in,.top-r{min-width:0;flex-wrap:wrap}.fh-storage{flex:1 1 auto}.fh-places .btn{padding:.42rem .6rem}}
  `;
  document.head.appendChild(style);
})();
