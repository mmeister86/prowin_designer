# Preset Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement TASK-34 reliable preset-sized PNG/JPG downloads and bounded strict font loading.

**Architecture:** Resolve download defaults server-side from existing format metadata; leave preview/agent behavior alone. Carry download intent to the renderer for strict font readiness and a separate cache identity.

**Tech Stack:** TypeScript, existing Express/Puppeteer/Chromium/sharp, Vitest. No dependencies added.

**Spec:** `docs/superpowers/specs/2026-11-03-preset-export-design.md`

## Global Constraints

- Social presets: Instagram Post 1080 × 1080; Instagram Story and WhatsApp Status 1080 × 1920; Facebook Post 1200 × 630. Both PNG and JPG. No safe-zone overlays or parent editor chrome.
- A4 keeps 794 × 1123 CSS px and device scale 300/96 = 3.125. Round each output axis with `Math.round`: **2481 × 3509**. No resampling, cropping or CSS geometry migration.
- Only explicit supported query scales 1/2 override; arbitrary numeric query values are not accepted. Downloads without a valid explicit scale use the default policy. A download takes precedence over `preview`, never serving/persisting a thumbnail as an export.
- Free frames without presets retain 2× default download output, including PNG clipboard. Creator-resized preset frames export actual stored dimensions × preset factor, rounded per axis; do not crop or normalize them.
- Preset download requests, including explicit scale, use a strict font boundary. Ordinary previews, inspection, agent screenshots and free-frame downloads remain best-effort.
- Preserve the existing 8-second content-load boundary and use a bounded 8-second font-settlement boundary, enforced from the server as well as the page. Clean up the isolated page/context on failure and clear timeout handles.
- Downloads get separate in-process cache identity, even at the same scale as lenient captures or primed PNGs. Preserve single-flight reuse, frame-version invalidation, failure eviction, rate limiting and authentication behavior.
- No new dependencies, export UI, PDF, sharing, additional formats, DPI metadata, font-hosting changes, image resampling or broader screenshot refactor. Keep TASK-34 In Progress until explicit user acceptance. Do not push or merge.
- Code implementation: Muse Spark 1.3. Independent task and whole-branch review: GPT-6.1 Terra. User delegates open decisions to controller recommendations.

## Review Focus

- Download plus preview must never return a persisted card image (Task 1 dispatch test).
- Invalid scale strings must not enable unbounded arbitrary rendering or suppress preset defaults (Task 1 HTTP tests).
- Primed or lenient cached PNGs must not bypass strict font verification (Task 2 cache test).
- A viewport-dependent font must be awaited at final capture geometry, including heights beyond inspection's 4000px cap (Task 2 browser fixture).
- Fonts that fail or never settle must produce controlled error/no bytes, clean up, and permit retries; unused unloaded declarations must succeed (Task 2 browser/unit cases).

---

### Task 1: Apply preset-aware download dimensions

**Files:**

- Modify: `shared/prowin/formats.ts`, `src/lib/frameExport.ts`, `server/index.ts`, `server/previews.ts`, `server/mcp.ts`.
- Modify docs: `docs/prowin/doop-fork-umsetzung.md` §§10.1/10.4 and `docs/prowin/bezugsdokumente-referenz.md` R1.6/R1.8.
- Tests: `tests/frameExport.test.ts`, `tests/previews.test.ts`, MCP export coverage alongside `tests/mcpScreenshotCache.test.ts`; add `tests/presetExportReal.test.ts` and HTTP coverage using existing harness patterns.

**Interfaces:**

- Consume `Frame.preset`, `FORMAT_PRESETS`, existing `getImage(frame, req)`, `renderFrame(frame, scale, opts)`, and download/clipboard entry points.
- Produce shared `defaultExportScale(preset?: FormatPresetId): number`, returning existing preset exportScale or 2. Keep this tiny helper in `shared/prowin/formats.ts`.
- `ImageRequest.scale` becomes optional `1 | 2`, add optional `download?: boolean`. Resolve effective scale inside `getImage`: `req.scale ?? (req.download ? defaultExportScale(frame.preset) : 1)`. Cache key uses resolved numeric scale. Download excludes persisted preview dispatch.
- Route parses only literal '1'/'2', otherwise undefined; passes download presence. UI/clipboard use `/i/<id>.<ext>?download` without a forced scale. MCP download URL has download intent plus optional JPG quality, no forced scale; keep image_url and width/height semantics, add explicit download_width/download_height from rounded frame geometry × default scale.

