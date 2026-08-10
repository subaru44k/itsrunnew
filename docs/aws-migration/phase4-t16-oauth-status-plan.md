# Phase 4 T16 OAuth status diagnosis

Sol plan date: 2026-08-11

## OS01: local sanitized OAuth status classification

Starting from the clean Sol handoff, read D048, security, the auth executable,
harness, tests, and CO03 evidence. Extend the existing sanitized browser
recorder/classifier so a missing signed-in sentinel is categorized from only an
allowlisted host, pathname, HTTP method where available, and status code.

Allow only the exact preview CloudFront host, exact Cognito Hosted UI host, and
the exact regional Cognito issuer host. Never retain query, fragment, request or
response headers/body, form content, credentials, tokens, claims, raw error, or
console text. Distinguish at least discovery missing/rejected, token endpoint
missing/rejected, token success followed by missing session, and the existing
API response states. Do not expose the event trail in final output; return one
typed category and viewport. Add canary tests proving sensitive URL material is
discarded and all classifications are deterministic. Run focused tests, root
check, diff check; log and commit. No AWS/live auth.

## OS02: one diagnostic auth-only execution

After Sol source acceptance, run the same auth-only executable once with the
existing exact gates. The only added result is the typed OAuth status category.
Always clean both temporary users/group membership and require protected data
and invalidation inventories unchanged. Stop without retry or source fix.
No API/S3/Firestore write, deploy, IAM, CloudFormation, production, or T17.
