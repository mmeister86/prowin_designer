# File Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement TASK-35 exported PNG/JPG file sharing with reliable download fallback and native iOS attachments.

**Architecture:** Prepare the existing server export once, then share on an explicit second click to preserve browser activation. Keep new web logic under src/prowin and extend the native SwiftUI export surface using the current URLSession and file-directory boundaries.

**Tech Stack:** Existing React/TypeScript/Vitest and SwiftUI/CoreTransferable; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-04-file-sharing-design.md`

## Global Constraints

- No dependencies, server rendering/auth/cache policy changes, new formats, PDF, telemetry, broad export framework, or unrelated cleanup.
- Code implementation exclusively Muse Spark 1.3; independent task/final code review GPT-6.1 Terra. No pushes or merges; TASK-35 stays In Progress pending user manual acceptance. Unrelated original working-tree edits remain untouched.
- Keep existing PNG/JPG download buttons and Inspector/clipboard behavior, including 120-second render boundary, server filenames/errors, desktop save-panel behavior and ten-minute blob URL lifetime.
- Explicit second share click calls `navigator.share({files:[file]})` before any asynchronous work. Never auto-download on cancellation or error; never claim delivery on resolve.
- Native iOS uses existing cookie session/same-server response validation, 120-second export request timeout, expected image MIME validation and actual local file representation. Do not change the public-by-unguessable-ID export endpoint policy.
- Native/manual acceptance remains open without real execution evidence. No success metrics/toast on either platform.
- Keep files alive while the system may read them. Use existing UUID temp isolation and platform temporary-directory lifetime rather than immediate deletion that races share consumers; document this bounded-by-OS cleanup limit.

## Review Focus

- Slow export loses browser activation: Task 1 tests verify sharing is not called during preparation and occurs directly in a later click.
- Share cancelled/unsupported/throws: Task 1 verifies no automatic download or delivery claim; exact prepared bytes remain downloadable without refetch.
- Selection/version/format changes while pending: Task 1 rejects obsolete prepared state; Task 2 ties image sheet to captured frame and cancellation.
- Native HTML/JSON response or excessive filename: Task 2 core checks reject wrong MIME/status and preserve .png/.jpg after sanitization/truncation.
- Native file consumer reads lazily: Task 2 explicit FileRepresentation and documented temp lifetime; real Share Sheet/manual evidence never replaced by source assertions.

---

### Task 1: Add two-step web file sharing

**Files:**

- Modify `src/lib/frameExport.ts` with narrow reusable preparation/save interfaces.
- Create `src/prowin/frameShare.ts` and `src/prowin/FrameShareActions.tsx` for browser capability, share outcome and focused UI state.
- Modify `src/components/FrameExportModal.tsx` only for share component integration/copy.
- Test `tests/frameShare.test.ts`, `tests/frameShareActions.test.tsx`; extend `tests/frameExport.test.ts` / `tests/frameExportModal.test.tsx` only as needed.

**Interfaces:**

- Consume existing `Frame`, `FrameExportFormat`, `frameExportUrl`, `fileNameOf`, `failureOf`, `saveBlob` and existing Modal/Button patterns.
- Produce `prepareFrameExport(frame: Frame, format: FrameExportFormat, signal?: AbortSignal): Promise<File>` in frameExport.ts, throwing controlled Error messages (caller abort remains distinguishable). Explicit MIME image/png or image/jpeg; basename sanitation, correct extension; existing `downloadFrameExport` calls same helper preserving notices. Export `saveBlob(blob: Blob, fileName: string): void` for prepared download, preserving URL lifetime.
- Produce `canShareFrameFile(file: File): boolean` and `shareFrameFile(file: File): Promise<string | null>` in frameShare.ts. Guard missing/throwing APIs. Return null for neutral resolved/AbortError, safe German text for unsupported/other failure. `navigator.share` is invoked synchronously before first await.
- `FrameShareActions({frame}: {frame: Frame})`: a small capability-gated PNG/JPG prepare control, busy text, prepared filename, explicit Share and prepared Download actions and inline German status. Keep existing modal download controls usable as fallback; new prepared Download always reuses its File. Use frame id/updatedAt/HTML/name/dimensions identity or equivalent key to prevent sharing an obsolete artifact; generation/cancellation guards and clear timers/listeners. No dependency or separate global store.

- [ ] **Step 1: Write focused failing tests.** Prepare PNG/JPG with exact URL `/i/export-frame.png?download` / `.jpg?download`, File MIME `image/png` / `image/jpeg`, server/fallback filename and byte identity, no save click. Show server font/429 errors, timeout, and caller cancellation distinctly. Sharing tests for missing/throwing canShare, real-file false, resolve, AbortError, NotAllowedError, generic error and retry; no delivery text or automatic download. UI verifies explicit later click, one fetch for prepared share+download, duplicate-call protection, close/selection/version/format stale results, existing dialog focus/Escape behavior. Long/path-like names preserve correct extension.
- [ ] **Step 2: Verify RED.** Run `bun run test tests/frameShare.test.ts tests/frameShareActions.test.tsx` and record failing expectations before writing product code.
- [ ] **Step 3: Implement minimal shared preparation and isolated share UI.** Reuse existing error/read/download logic; no change to clipboard behavior unless needed to reuse existing helper without duplicating fetch logic. Probe both formats with tiny Files before offering share preparation, then real-file check and click-time check. Disabled share while pending. Caller abort supported without assuming AbortSignal.any; existing timeout semantics preserved. Keep download behavior exact for desktop.
- [ ] **Step 4: Verify GREEN.** Run focused new tests plus `tests/frameExport.test.ts tests/frameExportModal.test.tsx`, `bun run typecheck` and lint changed TS/TSX files. Existing tests must pass. Format only owned files. Record actual commands and any deviations.
- [ ] **Step 5: Self-review and commit.** Commit only task-owned code/tests, subject `feat: Add web image file sharing`. Write detailed report (RED/GREEN, commands/results, files, concerns) to supplied task report path; return only status, commits, short test summary and report path. Do not push, merge, close Backlog, or start subagents.

### Task 2: Add native iOS image sharing and docs

**Files:**

- Create `ios/Doop/Core/FrameImageExport.swift` for format/path/filename/response/error contract; `ios/Tests/FrameImageExportTests.swift` and register checks in `ios/Tests/ServerAddressTests.swift`.
- Modify `ios/Doop/DoopClient.swift` with dedicated image request using existing session and same-server boundary.
- Create `ios/Doop/FrameImageExportView.swift` for native preparation state and file Transferable; thin integration in `ios/Doop/NativeCanvasView.swift`. Modify Xcode project source references/build phases if needed (inspect existing project pattern).
- Modify `ios/Doop.xcodeproj/project.pbxproj` / `ios/Doop/Info.plist` as required for Debug/Release `NSPhotoLibraryAddUsageDescription` German text; avoid unrelated settings.
- Update `docs/prowin/doop-fork-umsetzung.md` section 10.4 and `ios/README.md` with truthful implemented flow and pending manual checklist.

**Interfaces:**

- Independent of Task 1 TS interfaces; shares exact endpoint semantics and no-success policy.
- Core enum `FrameImageFormat` png/jpg, correct extension/MIME, encoded frame export path without forced scale, safe bounded local filename from captured frame name. Core response validation/error mapping testable without SwiftUI; adapt signatures to existing APIError/NativeMessages patterns without introducing a networking abstraction.
- DoopClient `exportImage(frameID: String, name: String, format: FrameImageFormat) async throws -> URL`: construct request through existing `request`, image Accept, timeout 120, `session.data(for:)`, same-server HTTP response, format MIME/status validation and controlled German messages; atomic write to `ExportDirectory.destination`. Allow cancellation to propagate. Local name is sufficient; no Content-Disposition parser needed.
- `FrameImageExportView` captures `DesignFrame` and client on presentation. PNG/JPG preparation becomes explicit native ShareLink via `Transferable`/`FileRepresentation`/`SentTransferredFile`; show filename and German inline failure, disable duplicates, .task(id:) or equivalent cancellation protection. Check current captured identity before publishing response, keep file during share consumption. No success toast. Preserve old HTML panel and canvas link.
- German usage description: `Speichere Deine exportierten Designs in Deinen Fotos.` in Debug and Release. Do not proactively request photo permission.

- [ ] **Step 1: Write core checks first.** Assert both exact image MIME/extension/path/no scale, encoded path segment, filename traversal/control/empty/long cases with extension intact, HTTP500/429 safe known error mapping, arbitrary server errors not leaked, expected MIME mismatch and empty body rejection. Register checks in @main runner. Add source wiring tests under `tests/nativeFrameShare.test.ts` only for wiring not executable on Linux, explicitly not a substitute for Swift/native runtime checks.
- [ ] **Step 2: Verify RED where runnable.** Run Swift core checks if toolchain exists; if unavailable record it, and run focused source wiring tests before implementation to prove integration requirements fail. Do not claim Swift RED ran on Linux without swift. This is an explicit environment exception, not a fake native test.
- [ ] **Step 3: Implement native flow and docs.** Use SwiftUI patterns already present, explicit image file representation, export-specific timeout/validation and isolated filenames. Ensure new sources compile under project membership pattern. Add usage description. Preserve HTML/link sharing. Record temp lifetime limit near code as `shortcut: ...` only if applicable. Docs checklist: supported browser PNG/JPG/open/cancel/retry, unsupported desktop download, iOS PNG/JPG/Save to Files/Photos/cancel/offline/slow render/HTML. Never check manual cases not executed.
- [ ] **Step 4: Verify GREEN.** Run source wiring tests and all web export/share tests; `swift run --package-path ios DoopCoreChecks` and simulator build if available; otherwise state unavailable and leave native/manual acceptance open. Validate plist/project source registration structurally. Run `bun run typecheck` and docs lint. Format owned files only.
- [ ] **Step 5: Self-review and commit.** Subject `feat: Add native image file sharing`. Report exact executed commands, unexecuted Apple checks, files and concerns to supplied report path. Do not push, merge, close Backlog, or start subagents.

## Controller final verification

- [ ] Fresh GPT-6.1 Terra whole-branch review after both task reviews; same named reviewer model, broad independent scope.
- [ ] Run final full suite with bounded parallelism and sufficient timeout, typecheck, lint, build and existing real PNG/JPG renderer tests. Distinguish unrelated baseline timing/resource failures.
- [ ] Persist council decisions, task reviews and evidence in `docs/superpowers/reports/2026-11-04-file-sharing.md`; check Backlog AC only against evidence, keep AC3 open if no native/manual execution, status In Progress.
- [ ] Keep local branch/worktree, do not push/merge. Show branch and remaining native test limit to user.

## Self-review

Both web and native requirements have testable tasks. Files/interfaces do not overlap across implementation tasks; docs consume the shared no-success/prepare policy only. All five review-focus cases are assigned. No new rendering pipeline, permission policy or dependency. User's delegated decision authority replaces repeated design/plan confirmation. Council design consultation is not a scored code-review round.

## Historical execution result before Task3

Product source `ccb98a7`: web and native source implemented by Muse Spark1.3, task/fix/whole-branch reviews by GPT-6.1 Terra. Controller final run **238files/2140tests passed**, typecheck/lint/build passed; doc-lint passed with disclosed freshness heuristic warning. **Not complete or merge-ready:** Terra final re-review still finds native revision-only/updatedAt invalidation missing after the single permitted final wave. Native Swift core/build/manual acceptance also unrun on Linux. Keep TASK-35 In Progress and AC3 open. Continue only the native revision blocker plus remaining verification; do not repeat completed tasks. See `docs/superpowers/reports/2026-11-04-file-sharing.md` and preserved SDD ledger for evidence/decisions.

### Task 3: Preserve native export revisions

**Authorization:** New explicit user request for Council solution after handback; continue only the residual revision defect. Completed Tasks1/2 remain completed. Requirements are the new follow-up section in the existing design.

**Files:** `ios/Doop/Core/Models.swift`, `ios/Doop/Core/FrameImageExport.swift`, `ios/Doop/CanvasModel.swift`; `ios/Tests/FrameImageExportTests.swift` and `tests/nativeFrameShare.test.ts`. Existing `FrameImageExportView.swift` guards/observer stay intact unless a concrete integration adjustment is necessary. Controller updates persistent report/Backlog separately.

**Review-driven integration check:** Extend the existing `ios/ConnectionTests/Checks.swift` harness (real CanvasModel, test-only DoopClient collaborator) with a combined stale-frame revision repair, another frame's pending move overlay and deleted selected-element pruning scenario. Normalize the `didSet` value explicitly before overlay/prune; do not depend on whether property-wrapper self-assignment invokes the observer again. No production test hooks or new harness. Apple execution is still unavailable locally and must be reported unrun.

**Interfaces:** Add `public var updatedAt: Double? = nil` to DesignFrame; existing synthesized Codable/Equatable retain compatibility and include revision. `FrameImageExport.identity(of:)` keeps existing fields and appends an explicit revision/legacy marker. Produce a tiny pure core function `keepingNewerFrameRevisions(_ incoming: [DesignFrame], than current: [DesignFrame]) -> [DesignFrame]` (equivalent concise naming permitted) used at the existing `canvas.didSet` boundary before pending-move overlay. Incoming snapshot is authoritative for membership: map incoming frames only; keep current entry only if same id and both known revisions satisfy current>incoming. Equal revisions may have different reveal HTML and must not be rejected. Match canvas IDs before merging; preserve nil/deletion and existing pending move ownership. No generation map, networking wrapper, dependency or server changes.

- [ ] **Step1: RED.** Add native core checks before implementation: numeric/missing/null revision decode; same content/different revision changes frame equality and identity; A1/B2/A3 rejects old identity; same-version changing HTML differs; missing legacy versions remain stable/decodable. Test production merge helper with newer/older/equal/unknown revisions, A3 followed by delayed A1, snapshot deletion/no resurrection/new ids/retained order. Add labelled source-wiring tests for common boundary, same canvas guard, existing .onChange and both completion guards. Run source tests to observe expected failures; record Swift execution unavailable rather than fake it. Do not copy production predicate into TS tests and call that behavioral proof.
- [ ] **Step2: Implement.** Optional revision, identity suffix, and shared pure merge at existing canvas observer only. Keep pending move overlay, selection pruning and deletion semantics. Add one-line `shortcut:` legacy-unknown revision limitation comment. Do not remove content fields; server reveal updates share a version.
- [ ] **Step3: GREEN.** Run `bun run test tests/nativeFrameShare.test.ts tests/germanNativeResources.test.ts tests/frameExport.test.ts tests/frameShare.test.ts tests/frameShareActions.test.tsx tests/frameExportModal.test.tsx`, typecheck, repo lint, format owned TS. Author Swift core tests for macOS CI; do not install tooling or claim Swift execution. Self-review/commit owned files only, lowercase subject under50chars; report to supplied task3 report path. No push/merge/Backlog edits/subagents.
- [ ] **Step4: Reviews and verification.** Fresh Terra task review, then fresh read-only Council scoped round2 with scores; address only concrete revision-fix issues, no new whole-app scope. Controller final suite/typecheck/lint/build/doc diagnostics on unchanged final code, persistent evidence and pending Apple acceptance. All original rules/constraints remain.

## Final follow-up result

Reviewed source `5e26ba0`: native revision blocker resolved by Muse `7dcddd3`/`2352d1a`, isolated source-test correction `5e26ba0`, Terra source findings accepted. Council2rounds: **Opus5.5 5→8/10, Sol6.1 5→9/10, MuseWonder4→8/10**; all accept scoped source correctness, native runtime gate explicitly open. Controller **238files/2145tests PASS**, typecheck/lint/build PASS, doc-lint PASS with disclosed freshness heuristic; build has known large-chunk warning. No remaining scoped Critical/Important source finding. Swift core/ConnectionChecks/Xcode/manual acceptance remain unrun on Linux, AC3 open and TASK-35 In Progress. Optional duplicate-ID hardening tracked as TASK-81 To Do. Detailed evidence and decisions in persistent report; do not repeat completed work.

## Accepted completion

PR12 merged as `0d9f0d0`. Subsequent Apple CI on `704ed5c` passed Swift core checks, real CanvasModel connection/integration checks and iPhone/iPad simulator build; web CI passed. User explicitly confirmed task completion, so TASK-35/AC3 are now Done through CLI. The agent did not personally perform manual Share Sheet interaction. Earlier open-gate records above are historical; TASK-81 stays To Do. Local/remote main synchronization and non-main branch cleanup follow the user's explicit request while preserving unrelated uncommitted files and detached worktree contents.