- [ ] **Step 1: Write and run failing tests.** Assert UI/clipboard request download without forced scale; default preset scales 1/3.125, free2, non-download1, explicit1/2 overrides, download+preview ignores persisted thumbnail. HTTP test invalid/omitted scale policies and headers. MCP image fields unchanged and download URL/dimensions truthful. Real Chromium via getImage: both formats for all five presets, free frame 101×77 →202×154, nonzero safeZoneOverride metadata plus decoded edge/ground pixels without overlay. Hardcode A4 2481×3509 in assertions, not only expectations generated by production code. Use efficient image statistics/sample assertions, not millions of individual matcher calls.
- [ ] **Step 2: Verify RED.** `bun run test tests/frameExport.test.ts tests/previews.test.ts tests/presetExportReal.test.ts` plus named HTTP/MCP tests. Record failing expectations before product changes.
- [ ] **Step 3: Implement the narrow policy and caller updates.** Preserve existing rate limits, guarded renderer, quality clamping, thumbnails, explicit screenshot callers and free frame compatibility. No general URL builder/framework. Correct docs: distinguish physical A4 2480×3508 from this renderer's 2481×3509; no claim of density metadata/print readiness.
- [ ] **Step 4: Verify GREEN.** Run focused tests including existing `tests/mcpScreenshotCache.test.ts`, `tests/safeZoneExportReal.test.ts`, `tests/frameExportModal.test.tsx`, typecheck and lint on changed files. Report actual Chromium dimensions and skipped tests, if any.
- [ ] **Step 5: Self-review and commit only task-owned files.** Subject `fix: export preset images at target size`. Write report with exact commands/outcomes, commit range, any concerns. Do not mark Backlog Done.

### Task 2: Enforce strict downloadable font readiness

**Files:**

- Modify: `server/screenshot.ts`, `server/previews.ts`, `server/index.ts`.
- Test: `tests/prowinFontsBrowser.test.ts` or focused new strict-font browser suite; `tests/previews.test.ts`, `tests/frameExport.test.ts`, HTTP export error coverage and renderer mocks/cleanup cases.

**Interfaces:**

- Consume Task1 `ImageRequest.download` and server-authoritative scale policy; preserve its exact dimension contract.
- Produce renderer option `requireSettledFonts?: boolean` in `renderFrame` options, passed only for preset download requests. Extend internal `loadFramePage` options narrowly to establish final scale/full height before content load for strict capture. Leave inspection, free frames and lenient behavior unchanged.
- Strict cache identity includes download/strict intent, not only resolved scale; `primeImage` remains lenient.
- Font settlement returns success or a dedicated controlled failure type/code, mapped to a stable German HTTP error. Never expose arbitrary exception text. Use a dedicated error module only if needed to preserve lazy screenshot import; do not eagerly load Puppeteer into HTTP startup.

- [ ] **Step 1: Write and run failing tests.** At the same scale/version, primed and lenient bytes cannot satisfy strict download; strict requests single-flight; failed strict promise evicts and retries; rate limits still apply. Assert flag reaches renderFrame only on preset downloads, free-frame downloads remain lenient (including broken external fonts). Real fonts: delayed brand-font success/parity; missing/corrupt used face rejects; unused unloaded declaration succeeds; stalled used font rejects before20s with no bytes; final-height/density-dependent used font is checked. HTTP failure JSON is controlled and UI/clipboard show error with no download/busy leak. Cleanup unit tests assert context close on readiness evaluation failure and server timeout. Preserve original lenient stalled-font test. Add a Creator-resized preset dimension test proving actual dimensions are preserved.
- [ ] **Step 2: Verify RED.** Run new/modified font/cache/error tests and record intended failing assertions.
- [ ] **Step 3: Implement strict font boundary.** Configure final viewport before strict content readiness; use the existing 8s content boundary plus one 8s font boundary, not two successive font waits. Await document.fonts.ready and inspect FontFace status==='error'; ignore unused unloaded faces. Server-side deadline must bound a page evaluation even if page timers/microtasks do not settle; clear timers and close isolated context on all failure paths. Preserve existing public-request guards. Return controlled font-specific German failure, no image bytes; do not change lenient callers.
- [ ] **Step 4: Verify GREEN.** Run all focused export, preset, MCP cache and font suites; `bun run typecheck`, `bun run lint`, `bun run build`. Record evidence and any fixture cleanup limitations.
- [ ] **Step 5: Self-review and commit only task-owned files.** Subject `fix: reject exports with unsettled fonts`. Write report with exact commands/outcomes and commit range. Do not push/merge or close Backlog.

## Controller final verification

- [ ] Fresh GPT-6.1 Terra whole-branch review after task-scoped reviews.
- [ ] Run full `bun run test`, typecheck, lint and build on unchanged final code; keep results distinct from pre-change baseline.
- [ ] Check Backlog AC only against verified evidence and record final report. Leave status In Progress pending explicit manual acceptance.

## Self-review

Both tasks cover the spec; shared previews/index interfaces are intentionally sequential. Task1 is independently reviewable dimension/caller policy, Task2 adds strict success/failure semantics. All five review-focus cases have assigned tests. No new public arbitrary-scale API or dependency is introduced. Controller may make equivalent local interface choices only with a recorded ruling that preserves the spec.
