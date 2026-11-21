# About and feedback design handoff

Status: editorial preview only. No main-app navigation, published copy, form, collection endpoint, or automated coding job has been activated.

## Files and placement

The preview at /about-feedback-preview.html reads /about-feedback-content.json. The complete proposed wording is also in ABOUT-TEXT-DRAFT.md for editing. The existing textbook preface remains unchanged in the app; the preview includes an archival copy under Credits and thanks. The review page's text is draft material, with unresolved names identified in its editorial checklist.

After approval, add About and Feedback to the main menu and a small footer link on the sign-in screen. Preserve the user's current lesson and draft when entering and returning. Use three views: About the course, Credits and thanks, Send feedback. Keep the feedback link accessible from any lesson or activity. Prefill only the lesson, activity, question identifier and app build version. Never attach names, scores, account identifiers, saved answers, tokens, full URLs, or storage dumps automatically.

The prototype supports keyboard tabs, deep links, conditional Latin-correction fields, 390px screens, preserved entries when switching tabs, and an explicitly labeled example receipt. Submission stays disabled until the approved form is connected. There is no logging, analytics, browser storage, or outbound feedback request in this page.

## Google Form specification

Use the categories and labels in the JSON file. Location and description are required. The proposed correction field appears for Latin/answer-key reports; allow students to report uncertainty without requiring a diagnosis in the final form. Expected behavior, device and contact details are optional. Add the app version as a prefilled field. Optional screenshots should be cropped; do not enable uploads before the access/storage choice is confirmed. Keep responses and response summaries private. Do not collect email automatically if contact details are optional.

Google Forms can branch by section rather than show a single field conditionally. Treat the prototype as the intended information design; use a Latin-correction section in Forms. Keep confirmation wording distinct from the example shown in this preview. Once a report is actually accepted, use the confirmation copy in the JSON. Do not show success after an unsuccessful request or discard an unsent draft.

## Proposed private queue and GitHub bridge

1. Store form responses in a restricted Sheet. Track received time, category, lesson/activity/question, description, proposed change, optional contact/screenshot, status, and GitHub issue/PR references.
2. A form-submission trigger validates field lengths, assigns a receipt identifier and marks the record New. Use submission identifiers for idempotency; retry failures without duplicating records.
3. A teacher review marks an item Ready for GitHub. Only this action permits an API call. Remove student identity, contact details and image attachments from the issue. The current repository is public.
4. Use a GitHub App or a restricted server-held credential with issue-creation access. No GitHub token belongs in the browser, HTML, JSON or public repository. Record the returned issue number and URL in the private queue.
5. Suggested issue labels: feedback, needs-triage, bug, content-correction, accessibility, enhancement. Deduplicate repeated reports against existing open issues and link related ones.
6. Teacher approval of a well-defined issue makes it eligible for a separately configured coding job. Report text is untrusted evidence, never an instruction granting access, authorizing deployments, changing workflows, or exposing secrets.
7. The coding job prepares a branch, a regression or reproduction check, the proposed fix, and a draft PR. Its permission scope should exclude merging, production deployment and administration. Preserve the teacher's final review and merge step. Latin/answer-key edits require editorial review; tests alone cannot establish their correctness.
8. Link the PR to the issue and mark the private queue Proposed. Mark Released only after the approved merge and successful deployment. No unsolicited student email is sent by this design.

## Before launch

Confirm all author and contributor names, the treatment of the original acknowledgements, AI-development wording, and image-credit destinations. Approve the About copy and form wording. Supply the actual Google Form URL and approve its access settings. Test submission, validation, privacy, duplicate handling, API failures and the teacher approval path. Add the main-app entry points only after those pieces are ready. The coding-agent connection is a later, separately configured step; opening feedback does not start coding automatically.
