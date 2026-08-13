# Phase 4 T16 Hosted UI form recovery

Sol plan date: 2026-08-10

Start clean from this committed Sol handoff with Node 24. Read all migration
documents, especially D038, D037-D028, the preceding T16 plans and evidence,
security, test plan, and runbook. Use the existing preview account, region,
pool, app client, CloudFront host, admins group, and reserved Oda object only.

## HF01: deterministic form driver and AWS-free proof

Extend `scripts/migration/t16-auth-harness.mjs` with a dependency-free browser
form boundary. It accepts an injected Playwright-like page/locator surface,
selects exactly one visible `form[name="cognitoSignInForm"]`, and scopes the
username, password, and sign-in submit controls to that form. Require each
control to be unique, visible, and enabled. Fill credentials without returning,
logging, serializing, or embedding them in errors. Click the real submit
control and require one observed submit/navigation signal within a bounded
deadline. Return only an allowlisted checkpoint such as `form-ready`,
`form-submitted`, `form-ambiguous`, `control-missing`, `control-disabled`,
`fill-failed`, or `submit-not-observed`.

Add focused AWS-free tests. A local HTML/Playwright fixture must contain the two
responsive Cognito form copies and prove, at desktop and mobile viewports, that
only the visible form is filled and its submit event fires exactly once. Cover
no/ambiguous visible form, missing/disabled controls, rejected fill/click,
bounded no-submit, timer cleanup, and canary non-exposure. Do not weaken the
existing recorder or protected-input tests. Run the focused harness tests and
root `npm run check`; update the implementation log and commit coherently.

## HF02: read-only live selector gate

With no Cognito users or credentials, open the real Hosted UI authorize/login
page at desktop and mobile viewports. Do not fill or submit. Record only counts
and booleans proving there is one visible named form and one visible/enabled
username, password, and submit control scoped beneath it. Do not record DOM,
screenshots, console, network bodies, query strings, or page text. Independently
verify with `AWS_PROFILE=codex-prod` that account `470447451992`, region
`ap-northeast-1`, pool users=0, admins membership=0, and the reserved object is
still the exact protected baseline. Record sanitized results, commit, and stop
if any gate differs.

## HF03: one protected bounded rehearsal

Recreate the temporary mode-0700 runner outside Git using the committed D038
driver, D037 mode-0600 CLI JSON boundary, internal Cognito Username for admin
operations, void/JSON typing, the pre-login recorder, signed-in sentinels, and
restoration-first `finally`. Review it locally and run fake adapter paths before
the real operation. The runner must emit only typed checkpoint/result fields.

Execute it exactly once. Do not inspect its command line, environment, files,
DOM, screenshot, raw error, or raw CloudTrail event. Run the admin/non-admin
authorization matrix, then the one D029 conditional UI update, stale-ETag
conflict proof, public observation, exact conditional byte restoration, and
identity cleanup. After any data write, restoration is the sole priority.
Read back empty users/group and the original object bytes/hash/metadata at the
end. Remove the temporary runner and files. Update the implementation log and
commit truthful sanitized evidence.

Stop on any mismatch, pre-data failure, cleanup failure, or restore failure.
Do not retry. No IAM/policy/deploy/invalidation/other object/production/DNS/
Firebase/T17 operation is permitted by this plan. Stop for Sol review before
T16E.
