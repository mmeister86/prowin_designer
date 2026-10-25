# Selective upstream adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the fork at 2272d9d and adopt the 17 reviewed upstream web/server commits through aa04e95 individually, preserving proWIN behavior.

**Architecture:** Work only on `integrate/upstream-2026-10-25` in the isolated OpenCode worktree. Cherry-pick each original commit with `-x`, test each before taking the next, adapt only fork incompatibilities. Related design/resize commits share task-level review gates but never a squashed commit.

**Tech Stack:** Existing Bun, TypeScript, React, Vitest, Chromium, PGlite. No dependency or schema changes are needed.

**Spec:** The user's approved review and explicit request in this thread: secure the existing project, then individually adopt and test useful upstream commits using SDD. This document records that scope; no separate product design is introduced.

## Global Constraints

- Preserve Requesty EU routing, PII redaction, forbidden-provider boot guard, Creator/workspace permissions, disabled optional features, and removed Microsoft/SSO/PostHog/GitHub/live-sync functionality.
- Do not modify existing user work, main, origin/main, ignored .env files, or live databases. No push, PR, merge to main, deployment, or migration execution outside isolated test databases.
- Baseline is `2272d9d3056588c92af5c1a28974bdb04d90fe5c`; upstream is pinned at `aa04e959bb9dfef75e0abfb6145bb491f817807a`. Exclude iOS-only `bf3ebac` until a real iOS build can be performed.
- Every upstream commit stays separate, retains its original message and `(cherry picked from commit ...)` trailer. Fork corrections may be included when resolving its cherry-pick, or follow immediately as clearly named fixes; never rewrite somebody else's commits.
- Before applying production changes, extract/import that commit's regression tests first, run a focused RED check, then apply production changes and verify GREEN. Use existing upstream assertions; adapt setup to fork permissions without weakening assertions. For a CSS-only change without an upstream test, add one small behavior check if needed.
- For each commit run the named focused tests and `bun run typecheck`; record exact commands, exit codes, counts, and upstream/local SHA mapping. Run the entire `bun run test --maxWorkers=4` suite at baseline and final, and full task verification before reporting a task complete. Preserve and report existing warnings/failures, never silently skip tests.
- Test databases are disposable PGlite instances. Set `TMPDIR=/tmp/opencode`; Chromium is available at `/usr/bin/chromium`. Reuse installed dependencies; do not introduce dependencies.
- Use only Backlog CLI to change tasks. TASK-67 and subtasks stay In Progress until user confirmation, even after verification. Controller owns backlog/ledger; implementers do not mark tasks Done.
- Implementer reports contain one section per original commit with RED/GREEN evidence, local SHA, adaptation rationale, changed files, and any concerns. Reviewers are read-only, do not repeat already evidenced test runs, and return BOTH spec and quality verdicts.
- No child agent may dispatch other agents. No unrelated refactoring or fixes. The controller dispatches one implementer at a time and owns review/fix loops.

## Review Focus

- Locked-page copies must preserve flags across database reopen, while ordinary advisors still cannot create/change locks: Task 1 pages test plus final prowinCapabilities test.
- Visibility updates during text editing must survive serialization without restoring removed replay/analytics modules: Task 2 browser test uses existing frameRuntime fixture.
- Concurrent drawing moves must keep remote edits, including rollback and late conflict responses: Task 6 transfer and conditional-save tests.
- Drag gestures must finish correctly on fast pointerup/cancel, support flex Fill, and suppress handles for unsupported transforms: Task 8 browser regressions.
- Zoom label portals must not resurrect deleted integrations or break locked-frame affordances: Task 10 browser tests, typecheck/build, and final protected-module comparison.

## Verification protocol

