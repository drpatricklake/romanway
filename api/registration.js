import {getApps,initializeApp,applicationDefault,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getAppCheck} from 'firebase-admin/app-check';
import {prepareGoogleIdentity} from '../server/vercel-google.js';
import {createRegistration} from '../server/registration.js';
let run;
function supportURL(value,host){try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname===host||u.hostname==='www.'+host)?u.href:null;}catch{return null;}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
 if(req.method==='POST'&&req.headers.origin!==`https://${req.headers.host}`)return res.status(403).json({error:'Use the app website.'});
 if(process.env.ROMANWAY_REGISTRATION_ENABLED!=='true')return res.status(503).json({enabled:false,error:'New registration is not open yet. Existing Google sign-in remains available.'});
 if(!process.env.ROMANWAY_USERNAME_SECRET)return res.status(503).json({error:'Registration configuration is incomplete.'});
 try{
  await prepareGoogleIdentity();
  if(!run){const app=getApps()[0]||initializeApp({credential:process.env.FIREBASE_ADMIN_CREDENTIALS?cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS)):applicationDefault(),projectId:'latinrw'});run=createRegistration({db:getFirestore(app),auth:getAuth(app),verifyAppCheck:t=>getAppCheck(app).verifyToken(t),secret:process.env.ROMANWAY_USERNAME_SECRET,testMode:process.env.VERCEL_ENV==='preview'&&process.env.ROMANWAY_SETUP_TEST_MODE==='true',support:{patreon:supportURL(process.env.ROMANWAY_PATREON_URL,'patreon.com'),kofi:supportURL(process.env.ROMANWAY_KOFI_URL,'ko-fi.com')}});}
  const body=req.method==='POST'?req.body||{}:{};
  if(Buffer.byteLength(JSON.stringify(body))>8192)return res.status(413).json({error:'Request too large.'});
  const action=req.method==='GET'?'config':body.action;
  if(action==='config')return res.status(200).json({enabled:true,appCheckSiteKey:process.env.ROMANWAY_APPCHECK_SITE_KEY||null});
  const result=await run(action,body,String(req.headers.authorization||'').replace(/^Bearer /,''),String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0],req.headers['x-firebase-appcheck']);
  return res.status(200).json(result);
 }catch(e){const status=e.status||(['auth/id-token-expired','auth/argument-error','auth/id-token-revoked'].includes(e.code)?401:500);return res.status(status).json({error:status<500?e.message:'Account service could not complete the request. Please try again.'});}
}
