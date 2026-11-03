# TASK-33 — Safe zones implementation and verification

## Result

Implemented on `feat/task-33-safe-zones`; final code commit `f8dc25e`.
Backlog remains **In Progress** pending explicit manual acceptance. No push,
pull request, merge or changes to the original dirty checkout.

- Preset defaults, persisted Creator-only overrides, source-copy inheritance,
  null-reset undo/redo and geometry-save rejection recovery.
- Local toggle, parent-only red bands and orange semantic-element outlines,
  bounded validated iframe geometry, render identity and live-edit ACKs.
- Effective safe-zone sides, CSS-pixel units and source in MCP/Resident context;
  shared agent instructions include defaults before frame creation.
- A4 documentation corrected: 3 mm = 11.34 CSS px, rounded to 11; 35.43 px at
  300 dpi, not 85. Inner safety margin, not bleed or a print-ready guarantee.
- Actual HTML-download Blob bytes and real valid-preset PNG/JPG pixel tests
  verify no UI overlay reaches exported content.

## Final evidence

Verified by controller on the unchanged final code revision:

| Gate                                              | Result                                     |
| ------------------------------------------------- | ------------------------------------------ |
| `CHROME_NO_SANDBOX=1 bun run test --maxWorkers=2` | **229 files, 2024 tests passed**, 456.94 s |
| `bun run typecheck`                               | Passed                                     |
| `bun run lint`                                    | Passed                                     |
| `bun run build`                                   | Passed; >500 kB chunk warning remains      |
| `git diff --check`                                | Passed                                     |

Full-suite log: `/tmp/opencode/task-33-final-clean-tests.log`.
Node experimental localStorage warnings predate this change.
An earlier concurrent suite overlapped test/runtime edits, failed two source
pins and is mixed-revision evidence, superseded by the clean run above.

## Delegation and reviews

Implementation: **Muse Spark 1.3**. All code-review gates: **GPT-6.1 Terra**.
Per-task initial review plus scoped fix passes: Task 1 six passes, Task 2 six,
Task 3 three. Final whole-branch review and its single scoped fix re-review:
**two passes, 7/10 → 8/10**. All final findings addressed; final review's only
remaining condition was the clean full-suite rerun, now satisfied above.

Council was an approach consultation, not a scored code review:

| Delegate                      | Consultation round 1 |
| ----------------------------- | -------------------- |
| Claude Opus 5.5 / Claude Code | no score             |
| GPT-6.1 Sol / OpenCode        | no score             |
| Muse Wonder / OpenCode        | no score             |

The council agreed on frame metadata, iframe measurement and parent-only
overlays. Role exclusions and override-reset behavior differed; decisions below.

## Rulings I made

1. Warn all visible semantic roles without exemptions: literal acceptance
   criterion. Cost if wrong: intentional full-bleed decoration creates noise.
2. Clear overrides on actual preset changes and reject invalid explicit
   geometry rather than clamp. Cost if wrong: Creators must reset margins before
   shrinking some frames.
3. Do not add agent override-authoring parameters: context is the requirement.
   Cost if wrong: policy authoring needs Inspector or existing REST.
4. Start on the green focused baseline while the bounded full baseline runs.
   Cost if wrong: later baseline failures require separate attribution; the
   eventual baseline was green (1875 tests).
5. Include existing Inspector save-rejection recovery before adding controls:
   new override validation exposes this path. Cost if wrong: broader UI/history
   change and more review than a metadata-only implementation.
6. Keep user-required Muse Spark 1.3 and increase reasoning rather than switch
   models. Cost if wrong: additional correction passes; this occurred.
7. At Task 1's five-round fix cap, route two cancellation findings into Task 2's
   FrameView integration instead of opening another Task 1 round. Cost if wrong:
   integration could proceed with known gaps; both were fixed and reviewed
   before Task 2 acceptance and checked again in final review.

## Limits and scope

- Geometry is advisory; continuous animation positions are not tracked. Final
  transition/animation completion or cancellation triggers remeasurement.
- Hidden-tab tests override `document.hidden`; refused Layers rollback is
  covered through a unit chain, not a real-browser refusal flow.
- Real transition completion is browser-tested; cancellation uses a synthetic
  event and animation listener wiring is source-pinned.
- Initial SafeZoneSection tests were written after implementation. Correction
  tests record genuine RED/GREEN; no retrospective TDD claim is made.
- Export sizing (TASK-34), agent placement (TASK-80), physical printing and
  platform-specific manual acceptance remain outside this change.
- The five-round per-task review loops increased cost and scope substantially;
  final review was deliberately limited to one combined fix wave.

Detailed dispatch reports and review artifacts remain in this worktree's
gitignored `.superpowers/sdd/2026-11-03-safe-zones/` for traceability.
