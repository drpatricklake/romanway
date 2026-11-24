# Remaining expanded-pilot acceptance

Status: personal-device sign-in, enrollment approval, saved work, password reset, Atrium replies/thanks and Safari transport recovery have been reported working. School-managed device/network acceptance and strict Atrium transition remain pending. This document does not open registration or change any production switch.

## New help-request reward

The asker earns 5 Cōnstantia per lesson, once in that class. Both “what you tried” and “what you don't understand” must contain text; their trimmed text plus a separating space must total at least 50 characters. This is a length/structure check, not an AI judgment of quality. Questions below the threshold remain allowed. The separate follow-up reward is still 10 Cōnstantia. Teacher accounts do not earn awards. Existing qualifying questions since `rewardsFrom` can receive the new award; reviewed baseline entries are not modified.

After merge/deployment, post a new qualifying request as Student A. Verify +5 Cōnstantia. Refresh and submit another request for that lesson: no additional asking XP. A qualifying request for another lesson can earn another 5. A reply/thanks test must still award the helper under the existing daily limits. Closing the question must preserve prior awards.

## School-managed device and network (requires a person at school)

Use consenting adult test accounts with invented coursework. Record device/browser and whether the school network or cellular network was used; do not share passwords or tokens.

| Check | Expected result |
|---|---|
| Open the production site on a managed school device/network | App and artwork load; no blocked Firebase/Google resources |
| Google sign-in (permit popup if the school allows it) | Account connects without a disappearing or blocked sign-in loop |
| Approved student completes an exercise, signs out and back in | Work resumes with the same score and progress |
| Open Atrium, post a qualifying request, reply from the other account, mark helpful | Fast discussion load, saved messages, correct once-only XP |
| Complete a Circus round; refresh | Result and earned rewards persist |
| If any step fails, repeat on cellular/personal device | Record which environment fails; share the app error/Loading diagnostics, not credentials |

## Launch gates after acceptance

1. Verify the question reward in production after deployment and keep a screenshot/export of ledger totals.
2. Reload active pilot tabs and enable strict Atrium enforcement for the intended class only. Confirm a current page still saves and an old-format XP write is rejected. Do not rerun the baseline migration.
3. Confirm the expanded 13+ pilot's teacher allowlist, class creation, approval flow, and preview/production registration configuration before opening signup. Review pending registration PRs against current main; a passed preview is not approval to open production registration.
4. Invite a colleague only after the school test and intended registration gates pass. No global registration, payment links, or institutional rollout is enabled by this reward update.