For each source SHA, inspect `git show --stat SHA` and the relevant pre-change code. Import only its test/fixture changes first using a temporary patch or explicit file extraction, adapt fixture setup if specified, and run the named test to capture expected RED. Then bring in the source patch and commit with the upstream message, author, and `-x` provenance (a regular `cherry-pick -x` after preserving the test-first changes is acceptable). Do not discard test edits; preserve their fork adaptations. Retain every intermediate upstream commit and run tests before proceeding to the next. If the test-first cherry-pick mechanics require clearing the index, preserve known task edits explicitly; never use destructive reset/checkout/clean commands. Tests introduced by a later dependent commit need not be invented early. Use `git diff --check` before committing. If no genuine RED assertion is available, state the limitation and provide the smallest meaningful behavior regression rather than claiming a compile/import error is behavioral RED.

Run focused tests during iterations and the full suite once at the task gate; do not run the full suite after every keystroke. Document any baseline failures by exact name. Controller will adjudicate baseline-only failures; do not expand scope to fix them.

### Task 1: Preserve hidden and locked frames in page copies

**Source:** `7f509bd`.
**Files:** `server/db/persist.ts`, `tests/pages.test.ts`.
**Interfaces:** Consumes existing `savePageCopy`; produces persisted hidden/locked flags, no API change.

- [x] Import upstream test changes first. Register the pages owner with `POST /api/prowin/creator` and assert status 200; retain all lock/visibility and database-reopen assertions.
- [x] Run `TMPDIR=/tmp/opencode bun run test tests/pages.test.ts --maxWorkers=1` and capture the missing-persisted-flags RED assertion.
- [x] Adopt `7f509bd` with provenance; only the Creator fixture setup differs from upstream.
- [x] Run the pages test, typecheck, full task suite, self-review and report; commit source adoption separately.

### Task 2: Keep visibility changes during inline text edits

**Source:** `1df6c0b`.
**Files:** `src/lib/frameRuntime.ts`, `src/lib/layerEdits.ts`, `tests/frameVisibilityBrowser.test.ts`, `tests/layersEye.test.tsx`.
**Interfaces:** Adds `doop:visibility` runtime handling through existing `requestFrame`.

- [x] Import regression tests; use `tests/fixtures/frameRuntime.html` instead of the removed `frameReplay.html`, remove PostHog optimizeDeps and retain removal of PostHog mocks.
- [x] Run browser/layers tests for RED before production patch; test absence of a visibility response may timeout, record this distinction honestly.
- [x] Adopt `1df6c0b`, resolve the test mock conflict keeping the frameBridge mock and no analytics.
- [x] Run `TMPDIR=/tmp/opencode bun run test tests/frameVisibilityBrowser.test.ts tests/layersEye.test.tsx --maxWorkers=2`, typecheck, full task suite; commit and report.

### Task 3: Make resolved comment replies readable

**Source:** `d1f9752`.
**Files:** `src/components/CommentsPanel.tsx`, `tests/commentsPanel.test.tsx`.
**Interfaces:** Uses existing Disclosure, preserves existing permission/agent behavior.

- [x] Import upstream resolved-thread regression tests, run `TMPDIR=/tmp/opencode bun run test tests/commentsPanel.test.tsx --maxWorkers=1` for RED.
- [x] Adopt `d1f9752` without restoring PostHog imports.
- [x] Run focused tests, typecheck, full task suite; commit and report.

### Task 4: Adopt the complete design-panel foundation

**Sources in exact order:** `4e3e8b6`, `1a3373f`, `8ef7396`, `d98df37`.
**Files:** Paths returned by `git show --name-only` for these sources, chiefly ElementPanel, property-field, icons, frameBridge, frameRuntime, history, cssValues, new use-value-scrub/FlexLayoutControls/flexLayout, tests and fixtures.
**Interfaces:** Produces `onFrameChange`, frame-updated notifications, `styleGesture`, aspectRatio helpers, geometry/layout metadata consumed by Task 8.

