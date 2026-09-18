# Astra / Luna delegation workflow

This playbook is the execution checklist for repository changes. `AGENTS.md` remains the policy source. The project defaults in [`.codex/config.toml`](../.codex/config.toml) use GPT-6 Astra with low reasoning; changing that file does not switch an already-running session.

## Routing and checkpoints

Astra owns requirements, acceptance criteria, task decomposition, architecture, UX, SEO, data contracts, ambiguity, difficult debugging, security-sensitive or high-risk work, final review, and integration. Reassess delegation:

1. after the initial repository and requirements inspection;
2. after requirements or design decisions become a fixed implementation contract; and
3. before a separable implementation, documentation, test, or verification phase.

Delegate only a simple, clearly defined, bounded, largely independent, low-risk task with objective verification and a good chance of succeeding in one pass without architectural judgment. Luna is appropriate for mechanical edits, straightforward documentation, fixed-behavior wiring, focused tests, and routine verification. Keep work in Astra when it is tiny, coupled, ambiguous, high risk, or likely to require repeated correction. There is no delegation quota; do not create gratuitous agents.

## Luna handoff

Use a clean spawn with explicit settings:

```text
model = "gpt-5.6-luna"
reasoning_effort = "max"
fork_turns = "none"
```

Include the objective, exact file ownership, fixed decisions and required behavior, non-goals, acceptance criteria, verification command or deterministic evidence, and expected response. Keep concurrent edits on separate files when possible.

If a Luna task is slow, query its progress or blockers before interrupting it. Bring the work back to Astra when Luna misunderstands the contract, encounters ambiguity or increased risk, repeats failures or needs repeated correction, or stalls. Do not silently substitute another model or reasoning level.

## Astra review

Astra must inspect the actual diff and relevant evidence before accepting delegated work. Check scope, fixed decisions, repository invariants, and objective verification. Rerun checks when code or the environment changed, evidence is incomplete or suspicious, or an identified risk requires it; do not automatically repeat every successful check. Astra owns corrections and final integration.

Scale the review record to the task. For a simple task, a brief note covering delegated scope, evidence relied on, and corrections (if any) is sufficient. For a larger change, record the following:

```text
Checkpoint / date:
Trigger: [initial inspection | contract fixed | before separable phase]
Open or high-risk decisions:
Remaining candidates and routing decision:
Fixed decisions and required behavior:
Non-goals / file boundaries:
Acceptance criteria:
Verification command or deterministic evidence:

Astra review:
- Actual diff inspected: [yes/no]
- Delegated scope respected: [yes/no — notes]
- Fixed decisions and invariants preserved: [yes/no — notes]
- Verification run or relied-on evidence: <command + result>
- Defects found and corrections made: [none | details]
- Work returned to Astra: [no | yes — why]

Final model-scope report:
- Astra changed or owned: <scope>
- Luna changed or owned: <scope>
```
