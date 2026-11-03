# TASK-33 Safe zones design

## Intent and scope

Warn about platform-obscured semantic content without blocking editing. Implement TASK-33 acceptance criteria using existing preset dimensions, template capabilities and iframe bridge. User explicitly delegates decisions and accepts recommendations; this design is the controller's recommendation, not a claim of separately reviewed human choices.

## Approaches

- **Selected:** nullable frame metadata, iframe geometry reports, parent-side React overlays. Fits the sandbox and keeps saved/exported HTML untouched.
- Injected iframe warnings risk leaking into HTML serialization; reject.
- A separate template table or canvas map adds copy/sync complexity without a separate template entity; reject.

## Binding behavior

- Defaults: IG/FB post 50 px on every side; IG story top 200/bottom 250; WA status top 150/bottom 200; story/status left/right 0; A4 11 CSS px on every side.
- `Frame.safeZoneOverride?: Insets` fully replaces preset insets; omitted inherits, PATCH null resets, four zeroes remove margins. Overrides require a preset. Changing/removing a preset clears the override unless a replacement is supplied. Saving the same preset preserves it.
- Insets have exactly four finite nonnegative integer values. Explicit overrides must leave positive inner width/height against resulting frame dimensions; reject invalid writes with German errors. Preset defaults stay absolute, even if a Creator resizes a frame.
- Reuse `canvasCapabilities(...).manageLocks` to author/change/reset overrides. Non-Creator source copies inherit stored source metadata; attempts to differ are denied before side effects. Generic metadata is never accepted through frame drag relays.
- Persist metadata through ordinary writes, page/canvas copies, hydration, clipboard/duplicate/Alt-drag and undo/redo. Null resets survive JSON; compare inset objects by value. Version restore retains current metadata but must not make explicit overrides invalid.
- Show red bands at roughly 10% opacity and subtle orange outlines for **every visible data-od-role element**, including image/decor, that crosses into a margin or outside the frame. No role exceptions or per-element exemptions. Touching the inner boundary is not a violation.
- Visibility is a local per-user preference, default on, controlling bands and warnings together. Show effective margins and textual warning status; Creator-only four-input editor with reset. Save failure leaves previous policy in place and displays an error; record history only after successful writes.
- Draw only in the parent DOM with pointer-events none; never mutate iframe DOM for warnings. Preserve sandbox isolation. Measurement uses the existing request/reply bridge, frame-local CSS pixel geometry, bounded validated replies (maximum 200 semantic boxes), freshness tokens, and incomplete/unavailable status rather than false success. Refresh on render, frame resize, live edits, DOM/resource/font layout changes without polling; suspend while hidden. Include display:contents descendants. Geometry is advisory and never trusted for authorization/agent policy.
- One shared resolver supplies UI, MCP summaries and Resident context. Shared agent guidance includes preset defaults before creation and instructs important text/CTA to remain in the inner rectangle. Frame inspection/create/read context includes effective values and units. Agent tools need no override-authoring capability for this task; validated source copies inherit it.
- Correct R2.2: 3 mm × 96 / 25.4 = 11.34 CSS px, rounded to 11; ×300/25.4 = 35.43 raster px, not 85. At existing 3.125 export scale rounded 11 becomes 34.375 raster px. This is an advisory inner margin, not print bleed or a print-ready guarantee.

## Non-goals and risks

No new dependencies, per-element exclusions, layout engine, export-size changes (TASK-34), placement fixes (TASK-80), new roles, or HTML safe-zone attributes. Bounding boxes approximate transformed/clipped content; same-frame scripts can forge advisory measurements. Platform/physical print validation remains manual.

## Verification

Pure boundary/default/validation tests; permission and REST/MCP tests; DB reload and copies; clipboard/undo/reset; runtime/UI tests for freshness, bounds, toggle and failed saves; real Chromium measurement including resources, zoom and HTML/export isolation. Focused tests per task, final typecheck/lint/build and bounded-worker suite. Leave TASK-33 In Progress until explicit manual acceptance.
