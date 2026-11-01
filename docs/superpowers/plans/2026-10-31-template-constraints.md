# Template Constraints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce TASK-30 template constraints consistently and atomically across server-side frame writes.

**Architecture:** A parser-backed shared guard checks normalized candidate HTML against the current stored frame under trusted permission context. Actions own authorization before effects. Append streams become drafts with one final guarded commit; source-backed creation preserves legitimate copies.

**Tech Stack:** TypeScript, Bun, Express, Vitest, parse5 (production dependency), existing MCP and Resident harnesses.

**Spec:** `docs/superpowers/specs/2026-10-31-template-constraints-design.md`

## Global Constraints

- Stored current HTML is the trusted constraint baseline; trusted server permission context supplies `manageLocks`. Actor names and request-supplied role flags never grant authority.
- Invalid or duplicate template metadata returns 400 for everyone, preserving TASK-29 validation and German messages. Unauthorized modifications return 403.
- Do not introduce optional font/size locks. Safe typography changes in unlocked fields remain allowed.
- Buffer raw chunks for all roles until `done=true`; keep the committed frame, timestamps and history unchanged before commit. No partial HTML broadcasts.
- Work only in the isolated `task/30-template-constraints` branch. Keep TASK-30 In Progress until user acceptance; do not push, open a PR or merge without a separate request.
- TASK-31 UI, prompts, new roles, font/size lock attributes, safe zones and general HTML sanitization are excluded.
- All implementers and reviewers use `meta/muse-spark-1.3`; no subagent may spawn subagents.

## Review Focus

- Browser reserialization and namespace/template parsing must not lose locks or reject equivalent valid saves (Task 1).
- Editable nested formatting must not bypass ancestor length/color rules or alter locked descendants (Task 1).
- Chunk-boundary metadata, identity changes and concurrent saves must never persist unchecked stream data (Task 2).
- Protected clipboard/duplicate operations must preserve trusted provenance without granting arbitrary constraint creation (Tasks 2/3).
- Direct MCP and Resident calls must use real permission context and leave persisted state unchanged on rejection (Task 3).

---

### Task 1: Implement the parser-backed template guard

**Files:**

- Create: `server/prowin/templateGuard.ts`, `tests/templateGuard.test.ts`
- Modify: `server/prowin/templateMeta.ts`, `package.json`, `bun.lock`
- Reference: `shared/prowin/templateAttributes.ts`, `server/prowin/permissions.ts`, `shared/frameBrandHtml.ts`

**Interfaces:**

- Consumes: shared field validation and `canvasCapabilities(canvas).manageLocks`.
- Produces: `assertTemplateWrite(canvas: Canvas, prevHtml: string, nextHtml: string): void`, `hasTemplateFields(html: string): boolean`, and `assertTemplateDelete(canvas: Canvas, html: string): void` from `templateGuard.ts`. Preserve `assertCanChangeTemplateMeta` compatibility, delegating full writes to the new guard where appropriate without duplicating metadata logic.

- [ ] **Step 1: Write failing pure-guard tests.** Pin creator/member contexts through existing permission fixtures. Assertions: locked text/attributes/deletion/move and duplicate/changed IDs rejected; safe unlocked text and equivalent attribute order/lock-presence accepted; invalid metadata 400 for creator too. Test CSS/style/script/overlay changes outside a field, namespace and template-contained metadata, parent lock with nested editable field, and ordinary HTML with no metadata.
- [ ] **Step 2: Run RED.** `bun run test tests/templateGuard.test.ts`; capture the expected missing-guard failures in the report.
- [ ] **Step 3: Implement the exact spec guard with parse5.** Keep parse traversal/canonical comparison localized; reuse metadata validation. Add tests for codepoint boundary (`max=2`: `😀a` allowed, `😀ab` denied), decoded entities, preserved whitespace, unchanged legacy oversize text, inherited token constraints and `var(--prowin-ci-blau)` versus hex/fallback/custom-property redefinition. Test safe font-size changes on unlocked fields are allowed and style-based overlays are rejected. Do not turn the existing scanner into an HTML parser.
- [ ] **Step 4: Verify GREEN.** `bun run test tests/templateGuard.test.ts tests/templateAttributes.test.ts tests/templateMeta.test.ts` and `bun run typecheck`. Capture complete commands, counts and any warnings; resolve regressions from changed semantics rather than weakening guard tests.
- [ ] **Step 5: Self-review and commit.** Stage only task files. Commit subject: `feat: Enforce template write constraints`.

### Task 2: Guard actions and make append commits atomic

**Files:**

- Modify: `server/actions.ts`, `server/prowin/permissions.ts`, `server/index.ts`, `server/resident.ts`
- Create: `tests/templateWrites.test.ts`, `tests/templateStreams.test.ts`
- Modify as needed: `tests/templateMeta.test.ts`, `tests/frameVersionBursts.test.ts`, `tests/frameConcurrentSave.test.ts`, `tests/prowinBrandWrites.test.ts`, existing append tests

