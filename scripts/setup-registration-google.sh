#!/usr/bin/env bash
# Run in Google Cloud Shell as an authorized project administrator. No key downloads.
set -euo pipefail
PROJECT=latinrw
# Explicitly select the consumer project for CLI and direct REST requests.
export CLOUDSDK_BILLING_QUOTA_PROJECT="$PROJECT"
NUMBER=203865387786
SA=romanway-registration@latinrw.iam.gserviceaccount.com
POOL=romanway-vercel
TEAM=lake-s-latin
APP=1:203865387786:web:46e90247f170fc848680f3
VERCEL_PROJECT=latin_-lessons-i-to-lvii-with-appendix-the-road-and-the-forum-draft-2
SUBJECT="owner:${TEAM}:project:${VERCEL_PROJECT}:environment:preview"
printf 'Configuring registration identity and App Check for project %s. Public registration remains OFF.\n' "$PROJECT"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com identitytoolkit.googleapis.com firestore.googleapis.com firebaseappcheck.googleapis.com recaptchaenterprise.googleapis.com --project="$PROJECT" --quiet
if ! gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null 2>&1; then
 gcloud iam service-accounts create romanway-registration --project="$PROJECT" --display-name='Roman Way registration runtime' --quiet
fi
for role in roles/firebaseauth.admin roles/datastore.user; do
 gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" --condition=None --quiet >/dev/null
done
if ! gcloud iam workload-identity-pools describe "$POOL" --location=global --project="$PROJECT" >/dev/null 2>&1; then
 gcloud iam workload-identity-pools create "$POOL" --location=global --project="$PROJECT" --display-name='Roman Way Vercel preview' --quiet
fi
CONDITION="assertion.sub == '${SUBJECT}'"
if gcloud iam workload-identity-pools providers describe vercel --workload-identity-pool="$POOL" --location=global --project="$PROJECT" >/dev/null 2>&1; then
 gcloud iam workload-identity-pools providers update-oidc vercel --workload-identity-pool="$POOL" --location=global --project="$PROJECT" --issuer-uri="https://oidc.vercel.com/$TEAM" --allowed-audiences="https://vercel.com/$TEAM" --attribute-mapping='google.subject=assertion.sub' --attribute-condition="$CONDITION" --quiet
else
 gcloud iam workload-identity-pools providers create-oidc vercel --workload-identity-pool="$POOL" --location=global --project="$PROJECT" --issuer-uri="https://oidc.vercel.com/$TEAM" --allowed-audiences="https://vercel.com/$TEAM" --attribute-mapping='google.subject=assertion.sub' --attribute-condition="$CONDITION" --quiet
fi
gcloud iam service-accounts add-iam-policy-binding "$SA" --project="$PROJECT" --role=roles/iam.workloadIdentityUser --member="principal://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/subject/$SUBJECT" --quiet >/dev/null
# Reuse an existing configuration; do not replace a previously registered App Check key.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
TOKEN=$(gcloud auth print-access-token)
URL="https://firebaseappcheck.googleapis.com/v1/projects/$NUMBER/apps/$APP/recaptchaEnterpriseConfig"
HTTP=$(curl -sS -o "$TMP/config.json" -w '%{http_code}' -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" "$URL")
if [[ "$HTTP" == 200 ]]; then
 KEY=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("siteKey",""))' "$TMP/config.json")
elif [[ "$HTTP" == 404 ]]; then
 KEY=''
else
 printf 'App Check read failed (HTTP %s).\n' "$HTTP"; cat "$TMP/config.json"; exit 1
fi
if [[ -z "$KEY" ]]; then
 KEY_PATH=$(gcloud recaptcha keys create --project="$PROJECT" --display-name='Roman Way web App Check' --web --domains=romanway.vercel.app --integration-type=score --format='value(name)' --quiet)
 KEY=${KEY_PATH##*/}
 python3 -c 'import json,sys;json.dump({"siteKey":sys.argv[1],"tokenTtl":"3600s"},open(sys.argv[2],"w"))' "$KEY" "$TMP/body.json"
 curl --fail-with-body -sS -X PATCH -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" -H 'Content-Type: application/json' --data-binary "@$TMP/body.json" "$URL?updateMask=siteKey,tokenTtl" > "$TMP/result.json"
fi
# Enable password sign-in; preserve Google and all existing provider settings.
curl --fail-with-body -sS -X PATCH -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" -H 'Content-Type: application/json' --data '{"signIn":{"email":{"enabled":true,"passwordRequired":true}}}' "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired" >/dev/null
printf '\nSetup complete. Public registration remains OFF. No service-account private key was created.\n'
printf 'GCP_PROJECT_NUMBER=%s\nGCP_SERVICE_ACCOUNT_EMAIL=%s\nROMANWAY_APPCHECK_SITE_KEY=%s\n' "$NUMBER" "$SA" "$KEY"
printf 'Send the three configuration lines above back to ChatGPT. They are not passwords or private keys.\n'
printf 'Do not turn on project-wide App Check enforcement yet. Preview hostname authorization and live tests are next.\n'
