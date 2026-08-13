# AWS migration plan

Status: Phase 5 S04 complete; final Sol acceptance pending upstream CDK finding review

Planning baseline: `d6de55e` on `master`

Working branch: `migration/aws-s3-cloudfront`

## Goal

Replace the Vue 2 and Firebase application with a maintainable Nuxt 4
application hosted by CloudFront and private S3 buckets. Replace Firestore with
versioned JSON objects in S3, and replace Firebase Authentication with Cognito
User Pool local users for the administrator workflow.

The public application must not import an AWS SDK. It reads versioned HTTP/JSON
contracts so that the storage and identity providers remain replaceable.

## Non-goals

- Do not redesign the product or add stadiums during the migration.
- Do not change the meaning of schedule status values.
- Do not change production DNS before the final Sol review.
- Do not delete the Firebase project until the rollback window has elapsed.
- Do not introduce DynamoDB, Amplify, a UI framework, a CSS framework, Pinia,
  a date library, or a PWA unless a documented blocker proves one is required.
- Do not copy the current lint debt or generated table markup into the new app.

## Five-phase model workflow

| Phase | Model | Scope | Required output |
| --- | --- | --- | --- |
| 1 | Sol | Plan and create the handoff artifacts | This directory and a planning commit |
| 2 | Luna | Build the vertical slice through read-only S3 data | Tasks T00-T09 and an implementation log |
| 3 | Sol | Review architecture, IAM, caching, data contract and drift | One consolidated review; no broad implementation |
| 4 | Luna | Apply review fixes and complete auth, admin, migration and CI | Tasks T10-T17 with all automated checks green |
| 5 | Sol | Final security, behavior and cutover review | Go/no-go result and finalized runbook |

Do not switch models for ordinary compilation failures, component work, test
maintenance, naming decisions, or refactoring within the documented
architecture. Pause for Sol only when an item in
[implementation-tasks.md](./implementation-tasks.md#stop-conditions) applies.

## Branch and commit strategy

Luna continues on `migration/aws-s3-cloudfront`; it must not implement on
`master`. Commit by task or coherent milestone, using the task ID in the
message:

```text
T02 scaffold Nuxt application
T07 add read-only schedule vertical slice
T12 implement authenticated schedule updates
```

Do not squash during implementation. The Phase 3 Sol review records the exact
reviewed commit in [implementation-log.md](./implementation-log.md). After the
Phase 5 review, merge through a pull request; do not push directly to
`master`.

## Source of truth

When documents disagree, use this precedence:

1. [decisions.md](./decisions.md)
2. [security.md](./security.md)
3. [api-spec.md](./api-spec.md) and [data-schema.md](./data-schema.md)
4. [architecture.md](./architecture.md)
5. [implementation-tasks.md](./implementation-tasks.md)
6. Existing Vue 2 behavior

Record any approved change in `decisions.md` before implementing it.

The maintained application is the Nuxt workspace under `web/`. The former
Vue 2/Firebase tree and migration-only Firestore tooling were removed in T17;
the exact recoverable legacy source remains at local annotated tag
`legacy-firebase-vue-final-20260813`, peeling to
`5dab6ddea06fb858c642738f6b029e3d5d09365d`. The tag is not a deployment
artifact and is not pushed by migration implementation.

## Definition of done

- All current public routes either render equivalent content or have an
  explicit redirect.
- Japanese remains unprefixed and English remains under `/en`.
- Schedule dates use the Japan calendar day regardless of viewer time zone.
- Public schedule reads work without credentials.
- Only members of the Cognito `admins` group can update schedules.
- Concurrent admin edits cannot silently overwrite one another.
- S3 website and data buckets are private and accessible publicly only through
  CloudFront.
- Schedule JSON is versioned and has a tested rollback procedure.
- The legacy Firebase application remains available for rollback during the
  agreed observation window.
- Type checking, unit tests, infrastructure tests, browser tests, and
  production builds pass in GitHub Actions.
- No dependencies listed in the removal section of
  [architecture.md](./architecture.md) remain in the final application.

## Luna start checklist

Before implementation:

1. Read every file in this directory.
2. Confirm the current branch is `migration/aws-s3-cloudfront`.
3. Confirm the worktree contains only the Phase 1 planning commit.
4. Add the current commit and tool versions to `implementation-log.md`.
5. Execute tasks in dependency order.
6. Stop after T09 and hand the branch back to Sol for Phase 3.

When resuming the currently blocked T09 work, Luna must also read and execute
[t09-unblock-plan.md](./t09-unblock-plan.md) in order.

After T09, the authoritative Phase 3 findings and Luna correction order are in
[phase3-review.md](./phase3-review.md).
