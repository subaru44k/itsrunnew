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
- named operator with temporary `roles/datastore.viewer` only;
- short-lived Application Default Credentials acquired interactively;
- exact-pinned migration-only `firebase-admin@14.2.0` development dependency;
- no service-account JSON, copied access token, Firebase CI token, or secret in
  Git/chat/logs/artifacts;
- ADC and the temporary IAM binding revoked after verified export.

This workstation currently has no `gcloud` executable. Before implementation,
the user must choose either to install/authenticate the Google Cloud CLI as an
operator prerequisite or to approve a separately reviewed credential fallback.

## T14E1: local exporter hardening

After D018 approval, Luna may perform only local source/test/dependency work:

1. Add exact `firebase-admin@14.2.0` to root `devDependencies`; do not add it to
   public web, core, Lambda, or infra workspaces.
2. Refactor `export-firestore.mjs` into dependency-injected pure collection and
   serialization functions plus a thin operator CLI.
3. Use `applicationDefault()` and require exact project ID `itsrun-aaf42`.
   Reject service-account JSON environment variables, inline credentials,
   emulator hosts, alternate databases/projects, and output outside an ignored
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
- confirmation that `roles/datastore.viewer` is the only temporary project
  role used for this operation;
- installed Google Cloud CLI version and ADC account/project configuration;
- exact ignored run directory and free-space/permission checks;
- clean branch and accepted immutable exporter commit;
- proof no Firebase emulator variable or service-account key variable is set.

The user must explicitly authorize the temporary Google IAM binding if it does
not already exist, interactive ADC authentication, and two bounded Firestore
reads. Do not automate the IAM grant unless the exact administrator principal
and command have been separately reviewed.

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

Revoke ADC and remove the temporary Viewer binding through the operator
procedure. Verify the exporter can no longer authenticate. Record sanitized
revocation confirmation without token, email, credential path, or raw IAM
policy output. Keep `firebase-admin` only until T17 so the final pre-cutover
read can be repeated if explicitly authorized.

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
