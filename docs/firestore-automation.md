# Automatic Firestore rule updates

## What is included

This PR adds the Firestore rules from the prepared Classroom Pilot Update, their 42 permission assertions, a locked test toolchain, and a GitHub Actions workflow. It does not change the live app HTML or its Firebase adapters. The classroom app update remains a separate release.

Pull requests test against the local Firestore emulator using a fake demo project; Google credentials are not provided to those jobs. A push to main runs the same tests, then authenticates through Google's Workload Identity Federation and deploys **only Firestore rules** to `latinrw`. A manual run on main repeats both tests and deployment. Failed tests stop deployment. The branch-head check skips superseded queued commits, and deployments are serialized.

The workflow is SHA-pinned; npm dependencies are locked. `ci/rules.test.mjs` reads the actual root `firestore.rules`, not a test copy. Assertions cover anonymous access, private student data, teacher approval, withdrawal, role spoofing, identity constraints, staff revocation and invalid values. These are regression checks, not a proof that every possible rule interaction is correct. Extend them alongside future shared-feature changes.

## One-time Google authorization

This cannot be bypassed by connecting GitHub: Google must explicitly trust the workflow before it can deploy anything. The ChatGPT Firebase plugin is not required.

1. Sign into [Google Cloud Shell](https://shell.cloud.google.com/?project=latinrw) with the account that owns `latinrw`.
2. Clone this repository and check out this PR branch, then inspect and run the setup script:

   ```bash
   git clone https://github.com/drpatricklake/romanway.git romanway-rules-setup
   cd romanway-rules-setup
   git switch automate-firestore-rules
   bash scripts/setup-rules-ci.sh
   ```

   If the repository is already cloned, use that clone and fetch the branch instead. The script requires IAM/service-enablement permissions (the project owner normally has them); school organization policies may require an administrator. It creates a dedicated service account, rules-admin and limited CLI metadata permissions, and a trust provider limited to the numeric repository/owner IDs, main branch, this exact workflow, and push/manual events. It creates **no permanent keys**, changes no student documents, and publishes no rules. The deployer can manage security rules, so protect the main branch and workflow.

3. After CI passes and Google setup succeeds, merge the reviewed PR. The main push runs tests and attempts the first rule deployment. Check **Actions → Firestore rules → Deploy production rules**. IAM propagation can take a few minutes; rerun on main if needed.

No GitHub secrets or repository variables are needed: provider and service-account names are public configuration already in the workflow. Do not paste private credentials into chat.

## Review and release notes

- The full Classroom Pilot Update app files have not been installed by this automation PR. Coordinate that release separately; Vercel's Git integration and this workflow are independent, not an atomic app/database rollout.
- The production rules cannot be read through the still-unconnected Firebase integration here. Before the first merge, compare any newer Console-only rules with this source to preserve changes. This file is from the previously delivered pilot package.
- Configure main branch protection to require **Test Firestore permissions** before merge and prevent direct pushes if every change should require review. The workflow itself retests main before deploying even without branch protection.
- Deploying via CLI replaces Console rules. From then on, make changes in `firestore.rules` through PRs rather than Console edits.
- Revert a bad rules commit with a new reviewed PR; the same workflow tests and redeploys the prior policy. Reverting does not undo document writes that occurred while a policy was active.
- No production deployment has been verified until the Google setup and first main run succeed. Local emulator success is not a production authorization test.

Sources: [Firebase CLI](https://firebase.google.com/docs/cli), [rule deployment](https://firebase.google.com/docs/rules/manage-deploy), [Google GitHub authentication](https://github.com/google-github-actions/auth), [Firebase Rules roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaserules).
