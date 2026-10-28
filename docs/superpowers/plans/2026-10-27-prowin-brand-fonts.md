# proWIN Brand Fonts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the approved proWIN fonts from the own instance and prove that browser frames, Chromium exports, and iOS/Blitz use them without third-party font requests.

**Architecture:** Check static WOFF2 assets into `public/fonts`, with exact Fontsource packages retaining provenance for Sofia/Roboto. Serve that directory through Express with CORS for opaque-origin frames, proxy `/fonts/` through Vite in development, and let the existing Vite build/Docker copy carry the same bytes into production. Keep Blitz's existing URL loader; add host-side rendering tests instead of duplicating fonts in the iOS bundle.

**Tech Stack:** TypeScript, Vitest, Vite, Express, Puppeteer/Chromium, Rust, Blitz, WOFF2, Fontsource.

**Spec:** `backlog/tasks/task-25 - Markenschriften-selbst-hosten-und-Renderer-Parität-prüfen-Q8.md`; `docs/prowin/doop-fork-umsetzung.md` §§ 8.3 and 17 (Q8); `docs/prowin/bezugsdokumente-referenz.md` R1.8; `DESIGN-prowin.md` § 4.

## Global Constraints

- Scope is frames and exports only. Do not change `index.html`, `.storybook/preview-head.html`, or the desktop DMG background.
- Use static WOFF2, Latin and Latin-Ext, with no Google Fonts CDN or other third-party font origin in the reference frames.
- Include Sofia Sans 300/500, Sofia Sans Condensed 700, and Roboto 300/500/900 from exactly pinned Fontsource packages.
- Include user-supplied LumiosBrush-Regular and LTKai-Regular after inspecting the original files. The user owns license clearance; never extract font programs from PDFs or use unofficial download mirrors.
- Missing required glyphs are a blocker. Never hide them with fallback fonts or fabricate Latin-Ext coverage.
- Frame HTML normalization belongs to TASK-26; CSP and general third-party request blocking belong to TASK-27.
- Use the existing Blitz URL loader. Do not add iOS bundled fonts or TTF conversions at runtime.
- Do not run git commits or other git mutations without fresh explicit user confirmation.

## Review Focus

- A font response delayed beyond the existing 120 ms grace period must not produce a fallback-font export; Task 2 delays a real WOFF2 response and checks the settled render.
- Latin-Ext-only glyphs must come from the intended subset; Tasks 2–4 use `Łódź Đ` and verify coverage/requests rather than only `document.fonts.status`.
- A stalled font must not hang export forever; Task 2 bounds the `document.fonts.ready` wait and exercises the timeout path.
- `srcDoc`, `page.setContent()`, and Blitz need a usable base and CORS; Tasks 1–3 use absolute same-instance URLs and verify `Access-Control-Allow-Origin: *`.
- Supplied brush fonts may lack required glyphs; Task 4 checks the actual fonts and stops rather than accepting silent fallback.

---

### Task 1: Versioned Font Assets and Same-Instance Delivery

**Files:**

- Create: `public/fonts/*`
- Create: `tests/prowinFonts.test.ts`
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `server/index.ts`
- Modify: `vite.config.ts`

**Interfaces:**

- Consumes: existing Vite `public` → `dist` build and Docker `dist` copy.
- Produces: same-instance `/fonts/<file>.woff2` URLs with `Content-Type: font/woff2` and `Access-Control-Allow-Origin: *` in development and production.

- [ ] **Step 1: Write the failing asset and delivery tests**

