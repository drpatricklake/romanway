import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {extname} from 'node:path';
import {chromium} from 'playwright';

// Exercise the actual public package and its policy in a real browser.
// Hosted Vercel routing, headers, and injected scripts still need a live check.
const root=new URL('../../.vercel/output/',import.meta.url);
const config=JSON.parse(readFileSync(new URL('config.json',root)));
const manifest=JSON.parse(readFileSync(new URL('static/assets/manifest.json',root)));
const allowed=new Set([
 '/','/index.html','/app-config.js','/app-bootstrap.js','/local-progress.js','/pilot-core.js','/word-forms.js',
 ...manifest.images.concat(manifest.worksheets).map(asset=>'/'+asset.path),
]);
const contentTypes={
 '.html':'text/html; charset=utf-8','.js':'text/javascript','.jpg':'image/jpeg',
 '.webp':'image/webp','.pdf':'application/pdf',
};
const server=http.createServer((req,res)=>{
 for(const [k,v] of Object.entries(config.routes[0].headers))res.setHeader(k,v);
 const path=new URL(req.url,'http://localhost').pathname;
 if(!allowed.has(path)){res.writeHead(404);res.end(readFileSync(new URL('static/404.html',root)));return}
 const file=path==='/'?'index.html':path.slice(1);
 res.setHeader('Content-Type',contentTypes[extname(file)]);
 res.end(readFileSync(new URL('static/'+file,root)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({...(process.env.ROMANWAY_CHROMIUM_PATH?{executablePath:process.env.ROMANWAY_CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const requests=[],errors=[],policyFailures=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__policyFailures=[];
  document.addEventListener('securitypolicyviolation',e=>window.__policyFailures.push(e.violatedDirective+': '+e.blockedURI));
 });
 await page.goto(base);
 await page.getByRole('button',{name:'Start or resume practice'}).click();
 await page.locator('[data-act="open-lesson"][data-l="1"]').first().click();
 await page.getByRole('tab',{name:'Guided notes',exact:true}).click();
 // Include interface-like wording to catch accidental rewriting of learner text.
 const answer='Submitted — Your instructor can read it. Local audit 824619.';
 await page.locator('#w-s1-conj').fill(answer);
 const key='romanway:public-practice:progress:v1';
 await page.waitForFunction(({key,answer})=>localStorage.getItem(key)?.includes(answer),{key,answer});
 await page.reload();
 await page.getByRole('button',{name:'Start or resume practice'}).click();
 await page.locator('[data-act="open-lesson"][data-l="1"]').first().click();
 await page.getByRole('tab',{name:'Guided notes',exact:true}).click();
 assert.equal(await page.locator('#w-s1-conj').inputValue(),answer);
 assert.doesNotMatch(await page.locator('body').innerText(),/your instructor can read these/i);
 await page.locator('[data-act="home"]').first().click();
 await page.locator('[data-act="open-domus"]').first().click();
 await page.locator('[data-act="dm-room"][data-r="atrium"]').click();
 assert.equal(await page.locator('[data-act^="at-"],[data-act^="atr-"]').count(),0);
 await page.locator('[data-act="home"]').first().click();
 await page.locator('[data-act="open-spectacula"]').first().click();
 await page.locator('[data-act="open-arena"]').first().click();
 await page.locator('[data-act="ar-ludus"]').click();
 await page.locator('[data-act="ar-ans"]').first().click();
 await page.locator('[data-act="ar-next"]').first().click();
 await page.locator('[data-act="home"]').first().click();
 await page.locator('[data-act="open-spectacula"]').first().click();
 await page.locator('[data-act="open-circus"]').first().click();
 assert.doesNotMatch(await page.locator('body').innerText(),/classmate|join your class|ghost race/i);
 await page.locator('[data-act="open-signin"]').first().click();
 await page.getByRole('button',{name:'Save now',exact:true}).click();
 assert.match(await page.locator('body').innerText(),/Saved on this device/);
 const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 assert.equal(stored.progress.user,undefined);
 assert.equal(stored.progress.settings.aiFeedback,false);
 policyFailures.push(...await page.evaluate(()=>window.__policyFailures));
 assert.deepEqual(errors,[]);
 assert.deepEqual(policyFailures,[]);
 assert.ok(requests.length>0);
 assert.ok(requests.some(r=>new URL(r.url).pathname.startsWith('/assets/')),'Browser requested reviewed artwork');
 for(const r of requests){
  assert.equal(new URL(r.url).origin,base,r.url);
  assert.ok(allowed.has(new URL(r.url).pathname),r.url);
  assert.equal(r.method,'GET');assert.equal(r.body,null);
  assert.ok(!r.url.includes('824619'));
 }
 console.log(`PASS Chromium Public Practice: exact answer survives reload, solo Arena input, classroom controls absent, device saving, ${requests.length} same-origin static GETs, zero response uploads or third-party requests, zero script/CSP errors.`);
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
