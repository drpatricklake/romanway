import http from 'node:http';import {readFileSync} from 'node:fs';import {chromium} from 'playwright';import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const server=http.createServer((req,res)=>{try{const f=req.url.split('?')[0].slice(1);if(!['register.html','registration-ui.js'].includes(f))throw Error();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html');res.end(readFileSync(new URL(f,root)));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const errors=[];
try{
 for(const mode of ['signed-out','student','teen','adult','teacher','disabled']){
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.gstatic.com/**',async route=>{const isAuth=route.request().url().includes('firebase-auth');await route.fulfill({contentType:'text/javascript',body:isAuth?`const user=${mode==='signed-out'||mode==='disabled'?'null':"{uid:'test',emailVerified:true,getIdToken:async()=> 'test'}"};export const getAuth=()=>({currentUser:user});export const setPersistence=async()=>{};export const browserSessionPersistence={};export const onAuthStateChanged=(a,cb)=>queueMicrotask(()=>cb(user));export const GoogleAuthProvider=class{};export const signInWithPopup=async()=>{};export const createUserWithEmailAndPassword=async()=>{};export const signInWithEmailAndPassword=async()=>{};export const sendEmailVerification=async()=>{};export const sendPasswordResetEmail=async()=>{};export const updatePassword=async()=>{};export const signOut=async()=>{};`:'export const initializeApp=()=>({});'});});
  await page.route('**/api/registration',async route=>{let result={enabled:mode!=='disabled'};const b=route.request().postDataJSON();if(b?.action==='session')result={account:{role:mode==='teen'||mode==='adult'?'independent':mode,adultConfirmed:mode==='adult'||mode==='teacher',approvedTeacher:mode==='teacher'},support:mode==='adult'||mode==='teacher'?{kofi:'https://ko-fi.com/example'}:{}};if(b?.action==='classes')result={classes:[]};await route.fulfill({status:mode==='disabled'?503:200,json:result});});
  await page.goto(base+'/register.html');
  if(mode==='signed-out'){await page.getByRole('button',{name:'I’m a Student',exact:true}).click();await page.getByRole('heading',{name:'Student access'}).waitFor();assert.equal(await page.locator('#email').isVisible(),false);}
  else if(mode==='disabled')await page.getByRole('status').filter({hasText:'Registration is not open yet'}).waitFor();
  else {await page.getByRole('status').filter({hasText:'Account ready'}).waitFor();assert.equal(await page.locator('#support').isVisible(),['adult','teacher'].includes(mode));assert.equal(await page.locator('#teacherTools').isVisible(),mode==='teacher');}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,mode+' mobile overflow');await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS mobile registration paths, teacher tools, disabled service, and student/teen payment exclusion');
}finally{await browser.close();await new Promise(r=>server.close(r));}