In `tests/prowinFonts.test.ts`, define the exact 12-file core manifest: Sofia Sans 300/500, Sofia Sans Condensed 700, Roboto 300/500/900, each Latin and Latin-Ext. Assert WOFF2 magic bytes, byte equality with the pinned `node_modules/@fontsource/*/files/` originals, and presence of the three OFL license files. Start the harness server and a Vite server with `/fonts/` proxied to it; fetch one Latin-Ext file through the Vite origin and assert its bytes, MIME type, and CORS header.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test -- tests/prowinFonts.test.ts`
Expected: FAIL because the manifest files and `/fonts/` delivery do not exist.

- [ ] **Step 3: Add the pinned sources and checked-in assets**

Run `bun add --save-dev --exact @fontsource/sofia-sans@5.3.0 @fontsource/sofia-sans-condensed@5.3.0 @fontsource/roboto@5.3.0`. Copy only the 12 static normal WOFF2 files and package licenses into `public/fonts`, preserving Fontsource's descriptive filenames.

- [ ] **Step 4: Serve fonts through Express and Vite**

In `server/index.ts`, mount `/fonts` before the production catch-all, reading `dist/fonts` in production and `public/fonts` otherwise. Set `Access-Control-Allow-Origin: *` on font responses. In `vite.config.ts`, proxy `/fonts/` to the API so development uses the same headers and bytes. Do not add a Docker step; the existing `dist` copy already covers it.

- [ ] **Step 5: Verify assets, delivery, and build output**

Run: `bun run test -- tests/prowinFonts.test.ts && bun run build`
Expected: tests PASS and `dist/fonts` contains exactly the checked-in core WOFF2 files and licenses.

### Task 2: Browser/Chromium Font Parity

**Files:**

- Create: `tests/prowinFontsBrowser.test.ts`
- Create: `tests/fixtures/prowinFontReference.html`
- Modify: `server/screenshot.ts:94-118,347-375`

**Interfaces:**

- Consumes: Task 1 `/fonts/*` URLs and the existing `FRAME_BOOTSTRAP` message protocol.
- Produces: `renderFrame()` allows own-origin `/fonts/` requests and waits at most 8 seconds for `document.fonts.ready` before inspection/capture.

- [ ] **Step 1: Write the failing delayed-font parity test**

Build one fixed reference containing all core families/weights and the text `Łódź Đ`. Load it through the real sandboxed `FRAME_BOOTSTRAP` iframe and through `renderFrame()` at the same viewport. Delay `/fonts/` responses by 300 ms, record all requests, and assert that only the test instance is contacted, both Latin and Latin-Ext files load, and the browser/export screenshots have identical pixels. Add a separate stalled-font case proving capture returns within the existing 8-second budget rather than waiting indefinitely.

- [ ] **Step 2: Run the browser tests to verify they fail**

Run: `bun run test -- tests/prowinFontsBrowser.test.ts`
Expected: FAIL because own-origin `/fonts/` is not allowed and the 120 ms path captures before the delayed fonts settle.

- [ ] **Step 3: Implement the minimal renderer changes**

Extend `loadFramePage()`'s `allowUrl` predicate to accept the configured asset origin for paths starting with `/fonts/` as well as `/a/`. After `setContent()` and before returning the loaded page, await in page context `Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 8000))])`; this covers inspection and capture without leaving a Node timer behind.

- [ ] **Step 4: Verify parity and regression behavior**

Run: `bun run test -- tests/prowinFontsBrowser.test.ts tests/frameRuntimeBody.test.ts`
Expected: PASS, including delayed and stalled font cases.

### Task 3: Prove Blitz URL-Loaded WOFF2 Rendering

**Files:**

- Modify: `ios/BlitzKit/rust/tests/abi.rs`
- Modify: `ios/README.md:29-37,96-126`
- Modify: `docs/prowin/doop-fork-umsetzung.md:323-330,568-569`

**Interfaces:**

- Consumes: Task 1 WOFF2 bytes and the existing `doopblitz_doc_new` base URL/network provider/loading API.
- Produces: a host-side Blitz test proving actual URL-loaded WOFF2 rendering and documentation resolving Q8 in favor of same-instance URLs.

- [ ] **Step 1: Write the failing loopback ABI test**

Serve the checked-in WOFF2 files from a local TCP listener. Render a reference with absolute loopback `@font-face` URLs and `Łódź Đ`, repaint until `doopblitz_doc_loading()` clears, then compare the branded result with an otherwise identical missing-font control. Assert the local server received the expected font requests and that glyph geometry or dark-pixel output differs from fallback; HTTP 200 alone is not acceptance.

- [ ] **Step 2: Run the test against the existing URL loader**

Run: `cargo test --release --manifest-path ios/BlitzKit/rust/Cargo.toml prowin_brand_font -- --nocapture`
Expected: PASS if the existing URL loader already provides the required behavior; this is a characterization test, so an immediate PASS means no Blitz production change is needed. If it FAILS, use systematic debugging. If Rust is unavailable, record the execution blocker explicitly; do not claim runtime verification.

- [ ] **Step 3: Change Blitz only when the test proves a defect**

Prefer the existing URL loader and no production change. Only if the failing test proves an engine/bridge defect, patch the narrowest responsible code while preserving the existing network and repaint flow.

- [ ] **Step 4: Document Q8 and its verification boundary**

Replace the iOS README's Google Fonts statement with same-instance WOFF2 URL loading. Record that no app bundle is needed, CORS is required for browser frames, and general external-request enforcement remains TASK-27. Distinguish host-side ABI verification from any still-required macOS/iOS simulator check.

- [ ] **Step 5: Run the Blitz verification**

Run: `cargo test --release --manifest-path ios/BlitzKit/rust/Cargo.toml prowin_brand_font -- --nocapture`
Expected: PASS with real local WOFF2 requests and a settled branded render; otherwise record the concrete blocker.

### Task 4: Add LumiosBrush-Regular and LTKai-Regular

**Files:**

- Create: `public/fonts/lumios-brush-*.woff2`
- Create: `public/fonts/lt-kai-*.woff2`
- Create: `public/fonts/*lumios*license*` and `public/fonts/*lt-kai*license*` when supplied
- Modify: `tests/prowinFonts.test.ts`
- Modify: `tests/prowinFontsBrowser.test.ts`
- Modify: `ios/BlitzKit/rust/tests/abi.rs`
- Modify: `DESIGN-prowin.md:99-121`

**Interfaces:**

- Consumes: original user-supplied files under `/tmp/opencode/prowin-fonts/` and Tasks 1–3 delivery/render tests.
- Produces: self-hosted Regular faces for both additional families with explicit glyph-coverage evidence.

- [ ] **Step 1: Inspect the supplied originals before conversion**

Identify family/style metadata and cmap coverage with an isolated local font tool. Verify that the files really are LumiosBrush-Regular and LTKai-Regular and enumerate support for the reference's Latin and Latin-Ext characters. Missing required coverage or missing originals blocks this task; do not substitute another font.

- [ ] **Step 2: Extend the tests with the two required faces**

Add both families to the asset manifest, browser reference, and Blitz loopback reference. Assert their WOFF2 bytes, actual font requests, and non-fallback rendering of every supported required subset.

- [ ] **Step 3: Run the expanded tests to verify they fail**

Run: `bun run test -- tests/prowinFonts.test.ts tests/prowinFontsBrowser.test.ts`
Expected: FAIL until the additional WOFF2 assets exist.

- [ ] **Step 4: Convert and add only the supplied originals**

Create WOFF2 assets without changing glyph outlines. Use separate Latin/Latin-Ext subsets only where the source coverage supports them; retain supplied license notices. Update `DESIGN-prowin.md` to record the user's explicit inclusion decision and license ownership without inventing a license grant.

- [ ] **Step 5: Run all renderer checks**

Run: `bun run test -- tests/prowinFonts.test.ts tests/prowinFontsBrowser.test.ts`
Run: `cargo test --release --manifest-path ios/BlitzKit/rust/Cargo.toml prowin_brand_font -- --nocapture`
Expected: PASS for both added families; missing files, glyphs, or an unavailable Rust toolchain remain explicit unverified items.

### Task 5: Full Verification and Backlog Evidence

**Files:**

- Modify: Backlog TASK-25 through `backlog task edit` only
- Modify: `docs/prowin/doop-fork-umsetzung.md` if verification results require clarification

**Interfaces:**

- Consumes: all previous test results.
- Produces: reproducible verification evidence; acceptance criteria checked only when actually proven.

- [ ] **Step 1: Run the project verification suite**

Run: `bun run typecheck && bun run test && bun run build && bun run lint`
Expected: all commands PASS. Report any pre-existing failure by name rather than hiding it.

- [ ] **Step 2: Verify the Docker asset boundary**

Run: `docker build -t doop-task25 .` followed by a container file check for every expected `dist/fonts` asset.
Expected: all checked-in WOFF2 and license files are present in the runtime image. If Docker execution is unavailable, retain `bun run build` evidence and label the container check unrun.

- [ ] **Step 3: Record evidence without closing the task**

Use `backlog task edit 25 --append-notes ...` and `--check-ac` only for criteria with real evidence. Leave status `In Progress`; only explicit user confirmation after manual testing may move TASK-25 to `Done`.
