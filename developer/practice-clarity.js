/* Keep generated single-form prompts distinct from full-synopsis headings. */
(function(){
 var priorCells=gridCells;
 gridCells=function(gid){
  var cells=priorCells(gid),g=GRIDS[gid];if(!g||g.kind!=='list')return cells;
  var by={};g.items.forEach(function(it,i){
   var label=String(it.label||'').replace(/^\s*\d+[a-z]?\.\s*/i,'');
   var person=/(?:first|second|third|[123](?:st|nd|rd))\s+person\s+(?:singular|plural)/i.exec(label);
   if(!person)return;
   var lemma=label.slice(0,person.index).replace(/\s+in\s+the\s*$/i,'').replace(/[,\s]+$/,'');
   var tail=label.slice(person.index+person[0].length),headerVoice=/active/i.test(tail)&&!/passive/i.test(tail)?'active':/passive/i.test(tail)&&!/active/i.test(tail)?'passive':'';
   it.rows.forEach(function(r,j){
    var form=String(r.given||r.sent||'').trim();
    if(/^(?:present active|perfect passive|future active) participle$/i.test(form)){
     by[gid+'|'+i+'|'+j]=lemma+', '+form.toLowerCase()+', '+(/^present/i.test(form)?'nominative singular':'masculine nominative singular');return;
    }
    if(!/^(?:(?:active|passive):\s*)?(?:present|imperfect|future(?: perfect)?|perfect|pluperfect)(?:\s+(?:active|passive|indicative|subjunctive))*$/i.test(form))return;
    var voice=(/\b(active|passive)\b/i.exec(form)||[])[1]||headerVoice;
    var mood=(/\b(indicative|subjunctive)\b/i.exec(form)||[])[1]||'';
    var tense=form.replace(/\b(active|passive|indicative|subjunctive)\b/ig,'').replace(/:/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    by[gid+'|'+i+'|'+j]=lemma+', '+person[0].toLowerCase()+', '+[tense,voice.toLowerCase(),mood.toLowerCase()].filter(Boolean).join(' ');
   });
  });
  cells.forEach(function(c){if(by[c.key])c.prompt=by[c.key]});return cells;
 };
 // English typing variants only; this does not loosen Latin spelling or tense/person keys.
 var priorEnglish=normEn;
 normEn=function(s){
  s=String(s||'').replace(/[\u2018\u2019]/g,"'");
  var contractions={dont:'do not',doesnt:'does not',didnt:'did not',isnt:'is not',arent:'are not',wasnt:'was not',werent:'were not',havent:'have not',hasnt:'has not',hadnt:'had not',wont:'will not',cant:'cannot',couldnt:'could not',shouldnt:'should not',wouldnt:'would not'};
  s=s.replace(/\b(?:don't|doesn't|didn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|won't|can't|couldn't|shouldn't|wouldn't|dont|doesnt|didnt|isnt|arent|wasnt|werent|havent|hasnt|hadnt|wont|cant|couldnt|shouldnt|wouldnt)\b/gi,function(v){return contractions[v.toLowerCase().replace(/'/g,'')]});
  s=s.replace(/\byou\s*\(?\s*(?:sing(?:ular)?|sg)\b\.?\s*\)?/gi,'you (sg.) ');
  s=s.replace(/\byou\s*\(?\s*(?:pl(?:ural)?)\b\.?\s*\)?/gi,'you (pl.) ');
  return priorEnglish(s);
 };
 var priorGrade=gradeEnglish;
 gradeEnglish=function(given,accepted,spec){
  var normalized={};Object.keys(accepted).forEach(function(key){normalized[normEn(key)]=accepted[key]});
  return priorGrade(given,normalized,spec);
 };
})();