- [x] For EACH source separately import its tests first, capture focused RED, adopt it with provenance, then run focused GREEN and typecheck before moving on.
- [x] Focused command: `TMPDIR=/tmp/opencode bun run test tests/elementPanelBrowser.test.ts tests/cssValues.test.ts tests/frameLocalEdits.test.ts tests/pageControlsBrowser.test.ts --maxWorkers=2`; only name test files that exist at the current source step.
- [x] Preserve removed replay runtime and analytics code; retain localHtml/remote-edit protection and history gesture grouping.
- [x] After all four individually tested commits run the full task suite, self-review and report one per-commit evidence section.

### Task 5: Copy links to specific elements

**Source:** `81fb23a`.
**Files:** ElementLink, FrameView, LayersPanel, Stage, server/mcp, README/TECHSTACK and upstream test/fixture paths.
**Interfaces:** Adds element-link parsing/copy and focus; builds on existing frame selectors, no permission change.

- [x] Import upstream test changes; run `TMPDIR=/tmp/opencode bun run test tests/elementLink.test.tsx tests/pageCanvasBrowser.test.ts --maxWorkers=2` for RED.
- [x] Adopt `81fb23a` with provenance, retaining fork documentation and removed integration code.
- [x] Run focused GREEN, typecheck, full task suite; commit and report.

### Task 6: Protect drawing transfers against concurrent writes

**Source:** `2caad52`.
**Files:** `server/index.ts`, `src/lib/api.ts`, `src/lib/drawingMove.ts`, `tests/drawingMove.test.ts`, `tests/frameConcurrentSave.test.ts`.
**Interfaces:** `requireFrame(..., expectedUpdatedAt?)`, optional deleteFrame expected version, conflict-safe transfer/rollback.

- [x] Import regression tests first; resolve drawingMove mock with importOriginal/ApiError but no PostHog. Capture meaningful conflict/delete RED.
- [x] Adopt `2caad52` while preserving Creator identity/permission middleware and backwards-compatible DELETE without version.
- [x] Run `TMPDIR=/tmp/opencode bun run test tests/drawingMove.test.ts tests/frameConcurrentSave.test.ts tests/prowinCapabilities.test.ts --maxWorkers=2`, typecheck, full task suite; commit and report.

### Task 7: Restore the selected-frame destination picker

**Source:** `3edf6e8`.
**Files:** `src/components/PagesPanel.tsx`, `tests/pageControlsBrowser.test.ts`.
**Interfaces:** Reuses `moveFramesToPage`, excludes locked frames, picker key events must not reach canvas shortcuts.

- [x] Import regression tests and capture missing-picker RED. Task 4 supplies the prerequisite shortcut helper.
- [x] Adopt `3edf6e8` with provenance.
- [x] Run `TMPDIR=/tmp/opencode bun run test tests/pageControlsBrowser.test.ts tests/pageEdits.test.ts --maxWorkers=2`, typecheck, full task suite; commit and report.

### Task 8: Adopt resize handles with all reviewed correctness fixes

**Sources in exact order:** `f897395`, `cb176aa`, `91e8bad`, `0ab9cf0`, `0531b70`.
**Files:** Source commit paths, chiefly ElementResizeHandles, elementResize, FrameView, ElementPanel, frameBridge/frameRuntime, flexLayout, TECHSTACK, tests and fixtures.
**Interfaces:** Consumes Task 4 styleGesture/geometry; produces selection resize UI respecting locked frames/elements and unsupported transforms.

- [x] For EACH source separately import tests first, capture RED, adopt with provenance, run focused GREEN and typecheck, and retain its own commit.
- [x] Focused command: `TMPDIR=/tmp/opencode bun run test tests/elementResize.test.ts tests/elementResizeBrowser.test.ts tests/elementPanelBrowser.test.ts --maxWorkers=2`.
- [x] For CSS-only `0531b70`, verify the hover overlay sits above selection outline; add a small behavioral regression to the browser suite if no existing assertion proves it, then run it RED/GREEN.
- [x] Keep removed sync/GitHub/analytics imports absent. Run full task suite after all five, self-review and report per source.

