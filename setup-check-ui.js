import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {initializeAppCheck,ReCaptchaEnterpriseProvider,getToken} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app-check.js';
const app=initializeApp({apiKey:'AIzaSyBN4RTbuNrMKL0DKhXTPTgJOEc2CtSq-mo',authDomain:'latinrw.firebaseapp.com',projectId:'latinrw',appId:'1:203865387786:web:46e90247f170fc848680f3'});
const auth=getAuth(app),result=document.getElementById('result'),button=document.getElementById('check');
let check;
const ready=fetch('/api/setup-check').then(async r=>{const c=await r.json();if(!r.ok||!c.siteKey)throw Error('Preview configuration is not ready.');check=initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(c.siteKey),isTokenAutoRefreshEnabled:true});});
ready.catch(e=>{result.textContent=e.message;});
button.onclick=async()=>{
 button.disabled=true;
 try{
  // Open the popup in the user gesture; do not wait for unrelated network calls first.
  const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  const {user}=await signInWithPopup(auth,provider);await ready;
  result.textContent='Checking the server identity and App Check…';
  const appToken=await getToken(check,true);
  const r=await fetch('/api/setup-check',{method:'POST',headers:{Authorization:'Bearer '+await user.getIdToken(),'X-Firebase-AppCheck':appToken.token}});
  result.textContent=JSON.stringify(await r.json(),null,2);
 }catch(e){result.textContent='Check could not complete: '+(e.code||e.message);}
 finally{button.disabled=false;}
};
