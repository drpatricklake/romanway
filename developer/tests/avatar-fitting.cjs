const fs=require('fs'),vm=require('vm');const {createCanvas,loadImage}=require(process.env.ROMANWAY_CANVAS_MODULE || '@napi-rs/canvas');
const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('(function (root, factory)',html.indexOf('/* ================= The developer’s extended wardrobe renderer (full-canvas fitted layers)'));const ctx={};vm.createContext(ctx);vm.runInContext(html.slice(start,html.indexOf('return { canWear, findItems, choosePatron, createRenderer };',start)+'return { canWear, findItems, choosePatron, createRenderer };'.length+4),ctx);
function embedded(name){
 const m=new RegExp('\\b'+name+'\\s*=\\s*([\\{\\[])').exec(html);
 let depth=0,quoted=false,escaped=false;
 for(let i=m.index+m[0].length-1,start=i;i<html.length;i++){
  const c=html[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
  if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){if(--depth===0)return JSON.parse(html.slice(start,i+1));}
 }
 throw Error('Missing embedded '+name);
}
const data=embedded('WD'),atlas=embedded('WAT'),sheets=embedded('WSH'),cache={};
const additions=embedded('CWH');
for(const pose of additions.WADD.poses) if(!data.poses.some(entry=>entry.id===pose.id)) data.poses.push(pose);
for(const item of additions.WADD.items) if(!data.items.some(entry=>entry.id===item.id)) data.items.push(item);
const r=ctx.RomanWardrobe.createRenderer(data,{makeCanvas:createCanvas,loadImage:async n=>{if(additions.W2[n])return loadImage(additions.W2[n]);const [key,x,y,w,h]=atlas[n];const im=await(cache[key]??=loadImage('.'+sheets[key].u));const c=createCanvas(w,h);c.getContext('2d').drawImage(im,x,y,w,h,0,0,w,h);return c}});
(async()=>{let count=0;for(const p of data.poses){for(const phase of data.phases){const c=await r.render(p.id,[],{phase:phase.id,lesson:57});if(phase.id==='legend' && process.env.ROMANWAY_RENDER_DIR)fs.writeFileSync(process.env.ROMANWAY_RENDER_DIR+'/avatar-'+p.id+'.png',c.toBuffer('image/png'));count++;}for(const item of data.items.filter(i=>i.slot==='footwear')){if(ctx.RomanWardrobe.canWear(p,item,57))await r.render(p.id,[item.id],{phase:'legend',lesson:57});}}console.log('PASS '+count+' stage renders and every eligible footwear/pose pairing');})().catch(e=>{console.error(e);process.exit(1)});
