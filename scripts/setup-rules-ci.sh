#!/usr/bin/env bash
# One-time setup: run in Google Cloud Shell as the owner of latinrw.
# No service account keys are created. No rules or student documents are changed.
set -euo pipefail
rules_project=latinrw
rules_number=$(gcloud projects describe "$rules_project" --format='value(projectNumber)')
if [[ "$rules_number" != 203865387786 ]]; then
  echo 'Unexpected project number; stop and check the workflow configuration.' >&2
  exit 1
fi
rules_account=romanway-rules-deployer@latinrw.iam.gserviceaccount.com
rules_pool=romanway-github
rules_provider=romanway

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com firebaserules.googleapis.com firebase.googleapis.com firestore.googleapis.com cloudresourcemanager.googleapis.com --project="$rules_project"
if ! gcloud iam service-accounts describe "$rules_account" --project="$rules_project" >/dev/null 2>&1; then
  gcloud iam service-accounts create romanway-rules-deployer --display-name='Roman Way rules deployer' --project="$rules_project"
fi
if ! gcloud iam workload-identity-pools describe "$rules_pool" --location=global --project="$rules_project" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$rules_pool" --location=global --display-name='Roman Way GitHub' --project="$rules_project"
fi
rules_mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.workflow_ref=assertion.workflow_ref,attribute.event_name=assertion.event_name'
rules_condition="assertion.repository_id == '1464970094' && assertion.repository_owner_id == '358841096' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'drpatricklake/romanway/.github/workflows/firestore-rules.yml@refs/heads/main' && (assertion.event_name == 'push' || assertion.event_name == 'workflow_dispatch')"
if gcloud iam workload-identity-pools providers describe "$rules_provider" --workload-identity-pool="$rules_pool" --location=global --project="$rules_project" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$rules_provider" --workload-identity-pool="$rules_pool" --location=global --project="$rules_project" --attribute-mapping="$rules_mapping" --attribute-condition="$rules_condition" --issuer-uri=https://token.actions.githubusercontent.com
else
  gcloud iam workload-identity-pools providers create-oidc "$rules_provider" --workload-identity-pool="$rules_pool" --location=global --project="$rules_project" --attribute-mapping="$rules_mapping" --attribute-condition="$rules_condition" --issuer-uri=https://token.actions.githubusercontent.com
fi
gcloud iam service-accounts add-iam-policy-binding "$rules_account" --project="$rules_project" --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/projects/$rules_number/locations/global/workloadIdentityPools/$rules_pool/attribute.repository_id/1464970094"
gcloud projects add-iam-policy-binding "$rules_project" --member="serviceAccount:$rules_account" --role=roles/firebaserules.admin --condition=None
# Metadata/API checks made by Firebase CLI; this role grants no student-data access.
rules_permissions='firebase.projects.get,resourcemanager.projects.get,serviceusage.services.get,serviceusage.services.use,datastore.databases.get'
if gcloud iam roles describe romanwayRulesCliMetadata --project="$rules_project" >/dev/null 2>&1; then
  gcloud iam roles update romanwayRulesCliMetadata --project="$rules_project" --permissions="$rules_permissions" --stage=GA
else
  gcloud iam roles create romanwayRulesCliMetadata --project="$rules_project" --title='Roman Way rules CLI metadata' --permissions="$rules_permissions" --stage=GA
fi
gcloud projects add-iam-policy-binding "$rules_project" --member="serviceAccount:$rules_account" --role="projects/$rules_project/roles/romanwayRulesCliMetadata" --condition=None
printf '\nGoogle authorization configured. Allow a few minutes for IAM propagation.\nMerge the reviewed PR, or rerun the workflow on main, to test the first deployment.\n'
