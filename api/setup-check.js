import {getApps,initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getAppCheck} from 'firebase-admin/app-check';
import {prepareGoogleIdentity} from '../server/vercel-google.js';
const OWNER='ZU5goPmM28X40rVridJLtZ9JcBu2';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(process.env.VERCEL_ENV!=='preview')return res.status(404).json({error:'Not found'});
 if(req.method==='GET')return res.status(200).json({siteKey:process.env.ROMANWAY_APPCHECK_SITE_KEY||null});
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(req.headers.origin!==`https://${req.headers.host}`)return res.status(403).json({error:'Use the preview website.'});
 const token=String(req.headers.authorization||'').replace(/^Bearer /,'');if(!token)return res.status(401).json({error:'Sign in as the app owner.'});
 let stage='Google identity';
 try{
  await prepareGoogleIdentity();const app=getApps()[0]||initializeApp({credential:applicationDefault(),projectId:'latinrw'});
  stage='Owner authorization';const identity=await getAuth(app).verifyIdToken(token);
  if(identity.uid!==OWNER)return res.status(403).json({error:'This setup check is restricted to Patrick’s existing instructor account.'});
  stage='Firebase Auth server access';await getAuth(app).verifyIdToken(token,true);
  stage='Firestore server access';await getFirestore(app).doc(`accounts/${OWNER}`).get();
  stage='App Check';if(!req.headers['x-firebase-appcheck'])return res.status(400).json({error:'App Check token missing.'});
  await getAppCheck(app).verifyToken(req.headers['x-firebase-appcheck']);
  return res.status(200).json({googleIdentity:'passed',firebaseAuth:'passed',firestore:'passed',appCheck:'passed',registrationOpen:process.env.ROMANWAY_REGISTRATION_ENABLED==='true'});
 }catch(e){return res.status(503).json({error:'Setup check failed',stage,code:typeof e.code==='string'||typeof e.code==='number'?String(e.code):'unavailable'});}
}
