# TASK-34: Reliable preset PNG/JPG exports

## Intent and scope

Make downloaded PNG/JPG files match existing format presets, wait for fonts, and report controlled failures rather than silently delivering fallback-font output. Keep ordinary previews, thumbnails, agent screenshots and free-frame exports compatible. The user delegates open decisions to the controller's recommendations and requests Council advice, Muse Spark 1.3 implementation, and GPT-6.1 Terra code review.

## Approaches

1. **Recommended: server-authoritative download defaults.** Remove forced scale from UI/clipboard and MCP download URLs. Downloads without an explicit supported scale use preset `exportScale`, or 2 for free frames. Existing explicit scale 1/2 and non-download callers retain their behavior. This avoids duplicating preset decisions across clients or widening the public scale parameter.
2. Add a separate preset URL flag. More caller branches and another combination with `preview`; no benefit over the existing `download` intent.
3. Force physical A4 2480 × 3508 by geometry changes or resampling. Reject: changes existing layout or adds image processing for a one-pixel discrepancy.

The controller selects approach 1 under the user's advance authorization; this is not a claim that the user explicitly selected its details.

## Export contract

- Social presets: Instagram Post 1080 × 1080; Instagram Story and WhatsApp Status 1080 × 1920; Facebook Post 1200 × 630. Both PNG and JPG. No safe-zone overlays or parent editor chrome.
- A4 keeps 794 × 1123 CSS px and device scale 300/96 = 3.125. Round each output axis with `Math.round`: **2481 × 3509**. No resampling, cropping or CSS geometry migration. Direct Chromium characterization confirmed these dimensions for both PNG and JPEG before implementation. Physical 210 × 297 mm rounds to 2480 × 3508 at 300 dpi, but that is not the raster contract of the already-rounded CSS layout. Do not promise embedded 300-dpi metadata or print readiness.
- Server derives default download scale from persisted frame metadata. Only explicit supported query scales 1/2 override; arbitrary numeric query values are not accepted. Downloads without a valid explicit scale use the default policy. A download takes precedence over `preview`, never serving/persisting a thumbnail as an export.
- Non-download requests preserve their existing default scale, thumbnail dispatch, agent screenshot scales and `primeImage` behavior. `renderFrame` default scale remains 1.
- Free frames without presets retain 2× default download output, including PNG clipboard. Creators can resize a preset frame while keeping its preset: export actual stored dimensions × preset scale with per-axis rounding, not a forced canonical size or crop. Exact preset target sizes apply to canonical frames. Do not introduce a geometry repair layer.
- MCP `image_url` stays 2× with existing width/height meaning. Its `download_url` follows the same preset-aware default as UI. Make any differing download dimensions explicit without breaking existing image fields.

## Font readiness and failures

- Preset download requests, including explicit scale, use a strict font boundary. Ordinary previews, inspection, agent screenshots and free-frame downloads remain best-effort. Free legacy frames retain the current bounded font wait/fallback even with broken external fonts; declared failed fonts on preset downloads are reported instead of silently substituted.
- Set final capture viewport/density before strict font readiness; avoid stacking a second font wait onto the current best-effort wait.
- Wait for `document.fonts.ready`, then reject any declared face with `status === 'error'`; unused `unloaded` faces are not errors and must not be forcibly loaded. Ready alone is not successful loading.
- Preserve the existing 8-second content-load boundary and use a bounded 8-second font-settlement boundary, enforced from the server as well as the page. Clean up the isolated page/context on failure and clear timeout handles. A stalled font must not leave a pending render or deliver bytes. Keep current request guards and isolation.
- Return a controlled German export/font failure to UI/clipboard rather than raw internal errors. Preserve current busy-state cleanup and retry behavior.
- Downloads get separate in-process cache identity, even at the same scale as lenient captures or primed PNGs. Preserve single-flight reuse, frame-version invalidation, failure eviction, rate limiting and authentication behavior.

## Verification

- Unit/integration tests: default/explicit scales, all presets, free frames, download-over-preview dispatch, strict/lenient cache separation, strict failure eviction and retry, UI download/clipboard errors, MCP download URLs and truthful dimensions.
- Real Chromium: decode PNG/JPG for all five presets and a free frame; assert exact output dimensions and no safe-zone pixels using nonzero safe-zone metadata. Exercise production download dispatch, not only a hand-selected renderer scale.
- Fonts: delayed success/parity; missing/corrupt font errors; bounded stalled-font failure; unused font declarations do not fail; existing lenient behavior preserved. Verify viewport-dependent fonts at final geometry.
- Run full tests, typecheck, lint and production build on unchanged final code. Record any environmental baseline failures separately.

## Non-goals and risks

No new dependencies, export UI, PDF, sharing (TASK-35), additional formats (TASK-63), DPI metadata, font-hosting changes, image resampling or broader screenshot refactor. Automatic checks do not replace manual desktop/iOS save-panel or physical print validation. Keep TASK-34 In Progress until explicit user acceptance. Never include or revert unrelated main-checkout changes; do not push or merge.
