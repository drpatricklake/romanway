import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {initializeAppCheck,ReCaptchaEnterpriseProvider,getToken} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app-check.js';
const app=initializeApp({apiKey:'AIzaSyBN4RTbuNrMKL0DKhXTPTgJOEc2CtSq-mo',authDomain:'latinrw.firebaseapp.com',projectId:'latinrw',appId:'1:203865387786:web:46e90247f170fc848680f3'});
const auth=getAuth(app),result=document.getElementById('result'),button=document.getElementById('check');
let check;
const help={
 'auth/unauthorized-domain':'Google has not authorized this exact preview hostname. Run the preview-domain Cloud Shell script, then reload this page.',
 'auth/popup-blocked':'The browser blocked the Google window. Allow pop-ups for this site and try again.',
 'auth/popup-closed-by-user':'The Google window closed before sign-in finished. Open this page directly in Edge, Chrome, or Safari and try again.',
 'auth/network-request-failed':'Google sign-in could not connect. Check whether the school network is blocking it.',
 'appCheck/recaptcha-error':'Google sign-in completed, but reCAPTCHA/App Check failed. The preview hostname or site-key settings need checking.'
};
function deadline(p,stage){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(stage+' timed out. Please send this message to Patrick’s developer.')),30000);})]).finally(()=>clearTimeout(timer));}

const ready=fetch('/api/setup-check').then(async r=>{const c=await r.json();if(!r.ok||!c.siteKey)throw Error('Preview configuration is not ready.');check=initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(c.siteKey),isTokenAutoRefreshEnabled:true});});
ready.catch(e=>{result.textContent=e.message;});
button.onclick=async()=>{
 button.disabled=true;
 let stage='Google sign-in';
 result.textContent='Opening Google sign-in…';
 try{
  // Open the popup in the user gesture; do not wait for unrelated network calls first.
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  const user=auth.currentUser||(await deadline(signInWithPopup(auth,provider),stage)).user;
  stage='Preview configuration';result.textContent='Google sign-in completed. Loading App Check configuration…';await deadline(ready,stage);
  stage='App Check';result.textContent='Google sign-in completed. Checking App Check…';
  const appToken=await deadline(getToken(check,true),stage);
  stage='Server authorization';result.textContent='Google sign-in and browser App Check completed. Checking server access…';
  const r=await deadline(fetch('/api/setup-check',{method:'POST',headers:{Authorization:'Bearer '+await user.getIdToken(),'X-Firebase-AppCheck':appToken.token}}),stage);
  result.textContent=JSON.stringify(await r.json(),null,2);
 }catch(e){result.textContent='Stopped at: '+stage+'\n'+(help[e.code]||e.message||'Please try again.')+(e.code?'\nError code: '+e.code:'');}
 finally{button.disabled=false;}
};

auth.authStateReady().then(()=>{if(auth.currentUser)button.textContent='Check setup with your signed-in Google account';});