**Interfaces:**

- Consumes: Task 1 guard exports.
- Produces: guarded existing action APIs; `currentPermissionUserId(): string | undefined` in `permissions.ts`; optional `sourceFrameId?: string` on action/REST create input. Append signatures remain unchanged; their return value is the committed frame while buffering.

- [ ] **Step 1: Write failing action/HTTP tests.** For update, restore, create and delete assert invalid edits leave a full frame snapshot plus versions unchanged. Include 403 for protected resize/delete, 400 creator duplicate metadata, 403 unauthorized source, success for a member source-backed copy, and rejection of fresh template creation without a source. Confirm restored versions cannot remove present locks.
- [ ] **Step 2: Run RED.** `bun run test tests/templateWrites.test.ts tests/templateStreams.test.ts`; capture expected current bypasses.
- [ ] **Step 3: Integrate pre-effect guards.** Recheck after restore's await, normalize once, and validate before finishing streams/reveals, history or broadcasts. Add trusted identity accessor and source access validation using existing canvas access rules. Keep non-template creation and server-side page/canvas copies working. Remove Resident owner fallback only from write authorization, not billing.
- [ ] **Step 4: Replace per-chunk store writes with drafts.** Store raw accumulated HTML, escape mode, trusted owner and initial revision. Finalize via the shared guarded action only at `done`; reject foreign stream use and stale revisions (409). Timeout/restart discard drafts. Failed full saves cannot cancel another stream or change the committed frame. Preserve chunk splitting and escaping. Add success, rejected final, split tag, timeout, role revocation, same/different user, concurrent save, restart and no-`done` tests. Adapt existing stream tests to deliberate commit-only semantics, retaining meaningful history/brand assertions.
- [ ] **Step 5: Verify GREEN.** Run focused new tests, metadata, brand, history/concurrency and all existing append tests. Run `bun run typecheck`. Record test evidence and real permission setup, not actor-name substitutes.
- [ ] **Step 6: Self-review and commit.** Commit subject: `feat: Commit guarded frame writes atomically`.

### Task 3: Preserve copy callers and prove transport coverage

**Files:**

- Modify: `src/lib/api.ts`, `src/lib/frameClipboard.ts`, `src/components/FrameView.tsx` (locate actual path before editing), client request types/callers if required
- Modify: `server/mcp.ts`, `server/resident.ts` (pass `sourceFrameId` through the existing create tool schemas/arguments; no new tool)
- Create: `tests/templateTransports.test.ts` and focused clipboard/duplicate tests if existing suites lack coverage
- Modify: existing MCP/Resident/brand/copy tests and fixtures impacted by permission/stream semantics
- Modify: `docs/prowin/template-attribute.md`, `docs/prowin/doop-fork-umsetzung.md`, `.context/TECHSTACK.md` if its dependency list is affected

**Interfaces:**

- Consumes: `sourceFrameId?: string` create contract from Task 2.
- Produces: copy callers retaining source provenance and transport-level regression evidence for TASK-30 AC1–AC3.

- [ ] **Step 1: Write failing caller and transport tests.** Real MCP tools must return `isError` for non-Creator locked edits; Resident edit/set/rewrite commits must reject under member context. Check full snapshots/versions and persistence after denied writes. Clipboard and frame duplication carry source IDs and keep template metadata; metadata-free legacy clipboard remains accepted. Source deleted/permission revoked fails safely, never silently strips locks.
- [ ] **Step 2: Run RED.** Run the focused new tests and document the failures before changing callers/fixtures.
- [ ] **Step 3: Wire minimal request provenance.** Extend existing clipboard payloads with optional source ID; do not add UI or a new workflow. Preserve source IDs in direct frame duplicate calls and inspect history create/undo callers for contract compatibility. Add no privilege based on user JSON or name. Update affected MCP fixtures to trusted permission setup without concealing missing-context security tests.
- [ ] **Step 4: Document the implemented contract.** Explain actual parser, canonical comparison, Unicode length, style/typography scope, source-backed copies, atomic streams and unchanged lifecycle/non-goals. Remove obsolete TASK-30-open claims; keep TASK-31 and optional font/size locks open. Report lack of manual browser testing explicitly; include a happy-dom browser-style serialize/save regression.
- [ ] **Step 5: Verify GREEN and full suite.** Run focused transport/copy tests, `bun run test`, `bun run typecheck`, `bun run lint`, `bun run build`, and formatting checks on changed files. Fix task-caused regressions; report genuine baseline failures with evidence. Do not mark Backlog Done.
- [ ] **Step 6: Self-review and commit.** Commit subject: `test: Cover protected frame write transports`.
