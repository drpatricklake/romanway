#!/usr/bin/env bash
# Run only in Google Cloud Shell. Authorizes production runtime; exports XP without database writes.
set -euo pipefail
umask 077
PROJECT=latinrw
NUMBER=203865387786
POOL=romanway-vercel
SA=romanway-registration@latinrw.iam.gserviceaccount.com
SUBJECT='owner:lake-s-latin:project:latin_-lessons-i-to-lvii-with-appendix-the-road-and-the-forum-draft-2:environment:production'
COMMIT=23895122c460b882e0203c3917fbfbcfcd028b40
export CLOUDSDK_BILLING_QUOTA_PROJECT="$PROJECT"
# Preserve the existing preview trust and add this exact production subject.
CURRENT=$(gcloud iam workload-identity-pools providers describe vercel --workload-identity-pool="$POOL" --location=global --project="$PROJECT" --format='value(attributeCondition)')
if [[ -z "$CURRENT" ]]; then
 printf 'The provider has no restrictive condition. Stop and ask for review.\n'; exit 1
fi
if [[ "$CURRENT" != *"$SUBJECT"* ]]; then
 gcloud iam workload-identity-pools providers update-oidc vercel --workload-identity-pool="$POOL" --location=global --project="$PROJECT" --attribute-condition="($CURRENT) || assertion.sub == '$SUBJECT'" --quiet
fi
gcloud iam service-accounts add-iam-policy-binding "$SA" --project="$PROJECT" --role=roles/iam.workloadIdentityUser --member="principal://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/subject/$SUBJECT" --quiet >/dev/null
printf '\nProduction identity trust configured. No registration or reward settings changed.\n'
# Application Default Credentials are distinct from gcloud CLI credentials. No private key is downloaded.
if ! gcloud auth application-default print-access-token --quiet >/dev/null 2>&1; then
 printf '\nAuthorize Google Application Default Credentials for the read-only export.\n'
 gcloud auth application-default login --project="$PROJECT"
fi
export GOOGLE_CLOUD_PROJECT="$PROJECT"
export GOOGLE_CLOUD_QUOTA_PROJECT="$PROJECT"
unset ROMANWAY_GOOGLE_AUTH FIREBASE_ADMIN_CREDENTIALS
OUT=$(mktemp -d "$HOME/romanway-atrium-review-XXXXXXXX")
git clone --quiet --no-checkout https://github.com/drpatricklake/romanway.git "$OUT/repo"
git -C "$OUT/repo" checkout --quiet "$COMMIT"
(
 cd "$OUT/repo"
 npm ci --ignore-scripts > "$OUT/install.log" 2>&1
 node scripts/atrium-baseline.mjs propose --class pilot > "$OUT/review.csv.tmp"
)
mv "$OUT/review.csv.tmp" "$OUT/review.csv"
printf '\nRead-only export complete: %s/review.csv\n' "$OUT"
printf 'No student XP, rewardsFrom or strict fields were changed. Do not run apply yet.\n'
printf 'Download the private CSV with:\ncloudshell download %q\n' "$OUT/review.csv"
printf 'Do not commit this CSV to GitHub.\n'
