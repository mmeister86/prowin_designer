# Safe Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Implement TASK-33 advisory safe zones across editor, storage and agent context.

**Architecture:** Store optional insets on Frame and resolve against presets once. Request semantic geometry from the sandbox and draw only in parent React DOM. Reuse existing permissions, persistence, copy/history and guide surfaces.

**Tech Stack:** Existing TypeScript, React 18, Zustand, Drizzle/PGlite, Vitest and Puppeteer; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-safe-zones-design.md`

## Global Constraints

- Defaults: IG/FB post 50 px on every side; IG story top 200/bottom 250; WA status top 150/bottom 200; story/status left/right 0; A4 11 CSS px on every side.
- `Frame.safeZoneOverride?: Insets` fully replaces preset insets; omitted inherits, PATCH null resets, four zeroes remove margins. Overrides require a preset. Changing/removing a preset clears the override unless a replacement is supplied. Saving the same preset preserves it.
- Reuse `canvasCapabilities(...).manageLocks` to author/change/reset overrides. Non-Creator source copies inherit stored source metadata; attempts to differ are denied before side effects. Generic metadata is never accepted through frame drag relays.
- Draw only in the parent DOM with pointer-events none; never mutate iframe DOM for warnings. Preserve sandbox isolation.
- No new dependencies, per-element exclusions, layout engine, export-size changes (TASK-34), placement fixes (TASK-80), new roles, or HTML safe-zone attributes.
- All implementation code uses Muse Spark 1.3; all code reviews use GPT-6.1 Terra. No worker subagents. Only work in the TASK-33 worktree; never push/merge or close the Backlog task.

## Review Focus

- Null reset and value comparisons survive undo/redo, copy, reload and capability revocation (Task 1).
- Resize/version restore cannot leave explicit override invalid; rejected writes have no side effects (Task 1).
- Script-spoofed/stale/truncated measurement cannot crash or falsely claim no warnings (Task 2).
- Late fonts/images, display:contents and live edits invalidate measurements without loops (Task 2).
- Agent context uses effective overrides even when overlay hidden; exported/stored HTML unchanged (Task 3).

### Task 1: Persist safe-zone policy and lifecycle

**Files:** Create `shared/prowin/safeZones.ts`, migration after 0041; modify `shared/types.ts`, `server/db/{schema,persist}.ts`, `server/{actions,store,index}.ts`, `src/lib/{api,history,frameClipboard}.ts`, `src/components/FrameView.tsx` duplication path. Tests: `tests/safeZones.test.ts`, `tests/safeZonePolicy.test.ts`, `tests/safeZonePersistence.test.ts`, extend existing copy/history tests where necessary.

**Interfaces:** Produce `effectiveSafeZone(frame: Pick<Frame, 'preset' | 'safeZoneOverride'>): Insets | null`; `isSafeZoneOverride(value: unknown): value is Insets` (exact keys, finite integers >=0); `safeZoneFits(insets: Insets, width: number, height: number): boolean`; `safeZoneIntrudes(rect: {x:number;y:number;width:number;height:number}, insets: Insets, width:number, height:number): boolean`. Insets reused from formats.ts. `Frame.safeZoneOverride?: Insets`; client update/reset type permits null.

- [ ] Write failing tests: defaults exact; invalid/partial/extra/NaN/negative/fraction input rejected; inner-boundary contact allowed, crossing and outside count. Creator set/reset succeeds; member differing values/reset denied without mutation/broadcast/history; source copy inherits including zeroes; no preset rejects; preset switch clears, same preset retains; resize/restore invalid override rejected.
- [ ] Run focused tests and record expected RED evidence.
- [ ] Implement helper/types/migration/persistence and central action authorization/validation; REST create+PATCH field plumbing. Agents do not gain override-write parameters. Load rejects corrupt stored overrides gracefully. Mirror all explicit preset persistence mappings. Preserve clones on page/canvas copy. Use sourceFrameId stored metadata for member copies. Preserve metadata across version restores and validate resulting size.
- [ ] Implement clipboard/Alt-drag/history metadata transport; structural comparisons and explicit null reset. Ensure rejected updates do not poison undo stack. Test create/delete recreation, reset undo/redo, and clipboard round trip. Preserve version-history semantics (content only).
- [ ] Run focused tests plus relevant preset/permissions/copy/history regressions, typecheck and changed-file lint/format; report commands/results. Before committing run full suite once with `--maxWorkers=2`, unless controller has already documented baseline failures; in that case run focused integration coverage and report the limitation.
- [ ] Commit only Task 1 changes with imperative subject under 50 characters; report evidence and concerns to supplied report path.

### Task 2: Render advisory overlay and Creator controls

**Files:** Create `src/prowin/SafeZoneOverlay.tsx`, `src/prowin/SafeZoneSection.tsx` (and small task-specific helper only if needed); modify `src/components/{FrameView,Inspector}.tsx`, `src/lib/{frameBridge,frameRuntime,store}.ts`. Tests: `tests/safeZoneOverlay.test.tsx`, `tests/safeZoneRuntime.test.ts`, `tests/safeZoneBrowser.test.ts` and focused controls/history integration tests.

**Interfaces:** Consume Task 1 helpers and Frame field. Produce `SafeZoneOverlay` mounted in FrameView's design-coordinate frame box, `SafeZoneSection` in Inspector Layout, one local `showSafeZones` store preference under `doop:safe-zones`. New bridge request `doop:safe-zones` / `doop:safe-zones-result` follows existing reqId source checks; typed measurement API in frameBridge.

- [ ] Write failing tests for all semantic roles, exact bands, boundary detection, no preset, zeros, toggle persistence, read-only member controls, Creator save/reset and denied-save recovery (no optimistic policy/history).
- [ ] Add runtime/bridge tests for numeric validation, source/reqId checks, stale render replies, bounded 200-box payload, unavailable/incomplete status, hidden measurement suspension, display:contents descendants and latest request wins.
- [ ] Run focused tests to capture RED, implement the minimal bridge/runtime audit and React overlay. Four nonoverlapping red ~10% bands and orange outlines; pointer-events none and zoom-correct coordinate handling. Never add warning DOM/classes/styles to the iframe. Refresh after render/live changes/resize/font/image and relevant DOM mutations; coalesce and avoid feedback loops/polling. Invalid replies never produce trusted success.
- [ ] Implement accessible local toggle and textual warning status, effective margin display plus Creator-only four-input save and reset. Use existing house inputs/buttons and API; record history after success only and show German failure feedback. Four zeroes remove margins. No per-role exemptions.
- [ ] Run real Chromium regression covering toggle, orange warning movement after text/resource/layout changes, override/reset and unchanged stored HTML. Follow existing browser-test harness; no user-facing preview tools. Run focused suites, typecheck and changed-file lint/format; record results.
- [ ] Commit only Task 2 files and report with RED/GREEN evidence.

### Task 3: Supply agent guidance and verify acceptance

**Files:** Modify `server/{guide,mcp,resident}.ts`, `docs/prowin/{bezugsdokumente-referenz,doop-fork-umsetzung}.md`; tests `tests/safeZoneContext.test.ts`, extend `tests/safeZoneBrowser.test.ts` or add focused export isolation test.

**Interfaces:** Consume `effectiveSafeZone`. Produce shared `SAFE_ZONE_GUIDE` included in MCP guide and Resident system prompt, and effective CSS-px values/source in existing frame summaries and Resident frame list/create/inspect/read context. No new override-authoring tools.

- [ ] Write failing tests: inherited/overridden/reset/zero/no-preset context; guide has five default formats and advisory inner-rectangle text/CTA instructions; Resident and MCP both use effective values regardless of UI visibility.
- [ ] Run RED; implement shared guidance and context fields using one resolver. Trace all frame inspection/read and create summaries and include effective values where format is described. Retain existing redaction/privacy behavior.
- [ ] Correct R2.2 and implementation guidance: 3mm at96dpi =11.34 CSS px rounded11; at300dpi =35.43px not85; rounded11 at3.125 scale =34.375px. Clarify inner safety margin versus bleed, no print-ready claim. Add calculation assertions.
- [ ] Add regression verifying stored/downloaded frame HTML and server-rendered PNG/JPG contain no overlay. Use existing screenshot path unchanged; do not fix export sizes. Verify Creator metadata edits leave HTML byte-identical.
- [ ] Run focused context/export tests, full suite with `--maxWorkers=2`, typecheck, lint, build and changed-file format check. Attribute pre-existing failures explicitly, do not claim unrun checks. Report exact counts and limitations.
- [ ] Commit Task 3; leave Backlog status In Progress for user acceptance. Report evidence and any remaining risk.
