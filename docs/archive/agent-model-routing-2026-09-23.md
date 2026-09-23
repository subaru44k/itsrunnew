# 旧モデル運用方針（2026-09-23 退避）

以下は退避前の記載です。現在のエージェントへの指示やモデル設定としては使用しません。

## AGENTS.md — Model routing and delegation

## Model routing and delegation

Use **GPT-6 Astra with low reasoning** (`gpt-6-astra`, `low`) as the primary/orchestrator. Delegate simple, clearly defined work to **GPT-5.6 Luna with max reasoning** (`gpt-5.6-luna`, `max`). The project defaults are in [`.codex/config.toml`](.codex/config.toml). Changing these files does not switch an already-running session; do not claim a model/effort is active unless the session settings confirm it. Do not silently substitute another model or reasoning level.

Astra owns requirements, acceptance criteria, task decomposition, architectural decisions, ambiguous or difficult debugging, security-sensitive or high-risk changes, final review, and integration. Once these decisions make a remaining task simple and bounded, consider handing it to Luna.

Delegate to Luna only when the work is narrow, largely independent, low risk, straightforward to verify, and likely to succeed without repeated correction. Examples include mechanical edits, straightforward documentation, small implementations with fixed behavior, focused tests, and routine verification. Do not force delegation for tiny tasks or create unnecessary parallel agents; optimize for correctness and total effort rather than a delegation quota.

Reassess delegation after initial inspection, after requirements or design decisions are fixed, and before a separable implementation, documentation, or test phase. For a Luna handoff, explicitly set `model = "gpt-5.6-luna"`, `reasoning_effort = "max"`, and `fork_turns = "none"`. Supply the objective, exact file ownership, fixed decisions, non-goals, acceptance criteria, and verification commands. Keep concurrent edits in separate files.

Review the actual diff and relevant verification evidence before accepting delegated work. Rerun checks when code/environment changed, evidence is incomplete or suspicious, or an identified risk requires it; do not automatically repeat every successful check. Ask for progress or blockers before interrupting a slow but progressing agent. Bring work back to Astra if it becomes ambiguous, stalls, is misunderstood, or requires repeated corrections. Report unavailable model/tool settings honestly rather than claiming delegation occurred.

Follow [`docs/DELEGATION_WORKFLOW.md`](docs/DELEGATION_WORKFLOW.md) for the handoff and review procedure. Final change reports should briefly state the delegated scope, the primary review/verification, and any corrections.

## docs/SITE_STRUCTURE.md — エージェントのモデル方針

## エージェントのモデル方針

主要モデルはGPT-6 Astra（`gpt-6-astra`、low）です。プロジェクト既定値は [`.codex/config.toml`](../.codex/config.toml) にあります。

```toml
model = "gpt-6-astra"
model_reasoning_effort = "low"
```

Astraは要件、設計、曖昧さ、セキュリティや高リスクの判断、最終レビューと統合を担当します。Lunaへは、単純で明確な限定的・独立した低リスクの作業だけを、`gpt-5.6-luna`・`max`・`fork_turns = "none"` のclean spawnで委譲します。既定値ファイルを変更しても実行中のセッションは切り替わらず、委譲のノルマや不要なagentは設けません。手順は [`DELEGATION_WORKFLOW.md`](DELEGATION_WORKFLOW.md) を参照してください。

## itsrunnew/README.md — エージェントのモデル方針

## エージェントのモデル方針

主要モデルはGPT-6 Astra（`gpt-6-astra`、low）です。既定値は [`.codex/config.toml`](../.codex/config.toml) にあります。

```toml
model = "gpt-6-astra"
model_reasoning_effort = "low"
```

Astraは要件・設計・曖昧さ・高リスク判断・最終レビューと統合を担当します。Lunaへは、単純で明確な限定的・独立した低リスクで検証可能な作業だけを、`gpt-5.6-luna`・`max`・`fork_turns = "none"` のclean spawnで委譲します。既定値ファイルを変更しても実行中のセッションは切り替わらず、委譲のノルマや不要なagentは設けません。詳細は [`../docs/DELEGATION_WORKFLOW.md`](../docs/DELEGATION_WORKFLOW.md) を参照してください。

## .codex/config.toml

```toml
# Project defaults; simple delegated tasks explicitly use Luna with max reasoning.
model = "gpt-6-astra"
model_reasoning_effort = "low"
```

## docs/DELEGATION_WORKFLOW.md

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
