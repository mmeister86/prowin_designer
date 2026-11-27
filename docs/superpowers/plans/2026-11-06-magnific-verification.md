# Magnific Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare truthful TASK-38 API evidence and a safe controlled-test tool without implementing TASK-39.

**Architecture:** One isolated TypeScript CLI, injectable fetch/time/sleep for offline tests, and an official-source evidence document. No runtime integration. Live is gated, not executed as part of implementation.

**Tech Stack:** Existing Node.js/tsx, TypeScript, Vitest, built-in fetch and timers; no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-06-magnific-verification-design.md`

## Global Constraints

- No runtime provider, env, registry, egress, UI or dependency changes.
- Separate official documentation, local mock tests, actual live observations and unresolved questions. Never call mock evidence a provider verification.
- Use `DESIGN-prowin.md` section 7 as the Brand-Kit fallback. Stock use remains a separate open decision.
- Probe defaults to no network and no key-file read. Live requires explicit flags and a nonempty key supplied through a file, not command-line secret values or ambient env.
- Live sends exactly one generation POST; never retries POST, follows redirects, downloads generated images, or sends arbitrary user/Canvas data.
- Maximum 30 GET polls, 5-second interval, 180-second overall deadline and at most 30 seconds per request including body consumption.
- No paid requests in this implementation phase. Never mark TASK-38 Done without user acceptance.

## Review Focus

- A failed/ambiguous POST must not create a second billable job: assert one POST on every failure path.
- Redirect, malicious task ID or result URL must not leak the key: fixed origin, UUID identity, redirect error, no image fetch.
- Upstream echoes key in error/body/ID/URL: emitted evidence must contain no echo or raw exception.
- Hung fetch or body, unknown status and endless IN_PROGRESS: timeout and poll caps stop locally.
- Dry CLI or half-specified live invocation must not read a key or send network traffic.

---

### Task 1: Add evidence and guarded probe

**Files:**

- Create: `docs/prowin/magnific-pruefung.md`
- Create: `scripts/magnific-probe.ts`
- Test: `tests/magnificProbe.test.ts`
- Modify: `docs/prowin/doop-fork-umsetzung.md` (section 11 and Q5 row only)
- Modify: `docs/prowin/bezugsdokumente-referenz.md` (R4.4/R4.6 evidence links only)

**Interfaces:**

- Consumes: official Magnific OpenAPI and `DESIGN-prowin.md` section 7, no server imports.
- Produces: `runProbe(options: ProbeOptions): Promise<ProbeEvidence>` and `main(args: string[]): Promise<number>`; CLI through `bunx tsx scripts/magnific-probe.ts`.
- `ProbeOptions`: `live?: boolean`, `ackCost?: boolean`, `key?: string`, injectable `fetchImpl?: typeof fetch`, `now?: () => number`, `sleep?: (ms: number) => Promise<void>`. Default dependencies are platform APIs. Minimal additional internal types permitted.
- CLI accepts only `--live --ack-cost --key-file <path>` for paid mode; no flags = dry-run. Reject unknown/partial flags before reading files. Whitelisted JSON evidence on stdout; nonzero exit on invalid flags/live failures. Safe generic errors only. Avoid extra feature flags.

- [ ] **Step 1: Read the spec and official sources.** Council used Context7 CLI (3 commands) and found contradictory summaries; do not repeat it. Verify against `https://docs.magnific.com/api-reference/text-to-image/magnific-one/generate`, `/task-by-id`, `https://docs.magnific.com/ratelimits`, `/pricing`, `/llms.txt` and linked official pricing/legal pages. Record fetch date and precise claim/evidence scope; failures to read legal/pricing data remain explicit gaps, not guesses. API expected from directly fetched OpenAPI: base `https://api.magnific.com`, header `x-magnific-api-key`, POST `/v1/ai/magnific-one`, GET `/v1/ai/magnific-one/{task-id}`, envelope `data.{task_id,status,generated}`, status `CREATED|IN_PROGRESS|COMPLETED|FAILED`. Verify before coding.
- [ ] **Step 2: Write failing offline tests.** Use synthetic UUID `046b6c7f-0b8a-43b9-b35d-6489e6daee91`. Assert dry-run/gates call fetch zero times; happy path sends one POST with fixed non-PII prompt and explicit `{mode:'quality',quality:'medium',resolution:'1k',aspect_ratio:'1:1'}`, `x-magnific-api-key`, `redirect:'error'`, then only matching GETs. Assert status transitions and completed HTTPS result count, FAILED, 400/401/403/429/500/503, JSON/schema errors, malformed/mismatched UUID, unknown status, completion without result, fetch errors/redirects, 30-poll cap, deadline including stalled body, and no raw key/body/URL output. Test real CLI dry-run and incomplete/unknown flags. Use injected dependencies/fake timers; no live calls.
- [ ] **Step 3: Add only minimal exported stubs and run `bun run test -- tests/magnificProbe.test.ts`.** Record a behavioral assertion failure (for example dry-run evidence is missing), not just a missing-import/setup error, before implementing behavior.
- [ ] **Step 4: Implement the smallest probe passing those tests.** Fixed synthetic neutral background prompt ends `no text, no letters, no logos, no watermarks`. For example: `Bright tidy kitchen, soft daylight, empty worktop and quiet left text area; no products; no text, no letters, no logos, no watermarks`. Read key only in validated live CLI; injectable key is for unit tests. Validate response at trust boundary; never surface raw exceptions. No generated-image download, no resume/retry feature, no auth-list endpoint inferred from recommendations.
- [ ] **Step 5: Write concise German evidence matrix/runbook.** Cover official limits versus unobserved limits; documented errors versus mock defenses; Brand-Kit fallback and no global absence claim; exact price if actually found otherwise blocked; commercial rights/attribution and API-specific applicability, AVV/subprocessors/regions/retention/training evidence or missing records. Do not treat company address as processing region. List live prerequisites, one-job/cap configuration, credit before/after evidence procedure, no load test, timeout != cancellation, image retrieval still unverified, and AC1/3 open until missing evidence. Link Q5 from existing docs, preserve planned runtime language.
- [ ] **Step 6: Verify.** Run focused tests, `bun run typecheck`, `bun run lint`, `bun run doc-lint`, targeted `bunx prettier --check` (format changed files as needed), `bunx tsx scripts/magnific-probe.ts`, and `bun run test` with logs outside the repo. No live invocation. Baseline: 239 files / 2162 tests passed, with existing localStorage/network teardown warnings.
- [ ] **Step 7: Commit only implementation files**, subject `feat: Add guarded Magnific API verification`. Write full report into the task-specific report path supplied in dispatch: source findings, RED/GREEN and command evidence, remaining live/legal blockers, no TASK-39 changes. Return only DONE/DONE_WITH_CONCERNS, commit SHA, test summary and concerns.
