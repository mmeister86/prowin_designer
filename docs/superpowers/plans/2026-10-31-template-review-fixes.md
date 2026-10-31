# Template Review Fixes Implementation Plan

**Goal:** Close the four reproduced TASK-30 review findings without widening product scope.

**Architecture:** Correct the existing shared parser-backed guard; preserve action/API interfaces and verify the real HTTP save path.

**Spec:** `docs/superpowers/specs/2026-10-31-template-constraints-design.md`, plus the user's approval of the four findings on 2026-10-31.

## Global Constraints

- Keep trusted baseline/role semantics and 400/403 behavior. No TASK-31 UI, new dependencies or general HTML sanitizer.
- Preserve unchanged legacy markup and safe typography. Namespaces must not collide in attribute comparisons.
- Permit only the editor's additive standard HTML doctype for a baseline without a doctype; retain rejection of existing-doctype removal/replacement and public/system-ID changes.
- Work only on `task/30-template-constraints`. No push/merge or Backlog Done without a separate request.

## Review Focus

- Existing script/style descendants and field roots cannot become a code-editing escape hatch.
- Duplicate CSS properties, including case variants and hidden priority, cannot disappear during validation.
- SVG href/xlink:href stay distinct; unequal valid attributes still resave and reorder correctly.
- Browser serialization of stored fragments succeeds without allowing real wrapper/doctype changes.
- Rejected HTTP updates/append commits leave frame snapshots and versions unchanged.

### Task 1: Close the four shared-guard review findings

**Files:** `server/prowin/templateGuard.ts`, `tests/templateGuard.test.ts`, `tests/templateWrites.test.ts`, template contract docs and verification report.

**Interfaces:** Existing `assertTemplateWrite(canvas, prevHtml, nextHtml): void`; no new public API.

- [x] Write pure-guard and HTTP regressions for the exact script/style, duplicate-important, SVG href collision and fragment-save reproductions; run them RED before production changes.
- [x] Freeze non-editable legacy elements in editable interiors, including mutation/replacement/removal; keep unchanged unsafe legacy subtrees resavable and prevent script/style field-root edits.
- [x] Reject duplicate property names in changed styles before Map insertion; keep unchanged legacy styles resavable.
- [x] Compare namespace/prefix/local-name attribute identities consistently; accept legitimate reordering and preserve canonical lock presence.
- [x] Accept the additive standard doctype for stored no-doctype documents without relaxing wrapper checks or existing doctypes; run focused tests GREEN.
- [ ] Self-review connected callers, run the full suite with `--maxWorkers=4`, typecheck/lint/build/format/diff checks, update docs and Backlog evidence, commit. Keep TASK-30 In Progress.