### Task 9: Copy rendered frames as PNG

**Source:** `06169b4`.
**Files:** `src/components/FrameContextMenu.tsx`, `src/components/Inspector.tsx`, `src/lib/frameExport.ts`, `tests/frameExport.test.ts`.
**Interfaces:** Adds `copyFramePng(frame): Promise<void>` reusing export URL/reporting; read-only action, no extra permission gate.

- [x] Import upstream tests first and capture RED. Keep missing/refusing clipboard and render-failure coverage.
- [x] Adopt `06169b4`, preserving fork manageLocks gating elsewhere in the components.
- [x] Run `TMPDIR=/tmp/opencode bun run test tests/frameExport.test.ts tests/frameExportModal.test.tsx --maxWorkers=2`, typecheck, full task suite; commit and report.

### Task 10: Adopt sharp zoom and stable peer cursors without removed integrations

**Source:** `aa04e95`.
**Files:** Source commit paths, chiefly FrameView, Stage, DrawingMove, FrameLabelLayer, GhostFrames, follow/frameRuntime, new layoutZoom, TECHSTACK and drawing/frameRasterZoom/follow tests and fixtures.
**Interfaces:** Replaces raster prop with layoutZoom consistently; screen-space frame label portal and peer cursor/viewport scaling.

- [x] Import upstream tests first, capture zoom/cursor RED and preserve any existing locked-frame assertions.
- [x] Adopt `aa04e95` as a complete commit, manually resolve FrameView label portal while excluding Sync/GitHub tooltip blocks and deleted module imports; never restore FlowOverlay to Stage.
- [x] Run `TMPDIR=/tmp/opencode bun run test tests/drawingBrowser.test.ts tests/frameRasterZoom.test.ts tests/follow.test.ts tests/elementResizeBrowser.test.ts tests/pageCanvasBrowser.test.ts --maxWorkers=2`, typecheck, full task suite; commit and report.
- [x] Controller runs final full suite, lint, build, doc-lint and protected-module/deleted-module comparisons, then dispatches an independent whole-branch review. No merge/push or task closure without the user.

### Task 11: Normalize optional flags in transfer history (explicit follow-up approval)

**Source finding:** `final-fix-review.md` I4, explicitly approved by the user after the final-review cap.
**Files:** `src/lib/history.ts`, `tests/drawingMove.test.ts`; controller owns Backlog and handoff documentation.
**Interfaces:** Preserve `sameTransferState(a: Frame, b: Frame)` and all three callers. Only `hidden` and `locked` compare by their existing Boolean semantics; all other snapshot fields and expected-version checks stay strict.

- [x] Add a parameterized regression for each of `hidden` and `locked`: transfer into a frame whose optional false flag is omitted, apply/record an own false-to-true toggle, Undo the toggle, Undo the transfer, then Redo. Assert no false conflict, no unwanted duplicate drawing, correct HTML/source survival, and ordinary redo behavior. Reuse the real history/drawing test harness.
- [x] Run `TMPDIR=/tmp/opencode bun run test tests/drawingMove.test.ts --maxWorkers=1` and capture the false-conflict RED before production changes.
- [x] In the existing snapshot-key comparison use `!!a[key] === !!b[key]` only for `hidden`/`locked`; retain strict equality otherwise. No permission/history redesign and no unrelated Minor fixes.
- [x] Run the focused file, typecheck, full lint, build, doc-lint, formatting for changed files, and one full four-worker suite. Archive explicit exit codes. Commit the narrow fix separately, preserving all source adoption commits.
- [x] One fresh scoped review verifies I4, preserved version/other-field guards, and tests. Controller verifies logs/provenance/protected paths, updates handoff/Backlog, and leaves all task statuses In Progress until manual user acceptance. No additional broad review round, push or merge.
