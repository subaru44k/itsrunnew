# Sol / Luna delegation workflow

This playbook makes model routing repeatable for repository changes. `AGENTS.md` remains the policy source; this document provides the execution checklist.

## 1. Route in phases

Treat delegation as a decision that can change as the task becomes clearer.

1. **Inspect:** Sol reads the required repository documentation and identifies the risky decisions. Luna may perform a narrow, read-only inventory in parallel.
2. **Decide:** Sol resolves architecture, UX, SEO, security, data contracts, and acceptance criteria.
3. **Reassess:** Once those decisions are fixed, Sol lists the remaining implementation, tests, documentation, and verification work and applies the Luna criteria to each item independently.
4. **Delegate:** Give Luna at least one substantive bounded change when a suitable item exists. An earlier reconnaissance task does not remove this requirement.
5. **Integrate:** Sol reviews the actual diff, checks it against the fixed decisions, runs objective verification, and owns the final integration and deployment decision.

The riskiest part of a feature determines what Sol must retain, not what Sol must implement personally. For example, Sol can define a ranking formula and SEO boundary while Luna implements the pure ranking helper and its unit tests.

## 2. Required reassessment questions

At every checkpoint in `AGENTS.md`, answer:

- Which decisions are still ambiguous or high risk?
- Which decisions are now fixed enough to turn into an exact contract?
- Can any remaining file set be owned independently without concurrent edit conflicts?
- Is there a deterministic verification command or output comparison?
- Would Luna likely complete it in one pass without architectural judgment?

If the last three answers are yes for any substantive implementation, test, or documentation item, delegate one or more of those items. Do not skip delegation merely because Sol can finish the work quickly.

## 3. Handoff contract

Use a clean context and include all of the following:

```text
Objective:
Exact files or responsibility:
Fixed decisions and required behavior:
Non-goals / files not to change:
Acceptance criteria:
Verification command or deterministic evidence:
Expected response: changed files, diff summary, verification results, and uncertainties
```

Keep Sol and Luna on non-overlapping files when possible. If both must touch one file, sequence the work instead of editing it concurrently.

## 4. Appropriate implementation examples

After Sol has fixed the behavior, Luna Max is a good fit for:

- a pure model/helper plus focused unit tests;
- straightforward component wiring with exact copy and state rules;
- smoke or regression tests for an already implemented behavior;
- mechanical metadata or mapping changes;
- documentation synchronized to an accepted implementation; and
- a bounded refactor with an objective before/after comparison.

Keep the following in Sol:

- choosing the behavior or public contract;
- deciding ranking weights, data semantics, SEO boundaries, or security posture;
- resolving unclear or conflicting requirements;
- final cross-cutting review and integration;
- production deployment authorization and outcome assessment.

## 5. Sol review record

Never accept the subagent summary as the review. Sol must inspect the diff and record:

- whether the delegated scope was respected;
- whether fixed decisions and invariants were preserved;
- which verification Sol reran;
- any defects Sol found and how they were corrected; and
- whether the task proved more complex than the original Luna routing assumed.

The final report for a change task should identify the Sol and Luna scopes and state whether Sol found any deficiencies. This makes it possible to evaluate the routing strategy rather than only the feature result.

## 6. Reusable decision and review record

Copy this record for each required checkpoint, then complete the review and final scope sections after implementation. If no delegation is made, give a concrete reason for each suitable-looking candidate.

```text
Checkpoint / date:
Trigger: [initial inspection | design/contract fixed | before separable phase | newly narrow task]
Open or high-risk decisions:
Remaining candidates:
- <item / files> — <why it is or is not a substantive, independent candidate>

Decision:
- Delegate to Luna Max: <exact files or responsibility>; or
- Keep in Sol: <concrete reason for each candidate not delegated>

Fixed decisions and required behavior:
Non-goals / file boundaries:
Acceptance criteria:
Verification command or deterministic evidence:

Sol review after the work:
- Actual diff inspected: [yes/no]
- Delegated scope respected: [yes/no — notes]
- Fixed decisions and invariants preserved: [yes/no — notes]
- Verification rerun and result: <command + result>
- Defects found and corrections made: [none | details]
- Routing complexity changed: [no | yes — why work returned to Sol]

Final model-scope report:
- Sol changed or owned: <scope>
- Luna changed or owned: <scope>
- Sol review findings/corrections to delegated work: <none or details>
```
