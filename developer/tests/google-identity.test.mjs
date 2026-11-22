import assert from 'node:assert/strict';
import {readFile,stat,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {prepareGoogleIdentity} from '../../server/vercel-google.js';
const env={ROMANWAY_GOOGLE_AUTH:'vercel-oidc',GCP_PROJECT_NUMBER:'203865387786',GCP_SERVICE_ACCOUNT_EMAIL:'romanway-registration@latinrw.iam.gserviceaccount.com'};
try{
 await prepareGoogleIdentity(env,async()=> 'test-token-one');
 const config=JSON.parse(await readFile(env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
 assert.match(config.audience,/romanway-vercel\/providers\/vercel$/);
 assert.equal(await readFile(config.credential_source.file,'utf8'),'test-token-one');
 assert.equal((await stat(config.credential_source.file)).mode&0o777,0o600);
 await prepareGoogleIdentity(env,async()=> 'test-token-two');
 assert.equal(await readFile(config.credential_source.file,'utf8'),'test-token-two');
 console.log('PASS keyless ADC configuration, private token file and token refresh');
}finally{if(env.GOOGLE_APPLICATION_CREDENTIALS)await rm(dirname(env.GOOGLE_APPLICATION_CREDENTIALS),{recursive:true,force:true});}
