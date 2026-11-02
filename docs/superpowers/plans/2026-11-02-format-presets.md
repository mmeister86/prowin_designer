# Format Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement TASK-32 with five persistent presets, a separate creation dialog and server-enforced resize protection.

**Architecture:** Extend the existing Frame model and persistence, use the existing trusted canvas permission scope for all writes, and reuse current creation, copy and history infrastructure. A shared catalog supplies exact format metadata; no new dependency or parallel frame model.

**Tech Stack:** TypeScript, React, existing dialog components, Express/MCP/resident actions, Drizzle/PostgreSQL/PGlite, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-format-presets-design.md`

## Global Constraints

- Instagram Post (1080 × 1080), Instagram Story (1080 × 1920), WhatsApp Status (1080 × 1920), Facebook Post (1200 × 630) und A4 Hochformat (794 × 1123 CSS-px).
- Eine Option ohne Preset bewahrt die bisherige freie Zeichenfläche (640 × 480).
- Kein Backfill anhand von Maßen: Story und Status haben dieselbe Größe, sind aber verschiedene Formate.
- Nicht-Creator dürfen bestehende Preset-Frames weder skalieren noch durch Entfernen oder Wechseln des Presets den Schutz umgehen.
- Creator-Ausnahmen verwenden die bestehenden Canvas-Capabilities, nicht bloß einen Creator-Kontostatus.
- Creator dürfen die tatsächlichen Maße bewusst überschreiben; die Preset-ID bleibt dabei die Formatzuordnung.
- Kein Safe-Zone-Overlay oder neuer Agent-Safe-Zone-Kontext (TASK-33), keine Änderung der Exportauflösung (TASK-34), kein PDF-/Share-Flow und keine weiteren Formate.
- Keine neue Abhängigkeit und keine Änderung produktiver Benutzerrechte.
- TASK-32 bleibt bis zur ausdrücklichen manuellen Abnahme durch den Nutzer offen.

## Review Focus

- Unknown IDs and prototype keys such as `__proto__` must fail without state changes (Task 2).
- Old databases and legacy frames must migrate without inferred presets or lost dimensions (Task 1).
- Creator account status in a member workspace must not grant resize privileges; role revocation must apply to subsequent writes and live drag (Task 2).
- Copies of creator-customized preset frames must preserve their preset and actual size without accepting client-forged provenance (Tasks 2–3).
- Dialog cancellation, request failure, duplicate submission and Undo/Redo must not leave phantom frames or strip preset identity (Task 3).

---

### Task 1: Persist format metadata

**Files:**

- Create: `shared/prowin/formats.ts`, `server/db/migrations/0041_frame_presets.sql`, matching generated snapshot, `tests/formatPresets.test.ts`, `tests/formatPresetPersistence.test.ts`.
- Modify: `shared/types.ts`, `server/db/schema.ts`, `server/db/migrations/meta/_journal.json`, `server/db/persist.ts`, `server/store.ts`.
- Reference tests: `tests/duplicatePersistence.test.ts`, `tests/legacyPagesMigration.test.ts`, `tests/prowinMigration.test.ts`.

**Interfaces:**

- Produces `FORMAT_PRESETS`, `FormatPresetId = keyof typeof FORMAT_PRESETS`, `isFormatPresetId(value: unknown): value is FormatPresetId` in `shared/prowin/formats.ts`.
- Catalog keys: `ig-post`, `ig-story`, `wa-status`, `fb-post`, `a4`. Preserve labels, `safe` and `exportScale` verbatim from `docs/prowin/doop-fork-umsetzung.md` § 10.1.
- Produces optional `Frame.preset?: FormatPresetId`; store create accepts optional preset; store update accepts optional preset including explicit null for removal. Stored/public Frames omit absent presets rather than exposing null.
- The new DB column is nullable `preset text`; mirror through ordinary writes, canvas-copy writes, page-copy writes and load. Use the existing Drizzle generation workflow; inspect generated diff for unrelated changes.
- Task 2 owns boundary validation, canonical creation sizes and permissions, not Task 1.

- [x] **Step 1: Write failing catalog and persistence tests.** Assert the five exact IDs/dimensions, distinguish Story/Status, assert own-key ID validation. Use real PGlite/migration or harness restart to verify create/save/reload, page/canvas copies and a legacy row without preset with unchanged dimensions. Exercise preset removal to DB null and reload to undefined.
- [x] **Step 2: Run `bun run test tests/formatPresets.test.ts tests/formatPresetPersistence.test.ts` and record the expected failures before implementation.**
- [x] **Step 3: Implement the catalog, optional Frame/store field, nullable schema migration and all persistence mappings.** Reuse existing object-spread copy behavior; do not add a second serialization layer.
- [x] **Step 4: Run the new tests plus `bun run test tests/duplicatePersistence.test.ts tests/legacyPagesMigration.test.ts tests/prowinMigration.test.ts` and `bun run typecheck`.** All must pass; document exact counts.
- [x] **Step 5: Format changed files, self-review, and commit only this task's files with `feat: Persist frame format presets`.**

### Task 2: Protect preset writes on the server

**Files:**

- Modify: `server/actions.ts`, `server/index.ts`, `server/mcp.ts`, `server/resident.ts`, and existing resident tool definitions/summary serializers located by tracing `create_frame` and `update_frame`.
- Create: `tests/formatPresetPermissions.test.ts`, `tests/formatPresetTransports.test.ts`.
- Reference: `server/prowin/permissions.ts`, `server/prowin/templateGuard.ts`, `tests/frameCreateProvenance.test.ts`, `tests/templateTransports.test.ts`, `tests/templateWrites.test.ts`, `tests/frameVersions.test.ts`.

**Interfaces:**

- Consumes Task 1 catalog and optional `Frame.preset`.
- `actions.createFrame` accepts optional preset and existing `sourceFrameId`; validates IDs before any side effect and canonicalizes new preset-frame sizes from the catalog regardless of client dimensions.
- Validated source copies inherit the source preset and actual dimensions when the caller lacks destination canvas Creator capability. Verify source existence/access and reject mismatched supplied metadata/dimensions rather than using the source ID as an arbitrary exemption. Creator copies may deliberately choose a different format.
- `actions.updateFrame` accepts optional preset and explicit null removal. Applying a preset to a free frame uses canonical dimensions. Switching/removing an existing preset requires current `canvasCapabilities(canvas).manageLocks`; same-value/no-size-change patches remain allowed. Creator dimension-only edits retain preset ID.
- Shared server protection applies before store writes, history, streams, broadcasts or other mutation side effects, including `restoreFrameVersion`. Preserve existing template guards.
- REST whitelist and MCP/resident tool inputs expose validated preset values; update tools must not silently strip attempted removal/switch. Frame summaries preserve preset identity wherever the tools serialize Frame metadata.
- Live `frame:drag` must validate the frame belongs to the joined canvas, current session access and current Creator permission before relaying size changes of preset frames. Never trust actor names/client role flags. Allow position-only relay; never relay protected size changes.
- Use existing error conventions: invalid ID/input is 400; denied resize/preset change is 403. Do not broaden general authorization or unrelated legacy numeric validation.

- [x] **Step 1: Write failing tests for all five canonical creations and invalid/prototype IDs.** Assert rejection does not change frame count, timestamps, dimensions, history or stream state as applicable.
- [x] **Step 2: Write failing permissions/transport tests.** Cover non-Creator REST/MCP resize denial, width-only/height-only, preset null/removal/switch bypass, same-size update, move, legacy free resize, authorized Creator resize retaining preset, workspace-member Creator denial, and subsequent denial after role revocation. Include version restore and live drag size relay. Cover a customized source copied with verified provenance versus forged/inaccessible/mismatched sources.
- [x] **Step 3: Run `bun run test tests/formatPresetPermissions.test.ts tests/formatPresetTransports.test.ts` and record expected failures.**
- [x] **Step 4: Implement the smallest shared action-level protection and wire boundary schemas/serializers.** Reuse trusted permission scopes, existing error handlers and copy provenance. Extend live drag handling only as required to prevent preset resize bypass.
- [x] **Step 5: Run the new tests, `bun run test tests/frameCreateProvenance.test.ts tests/templateTransports.test.ts tests/templateWrites.test.ts tests/frameVersions.test.ts`, and `bun run typecheck`.** All must pass.
- [x] **Step 6: Format, self-review and commit only this task's files with `feat: Protect preset frame dimensions`.**

### Task 3: Add the preset dialog and preserve client flows

**Files:**

- Create: `src/components/FramePresetDialog.tsx`, `tests/framePresetDialog.test.tsx`.
- Modify: `src/pages/CanvasPage.tsx`, `src/lib/framePlacement.ts`, `src/lib/api.ts`, `src/components/Inspector.tsx`, `src/components/FrameView.tsx`, `src/lib/frameClipboard.ts`, `src/lib/history.ts`, and whole-frame transfer paths in `src/lib/drawingMove.ts` / `src/lib/drawing.ts` only where they copy entire frames.
- Test/extend: `tests/framePlacement.test.ts`, `tests/frameClipboard.test.ts`, relevant history/Inspector/CanvasPage tests discovered through their existing callers.
- Reference: existing `Modal`/dialog components and `useCanvasCapabilities` / template geometry UI patterns.

**Interfaces:**

- Consumes Task 1 catalog and Task 2 REST create/update field.
- Produces `FramePresetDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange(open: boolean): void; onCreate(preset?: FormatPresetId): Promise<void> })` using existing modal components. Owns selection, busy state and visible request failure; stays open on failure. Disable repeated submissions; no new dependency.
- `createCenteredFrame(canvasId: string, name: string, html: string, preset?: FormatPresetId): Promise<Frame>` uses catalog size for placement and request, retains legacy default with no preset, and records the returned frame for Undo.
- Existing manual add entry points open one dialog; on successful creation select the returned frame and close. Keep current mobile behavior and keyboard-accessible cancel/Escape.
- Inspector shows the preset label and disables W/H for non-Creators of preset frames. FrameView hides/disables resize gestures for the same condition, including mixed group resizing. Position-only moves remain allowed under existing locks.
- Clipboard snapshots, full-frame duplication (including Alt-drag), history snapshots/recreation and full-frame transfers carry preset identity and required source provenance. Do not assign a parent's preset to an extracted element promoted into a new frame.
- Existing free-frame paths continue working; tests/fixtures expecting immediate manual creation must be updated for explicit dialog confirmation.

- [x] **Step 1: Write failing dialog tests.** Assert all five labels/dimensions, free-frame choice, cancellation without create, selected preset argument, pending-submit guard and visible failure without closing. Test keyboard/Escape through the existing modal behavior.
- [x] **Step 2: Write failing placement, copy/history and resize-control tests.** Verify A4/Story creation centered around actual preset size, Story versus Status identity, clipboard/duplicate/Undo/Redo preservation and Creator-customized copy dimensions. Verify non-Creator preset resize controls/group gesture cannot mutate local size; Creator and legacy controls remain usable.
- [x] **Step 3: Run the focused new/extended test files and record expected failures.**
- [x] **Step 4: Implement the dialog wiring, creation helper, client serialization/copy/history propagation and resize UI guard.** Reuse existing components and permission hooks; no preset-management screen or export work.
- [x] **Step 5: Run all new/extended tests, `bun run typecheck`, `bun run lint`, `bun run build` and `bun run test`.** Record exact results and any baseline-only failures; do not conceal skips.
- [x] **Step 6: Format, self-review and commit only this task's files with `feat: Add frame preset selection dialog`.**

## Completion bookkeeping

- Verify all three TASK-32 acceptance criteria against concrete test evidence; update only via Backlog CLI.
- Record implementation, review and final verification results in `docs/superpowers/reports/2026-11-02-format-presets.md`.
- Keep the Backlog task In Progress pending user manual acceptance. Do not push, merge or publish without explicit authorization.
