# Phase 4 T16A dependency recovery

Sol plan date: 2026-08-10

Start from commit `3985c91` on `migration/aws-s3-cloudfront`, with a clean
worktree and Node `v24.18.1`. Read D027, the T16 execution plan, and the T16A
stop evidence before editing.

## DR01: exact development peer

Use npm under Node 24 to add exact root `devDependency` `commander@15.0.0` and
regenerate the root lockfile. Do not add an override, production dependency,
runtime import, postinstall, or another package. Verify the integrity and
engine in the generated lockfile match the registry-resolved package.

Commit only `package.json`, `package-lock.json`, and the chronological
implementation-log entry after these focused checks pass:

```text
npm ci
npm ls --all
npm ls @bomb.sh/tab commander --all
```

The resolved tree must contain root Commander 15 for Tab, nested Commander 11
for SVGO, and nested Commander 2 for Terser with no invalid/extraneous package.
Search source and generated dependency metadata to prove no application or
Lambda source imports Commander.

## DR02: repeat immutable T16A

At the DR01 commit, repeat every T16A command and focused check from
`phase4-t16-execution-plan.md`; prior success at `d47d131` does not substitute
for testing the new lockfile. Record exact counts, dependency tree, audit
summary, comparison/inventory hashes, and preview result. Commit the truthful
evidence and mark T16A complete only if all checks pass.

## DR03: resume T16B

If DR01 and DR02 succeed, resume T16B01 through T16B05 exactly as already
authorized by D026 and `phase4-t16-execution-plan.md`. No extra Sol handoff is
required. The AWS-write gate remains closed until T16B01 and T16B02 also pass.

Stop without AWS writes for any dependency outside D027, lockfile change beyond
the deterministic npm result, invalid/extraneous tree, runtime import/bundle,
new test failure, audit condition requiring a package upgrade, or any original
T16/D026 stop condition.
