# Agent workflow

## AWS migration work

- Keep the primary agent responsible for planning, architecture decisions, IAM review, deployment authorization, and final review.
- Delegate implementation of an approved plan under `docs/aws-migration/` to the `luna-worker` custom agent when the user requests implementation or asks the primary agent to continue the staged Sol/Luna workflow.
- Use only one write-capable subagent at a time. Do not delegate overlapping file edits in parallel.
- Before delegation, require a committed plan, an explicit branch and start commit, a clean worktree, and clearly stated stop conditions.
- Instruct `luna-worker` to read the applicable migration documents, execute milestones in dependency order, run each required test, update `implementation-log.md`, and commit coherent changes without squashing history.
- Wait for `luna-worker` to finish. Then independently inspect its diff, commits, test results, security boundaries, synthesized infrastructure, and worktree state in the primary thread.
- Return focused corrections to the same worker when possible. Do not advance phases until the primary review accepts the current phase.
- AWS writes, IAM changes, deployment, invalidation, Cognito administration, production changes, DNS changes, and Firebase changes require explicit authorization in the current task. Parent and worker must obey all migration stop conditions.

