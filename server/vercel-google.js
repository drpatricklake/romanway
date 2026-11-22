/* Keyless Google ADC: only short-lived Vercel OIDC tokens are written to /tmp. */
import {writeFile,rename,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {getVercelOidcToken} from '@vercel/oidc';
let directory;
export async function prepareGoogleIdentity(env=process.env,tokenSupplier=getVercelOidcToken){
 if(env.ROMANWAY_GOOGLE_AUTH!=='vercel-oidc')return;
 const number=env.GCP_PROJECT_NUMBER,sa=env.GCP_SERVICE_ACCOUNT_EMAIL;
 if(!/^\d+$/.test(number||'')||!/^romanway-registration@latinrw\.iam\.gserviceaccount\.com$/.test(sa||''))throw new Error('Invalid Google identity configuration');
 directory ||= mkdtemp(join(tmpdir(),'romanway-oidc-'));
 const dir=await directory,tokenFile=join(dir,'token'),configFile=join(dir,'adc.json');
 const temporary=join(dir,randomUUID());await writeFile(temporary,await tokenSupplier(),{mode:0o600});await rename(temporary,tokenFile);
 const config={type:'external_account',audience:`//iam.googleapis.com/projects/${number}/locations/global/workloadIdentityPools/romanway-vercel/providers/vercel`,subject_token_type:'urn:ietf:params:oauth:token-type:jwt',token_url:'https://sts.googleapis.com/v1/token',service_account_impersonation_url:`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${sa}:generateAccessToken`,credential_source:{file:tokenFile}};
 const configTmp=join(dir,randomUUID());await writeFile(configTmp,JSON.stringify(config),{mode:0o600});await rename(configTmp,configFile);
 env.GOOGLE_APPLICATION_CREDENTIALS=configFile;
}
