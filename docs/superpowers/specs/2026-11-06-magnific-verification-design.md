# Verify Magnific API and Q5

## Intent and scope

TASK-38 provides evidence for TASK-39, not an image-provider integration. TASK-37 remains unaccepted. The user authorized following recommendations without clarification rounds; the following are controller recommendations, not independently approved details.

## Approaches

1. Documentation only: cheapest, but cannot satisfy the controlled live-test requirement.
2. **Selected: official-source evidence plus an isolated, opt-in probe with offline tests.** Leaves live and legal gaps visible until prerequisites exist.
3. Build the runtime adapter now: rejected, because it crosses into TASK-39 before verification.

## Requirements

- No runtime provider, env, registry, egress, UI or dependency changes.
- Separate official documentation, local mock tests, actual live observations and unresolved questions. Never call mock evidence a provider verification.
- Record dated official sources for auth, endpoints, request/response fields, status, limits/errors, costs, rights and processing regions. Missing evidence stays open.
- Use `DESIGN-prowin.md` section 7 as the Brand-Kit fallback. Absence of a kit field in one schema does not prove all Magnific interfaces lack Brand Kits. Stock use remains a separate open decision.
- Probe defaults to no network and no key-file read. Live requires explicit flags and a nonempty key supplied through a file, not command-line secret values or ambient env.
- Live sends exactly one generation POST; never retries POST, follows redirects, downloads generated images, or sends arbitrary user/Canvas data. Fixed synthetic prompt, explicit `quality` mode / `medium` quality / `1k` / `1:1`; no reference images or webhook.
- Fixed origin `https://api.magnific.com`, documented paths only. UUID task IDs validated before constructing polling URL; poll only the created task.
- Maximum 30 GET polls, 5-second interval, 180-second overall deadline and at most 30 seconds per request including body consumption. Timeout cannot cancel or refund an upstream job.
- Output only whitelisted evidence: timestamp, mode/evidence classification, request configuration, HTTP status codes, known task statuses, generated count, fixed error codes and optionally validated task ID. No API key, raw response/error body, result URLs or untrusted messages in any output.
- Unknown status, mismatched/invalid task ID, malformed JSON, missing fields, terminal failure and completion without a valid HTTPS result URL fail safely. Do not fetch result URLs.
- Before live generation, require explicit cost authorization, provider key and verified price/account cap. No paid requests in this implementation phase.
- Never mark TASK-38 Done without user acceptance. AC1 remains open without the live proof; incomplete cost/legal/region evidence keeps AC3 open.

## Deliverables and verification

`docs/prowin/magnific-pruefung.md`, `scripts/magnific-probe.ts`, `tests/magnificProbe.test.ts`, minimal Q5 links/wording in the two source documents. One cohesive implementation unit: its evidence contract and executable probe must agree.

Test network/key gates, exact documented request, state transitions, terminal failure, HTTP errors, malformed schema, task identity, secret-safe failures, redirects, poll/time bounds and CLI invocation. Run focused tests, typecheck, lint, doc-lint, formatting, dry-run and full suite. Controlled live run remains a separately authorized step.
