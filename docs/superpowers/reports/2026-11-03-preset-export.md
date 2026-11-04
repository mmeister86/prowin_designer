# TASK-34: Preset export verification

## Outcome

Implemented on `feat/task-34-preset-export`, final **code HEAD `cca5e90`**. Documentation-only completion records follow that commit. No push, PR or merge. TASK-34 remains **In Progress** pending explicit manual acceptance; all three acceptance criteria have automated evidence.

Worktree: `/home/matthias/.local/share/opencode/worktree/9d3066/task-34-preset-export`.

## Shipped behavior

- PNG/JPG downloads and PNG clipboard use server-authoritative preset scale; explicit supported scale 1/2 overrides remain compatible. Download intent wins over thumbnail preview.
- Canonical Social sizes: Instagram Post **1080×1080**; Instagram Story and WhatsApp Status **1080×1920**; Facebook Post **1200×630**. Parent-side safe-zone overlays do not enter image bytes.
- A4 remains **794×1123 CSS px**, scaled by **300/96 = 3.125**, yielding **2481×3509 raster pixels**. Nominal physical A4 2480×3508 is documented separately. No resampling, DPI metadata or print-ready claim.
- Creator-resized preset frames retain actual layout rather than being cropped to canonical dimensions. Existing integer viewport rounding happens first, then density/raster rounding: `round(max(1, round(storedAxis)) × scale)`. Fractional 100.4×200.6 becomes A4 **313×628**, free-frame 2× **200×402**. MCP dimensions describe actual output.
- Preset downloads use strict font settlement with concurrent eight-second page/server font deadlines after the existing bounded content load. Missing/corrupt/stalled fonts return a controlled German error; unused unloaded faces are allowed. Strict caches cannot be satisfied by lenient previews or primed agent screenshots.
- Free legacy frames retain 2× default downloads and existing bounded font fallback. Ordinary previews, thumbnails, inspection, agent screenshots and copy-link view URLs retain their behavior.
- Single-flight exports share one render/budget slot; a late anonymous auth denial reuses an already-running image without creating its own unmetered render. Failed promises are evicted for retry.
- Inspector download/clipboard tooltips no longer incorrectly promise 2× output for every preset.

## Fresh controller verification

All commands ran in the worktree on unchanged final source **`cca5e90`**:

| Command                       | Verified result                                         |
| ----------------------------- | ------------------------------------------------------- |
| `bun run test --maxWorkers=2` | **235 files, 2086 tests passed**, no failures; 512.58 s |
| `bun run typecheck`           | Exit 0                                                  |
| `bun run lint`                | Official Oxlint + ESLint, exit 0                        |
| `bun run build`               | Exit 0; production bundle built                         |
| `bun run doc-lint`            | Exit 0; advisory timestamp-based stale-doc warning      |

Final test output: `/tmp/opencode/task-34-final-cca5e90-tests.log`.
Final build output: `/tmp/opencode/task-34-final-cca5e90-build.log`.

Known output warnings: Node experimental `localStorage` warning; Vite bundle chunk larger than 500 kB; doc-lint's timestamp-based suggestion to update `CLAUDE.md` / `.context/` because a test is newer. These were not changed or suppressed. The checks pass, but output is not warning-free.

## Acceptance evidence

1. **Social dimensions / no overlay:** `tests/presetExportReal.test.ts` decodes real PNG/JPG via production `getImage` dispatch with independent target sizes and solid-pixel checks. Existing `safeZoneExportReal` and new HTTP tests also run.
2. **A4 scale / rounding:** hardcoded real PNG/JPG assertions for 2481×3509, fractional Creator frames, and truthful MCP metadata in `presetExportPolicy`; clarified reference and implementation docs.
3. **Fonts / free frames:** `presetExportStrict`, `presetExportStrictReal`, `strictFontCleanup`, `presetExportHttp`, `frameExport` and existing `prowinFontsBrowser` cover strict/lenient cache separation, concurrent requests, retry, delayed/missing/corrupt/stalled/unused fonts, height/density media selection, direct context/timer cleanup, controlled HTTP/download/clipboard errors, and free-frame fallback.

