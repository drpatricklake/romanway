import http from 'node:http';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const allowed=new Set(['/about-feedback-preview.html','/about-feedback-content.json']);
const server=http.createServer((req,res)=>{const path=(req.url||'').split('?')[0];if(!allowed.has(path)){res.statusCode=404;res.end();return}res.setHeader('Content-Type',path.endsWith('.json')?'application/json':'text/html');res.end(readFileSync(new URL(path.slice(1),root)))});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.ROMANWAY_CHROMIUM_PATH?{executablePath:process.env.ROMANWAY_CHROMIUM_PATH}:{})});
const base='http://127.0.0.1:'+server.address().port;
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[],outbound=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base))outbound.push(r.url())});
 await page.goto(base+'/about-feedback-preview.html?lesson=XI&activity=NLE&question=3');
 await page.locator('#features .card').last().waitFor();assert.equal(await page.locator('#features .card').count(),9);
 assert.ok((await page.locator('#about-copy').innerText()).includes('Frank J. Groten'));
 await page.locator('#tab-about').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-credits').getAttribute('aria-selected'),'true');
 await page.getByText('Read the original textbook preface',{exact:true}).click();assert.ok((await page.locator('#original-preface').innerText()).includes('June 23, 2022'));
 await page.locator('#tab-feedback').click();assert.equal(await page.locator('#location').inputValue(),'XI · NLE · 3');
 await page.locator('#category').selectOption('Latin or answer-key correction');assert.equal(await page.locator('#latin-extra').isVisible(),true);
 assert.equal(await page.locator('#correction').getAttribute('required'),null,'A student can report uncertainty without a diagnosis');
 await page.locator('#details').fill('The answer seems incorrect.');await page.locator('#tab-about').click();await page.locator('#tab-feedback').click();assert.equal(await page.locator('#details').inputValue(),'The answer seems incorrect.');
 assert.equal(await page.locator('#send').isDisabled(),true);await page.locator('#preview-message').click();assert.ok((await page.locator('#confirmation').innerText()).includes('No feedback was sent'));
 await page.locator('#category').selectOption('Technical problem');assert.equal(await page.locator('#latin-extra').isVisible(),false);
 for(const key of ['about','credits','feedback']){await page.setViewportSize({width:390,height:844});await page.locator('#tab-'+key).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Overflow on '+key)}
 assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(outbound,[]);assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/romanway-about-phone.png',fullPage:true});
 console.log('PASS About preview copy loading, credits, archival preface, keyboard tabs, safe context, conditional fields, retained edits, disabled submission, no external requests/storage, and three phone-sized panels.');
}finally{await browser.close();server.close()}
