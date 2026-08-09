# Phase 4 T14E protected Firestore export plan

Sol planning baseline: `04abe8d`

Plan date: 2026-08-09

## Current gate

T14A-T14D are accepted and entirely local. T14E is the first operation that
may authenticate to and read the legacy Firebase project. D018 is proposed,
not yet accepted. Nothing in this plan authorizes a Firebase read, Google Cloud
IAM change, credential creation, global tool installation, AWS call, or data
upload.

Preferred mechanism:

- project: `itsrun-aaf42` only;
- temporary service account
  `itsrun-fs-export-20260809@itsrun-aaf42.iam.gserviceaccount.com` with only
  `roles/datastore.viewer`;
- named operator receives `roles/iam.serviceAccountTokenCreator` on that exact
  service account only;
- short-lived impersonated Application Default Credentials acquired with
  `gcloud auth application-default login --impersonate-service-account`;
- exact-pinned migration-only `firebase-admin@14.2.0` development dependency;
- no service-account JSON, copied access token, Firebase CI token, or secret in
  Git/chat/logs/artifacts;
- ADC and the temporary IAM binding revoked after verified export.

This workstation currently has no `gcloud` executable. Before protected
execution, the user must approve installing the Google Cloud CLI, the exact
temporary Google IAM/service-account mutations above, interactive login,
impersonated ADC, two bounded reads, and subsequent revocation/deletion as one
bundle. Local T14E1 implementation can remain a separate non-authenticated
milestone.

## T14E1: local exporter hardening

After D018 approval, Luna may perform only local source/test/dependency work:

1. Add exact `firebase-admin@14.2.0` to root `devDependencies`; do not add it to
   public web, core, Lambda, or infra workspaces.
2. Refactor `export-firestore.mjs` into dependency-injected pure collection and
   serialization functions plus a thin operator CLI.
3. Use `applicationDefault()` and require exact project ID `itsrun-aaf42`.
   Accept only a dedicated CLI argument naming the exact ignored impersonated
   ADC created for D018. Validate its realpath, credential type, exact temporary
   service-account impersonation URL, and containment before SDK loading; set
   the standard credential environment only internally for the SDK lifecycle
   and restore it in `finally`. Reject caller-provided credential environment,
   service-account key/user/external-account JSON, inline credentials, emulator
   hosts, alternate databases/projects, and output outside an ignored
   `.artifacts/migration/<new-run>/` directory.
4. Permit reads only for `default/0`, `stadium_info`, and the four exact typed
   availability date collections. No collection-group query, listener,
   transaction, batch, Auth API, Storage API, create/update/delete, or generic
   user-supplied collection path.
5. Apply deterministic document-count and serialized-size bounds. Sanitize all
   errors and stdout; do not print document bodies, emails, tokens, credential
   paths, project metadata, or raw SDK errors.
6. Keep capture metadata separate from normalized-data bytes and hash.

AWS/Firebase-free tests inject a fake Firestore adapter and cover the complete
read allowlist, deterministic ordering, empty collections, unexpected paths,
count/size bounds, alternate project/database/emulator rejection, write-method
absence, sanitized failures, atomic new-run output, and no credential material.

Stop for Sol review after T14E1. Local implementation does not authorize an
interactive login or Firestore connection.

## T14E2: operator preflight

Before the first real read, record only non-secret evidence:

- named operator identity stored outside Git (do not place email in logs);
- exact temporary service account and confirmation that
  `roles/datastore.viewer` is its only project role;
- confirmation that the operator has Token Creator only on that exact service
  account for this operation;
- installed Google Cloud CLI version and ADC account/project configuration;
- exact ignored run directory and free-space/permission checks;
- clean branch and accepted immutable exporter commit;
- proof no Firebase emulator variable or service-account key variable is set.

The user must explicitly authorize creation/deletion of the exact temporary
service account, its Viewer binding, the exact operator's service-account-level
Token Creator binding, interactive ADC authentication, and two bounded
Firestore reads. Resolve the operator principal read-only after login without
writing it to repository logs; stop if the principal or project differs.

## T14E3: two read-only captures

Run the accepted exporter twice with a short documented interval. For each
capture:

1. verify exact project/database and allowlisted collection plan before SDK
   access;
2. write only into a distinct ignored new-run directory;
3. normalize with the accepted T14A parser;
4. compute the normalized-data SHA-256 without volatile capture metadata;
5. record only sanitized counts, date range, and hashes.

Require both normalized hashes and counts to match. Any concurrent source
change, malformed record, unexpected collection identity, permission error, or
limit breach stops the run. Do not coerce data or perform a third read without
new Sol review of the evidence.

## T14E4: local transform and comparison

Using the accepted T14B/T14C implementation:

- select one explicit UTC `updatedAt` for the migration run;
- transform the second identical normalized capture;
- validate every output and manifest hash;
- require a zero-difference comparison report;
- keep raw snapshots and schedule bodies ignored;
- commit only a separately reviewed sanitized manifest/report summary.

No AWS access occurs. Any mismatch stops before T14F.

## T14E5: credential retirement and handoff

Revoke ADC, remove the exact Token Creator and Viewer bindings, and delete the
temporary service account through the operator procedure. Verify the exporter
can no longer authenticate. Record sanitized revocation confirmation without
token, email, credential path, or raw IAM policy output. Keep `firebase-admin`
only until T17 so the final pre-cutover read can be repeated if explicitly
authorized with a newly reviewed short-lived identity.

Return to Sol with exact commits, dependency lock diff, tests, SDK read plan,
capture counts/hashes, zero-difference report hash, credential revocation
evidence, and clean worktree. Sol then prepares the exact T14F destination and
conditional upload authorization.

## Required checks

```bash
npm ci
npx vitest run scripts/migration/firestore-*.test.mjs
npm run test:unit --workspace @itsrun/core
npm run check
git diff --check
git status --short
```

## Stop conditions

Stop without guessing for an unapproved dependency/tool installation, Google
IAM mutation, credential or token handling outside the accepted operator flow,
alternate project/database, emulator, broader read, any Firebase write,
malformed or changing production data, raw artifact entering Git, AWS access,
upload, overwrite/delete/dual-write, production DNS, or Firebase state change.
