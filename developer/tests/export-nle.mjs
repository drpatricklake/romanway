import {writeFileSync} from 'node:fs';
import {harness} from './harness.mjs';
const p=harness(process.argv[2]||'../../index.html'),m=p.model;
if(p.context.__nleReview.warnings.length)throw Error(JSON.stringify(p.context.__nleReview.warnings));
const sets=Object.fromEntries(Object.entries(m.NLESETS).map(([id,s])=>[id,{title:s.title,parts:s.parts,items:m.nleItems(s)}]));
const out={version:m.NLE_REVIEW_CATALOG.version,bank:m.NLEBANK,sets};
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(out,null,2)+'\n');
if(process.argv[4])writeFileSync(process.argv[4],JSON.stringify(m.NLE_REVIEW_CATALOG,null,2)+'\n');
console.log(JSON.stringify({bank:m.NLEBANK.length,sets:Object.keys(sets).length,corrections:m.NLE_REVIEW_CATALOG.bank.length,setCorrections:m.NLE_REVIEW_CATALOG.sets.length,passages:m.NLE_REVIEW_CATALOG.passages.length}));
