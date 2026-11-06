# TASK-38: Magnific API verification

## Result

Prepared official-source evidence, a guarded standalone probe and 38 offline tests. No runtime integration, paid provider request, key access, push or PR. TASK-37 remains unaccepted and unchanged.

- Evidence and live prerequisites: [Magnific verification](../../prowin/magnific-pruefung.md).
- Design: [verification-only scope](../specs/2026-11-06-magnific-verification-design.md).
- Plan: [implementation and checks](../plans/2026-11-06-magnific-verification.md).
- AC2 is verified through the explicitly documented brand-language prompt fallback. AC1 and AC3 remain open. Backlog stays `In Progress` because the configured statuses do not include `Blocked`; blockers are recorded in task notes.

## Council consultation

One completed consultation round; these scores describe approach readiness, not code quality. All delegates advised documentation plus an isolated probe, no TASK-39 adapter yet, no paid test before price/key/authorization.

| Delegate              | Round 1 |
| --------------------- | ------- |
| Claude Opus 5.5       | 7/10    |
| GPT-6.1 Sol Ultrafast | 8/10    |
| Muse Wonder 1.0       | 8/10    |

Opus became reachable after the user reconnected Claude. Interrupted initial Sol/Wonder attempts were cancelled and repeated, not counted as completed rounds.

## Implementation and review

- DeepSeek V4.1 Flash 1017 implemented `3d8f703`.
- GPT-6.1 Terra task review: 7/10, requested fixes for poll-wait deadline and mock/live classification; also noted response-buffer size.
- Small controller fixes in `fc04cf7`: monotonic clock, bounded/stall-safe pause, mock evidence label, 64 KiB response stream cap. Regression tests were observed failing before each fix and passing afterward.
- GPT-6.1 Terra scoped re-review: Approved, 9/10; all three findings addressed, no new breakage.

## Verification

| Check                       | Result                                                  |
| --------------------------- | ------------------------------------------------------- |
| Baseline full suite         | 239 files / 2162 tests passed                           |
| Final full suite            | 240 files / 2200 tests passed                           |
| Focused probe suite         | 38 tests passed                                         |
| Typecheck                   | passed                                                  |
| Lint                        | passed                                                  |
| Doc lint                    | passed with one freshness warning for the new test file |
| Changed-file Prettier check | passed                                                  |
| Probe CLI without flags     | dry-run JSON, no network or key                         |

Existing suite noise includes localStorage warnings and localhost connection/teardown errors; both baseline and final commands exited zero. No browser or build check: this change only adds a CLI, offline tests and documentation.

## Remaining blockers

- A real provider test needs explicit one-generation cost authorization, a securely supplied key and confirmed account price/cap.
- The website price table and API enum differ; `medium` / `1k` has no verified price. Do not infer one or equate API credits with website credits.
- Confirm API-specific usage rights/attribution and obtain DPA, subprocessor, processing-region and retention evidence.
- Output-image download/opening is not implemented or verified by this probe. A timeout does not cancel or refund the provider job.
- Stock-photo usage remains a separate open decision.

## Decisions under delegated authority

1. Execute the Council's verification-only recommendation without a clarification round. If the desired scope was already TASK-39 integration, that requires a separate follow-up implementation.
2. Keep live generation unexecuted until explicit price/key/cost prerequisites exist. This leaves a later evidence step and AC1/3 unresolved rather than incurring speculative charges.
