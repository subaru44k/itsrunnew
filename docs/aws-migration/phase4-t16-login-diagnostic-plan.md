# Phase 4 T16 Hosted UI credential diagnostic

Sol plan date: 2026-08-10

Start from the committed Sol handoff, clean, Node 24. Read D031, D028-D030, the
two prior auth stop records, security, and the auth/rollback plan.

## LD01: AWS-free diagnostic contract

Extend the existing T16 auth harness only as needed to normalize Hosted UI
outcomes into an allowlist such as `callback`, `incorrect-credentials`,
`user-not-found`, `password-reset-required`, `oauth-error`, or `unknown-login`.
Inputs may include DOM text internally but returned/logged evidence must contain
only the category, host/path sequence, statuses, role, and duration. Add tests
proving raw text, username, password, cookies, hidden form values, URLs with
queries, codes, and tokens cannot escape. No dependency or runtime change.

Run focused tests, root check, and `git diff --check`; log and commit.

## LD02: one-user live diagnostic and cleanup

Read-only preflight: exact account/region, policy v7, healthy stack/alarm/CSP,
pool/group zero, client code/PKCE/local-only, and no data drift. After STS,
perform only the D031 user create, permanent-password set, and AdminGetUser
checks. Do not add a group.

Run the alias attempt and, only if it does not reach callback, the internal
Username attempt in fresh contexts. On callback success, stop before any API
request and clear transaction/user state. Delete the user, prove pool/group
zero, remove temporary credentials/scripts, update the log, commit, and return
to Sol with only sanitized categories.

No IAM/policy/deploy/CloudFormation/invalidation/upload/API/schedule/data,
other user, production/DNS/Firebase, or T17 operation. Any inability to delete
the user is cleanup priority. Do not retry either identifier.
