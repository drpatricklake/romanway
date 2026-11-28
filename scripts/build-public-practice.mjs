// Explicit static-only Vercel Build Output API: no account pages, adapters, or functions.
import {readFileSync,writeFileSync,mkdirSync,rmSync,copyFileSync,cpSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'.vercel/output');
const read=name=>readFileSync(resolve(root,name),'utf8');
assert.match(read('app-config.js'),/edition: 'public-practice'/,'Refusing to package the classroom edition as Public Practice');
const csp="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'";
let html=read('index.html');
// Remove the captured school-filter script entirely from the public deliverable.
html=html.replace(/<script type='text\/javascript' >[\s\S]*?<\/script>/,'');
html=html.replace(/<link[^>]*https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/g,'');
html=html.replace('<head>','<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="referrer" content="no-referrer">');
assert.ok(!html.includes('new XMLHttpRequest'),'School filter must be absent');
assert.ok(!html.includes('href="https://fonts.'),'No third-party font requests');
// Keep the large app script out of the HTML parser's speculative image scan.
const appBlock=/<script>(\n\(function\(\)\{\n'use strict';[\s\S]*?\nrender\(\);\n\}\)\(\);\n)<\/script>/g;
const appScripts=[...html.matchAll(appBlock)];
assert.equal(appScripts.length,1,'Expected one generated application script');
html=html.replace(appScripts[0][0],'<script src="/romanway-app.js"></script>');
rmSync(output,{recursive:true,force:true});mkdirSync(resolve(output,'static'),{recursive:true});
writeFileSync(resolve(output,'static/index.html'),html);
writeFileSync(resolve(output,'static/romanway-app.js'),appScripts[0][1]);
for(const file of ['app-config.js','app-bootstrap.js','local-progress.js','pilot-core.js','word-forms.js'])copyFileSync(resolve(root,file),resolve(output,'static',file));
cpSync(resolve(root,'assets'),resolve(output,'static/assets'),{recursive:true});
writeFileSync(resolve(output,'static/404.html'),'<!doctype html><meta charset="utf-8"><title>Public Practice</title><h1>Page unavailable</h1><p>This edition needs no account or classroom connection.</p><a href="/">Return to Public Practice</a>');
writeFileSync(resolve(output,'config.json'),JSON.stringify({version:3,routes:[
 {src:'/(.*)',headers:{'Content-Security-Policy':csp,'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'},continue:true},
 {src:'/',dest:'/index.html'},
 {handle:'filesystem'},
 {src:'/(.*)',dest:'/404.html',status:404}
]},null,2));
console.log('Built Public Practice: static app and reviewed assets, no functions; connect-src none.');