## Council review — approach only

Rounds: **1 advisory round**. These are readiness scores, not code approval.

| Delegate              | Round 1 |
| --------------------- | ------- |
| Claude Opus 5.5       | 8/10    |
| GPT-6.1 Sol Ultrafast | 8/10    |
| Muse Wonder 1.0       | 8/10    |

All implementation agents used **Muse Spark 1.3**. All independent code reviewers used **GPT-6.1 Terra** as requested; no CodeRabbit review was substituted.

| Terra gate         | Score / result                                                  |
| ------------------ | --------------------------------------------------------------- |
| Task 1             | 8/10, approved; minor follow-ups incorporated in Task 2         |
| Task 2 initial     | 6/10, fixes required                                            |
| Task 2 fix round 1 | 8/10; four findings addressed, late-anonymous-429 case remained |
| Task 2 fix round 2 | 9/10; all addressed, no new fix breakage                        |
| Whole branch       | 7/10; fractional dimension mismatch and stale tooltips found    |
| Final scoped wave  | **9/10; both addressed, no new Critical/Important breakage**    |

The final score is a scoped correction review, not a fresh whole-branch 9/10 claim. All findings from the whole-branch review are resolved.

## Rulings I made

Chronological decisions under the user's advance authorization:

1. Use existing download intent and MCP download parity, not another URL mode. Cost if wrong: image and download URLs can have different dimensions; explicit download dimension fields expose that distinction.
2. After final Council input, require strict fonts only for preset downloads. Cost if wrong: free legacy images may still contain fallback fonts, as before. Strict presets inspect failed faces, including corrupt HTTP-200 font responses.
3. Preserve Creator-resized actual geometry rather than force canonical sizes. Cost if wrong: exact preset-size claims apply only to canonical frames; resized content is not cropped.
4. Use 3.125 density and rounded A4 raster dimensions without resampling. Cost if wrong: output differs by one pixel per axis from nominal physical-A4 convention.
5. Continue scoped work despite pre-existing non-green browser baselines. Cost if wrong: unrelated flaky tests may need separate triage. Final verification nevertheless passes without changing those suites.
6. Carry Task 1's minor test/interface follow-ups into adjacent Task 2 work. Cost if wrong: slightly wider Task 2 review scope; all follow-ups were implemented and reviewed.
7. After whole-branch evidence of valid fractional updates, align MCP metadata to existing viewport-first rounding rather than change renderer layout. Cost if wrong: subpixel frame sizes still round for rasterization, now explicitly documented; formerly inaccurate fractional image metadata becomes integer actual pixels.
8. Preserve the local branch/worktree rather than push or merge unasked. Cost if wrong: changes are not yet available on `main` or a remote branch; integration is a separate user-authorized action.

## Process limitations and preserved work

- Core policy/font/budget/metadata fixes have observed failing regression tests. Some real/HTTP/UI coverage was added after implementation and is **not** claimed as RED-driven. Agent GREEN summaries were independently corroborated by the controller's final full run.
- Pre-change full baseline: 224/229 files, 2012/2024 tests passed; reduced two-worker baseline: 227/229 files, 2000/2024 passed. Failures were in existing timeout/ElementPanel/SafeZone browser cases. They did not reproduce in the final run and are not claimed fixed.
- Original checkout Backlog edits for TASK-29/31/32/79 remain untouched. The isolated worktree intentionally does not carry those uncommitted edits.
- Native desktop/iOS save dialogs, production hosting and physical print quality remain **manually unverified**. No PDF/sharing/new-preset/font-hosting work was included.
- Branch and gitignored per-plan SDD artifacts are retained for handoff; no merge/cleanup was performed.
