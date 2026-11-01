# Template Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erfülle TASK-31 im bestehenden Editor: sichtbare Sperren, wirksame Eingabegrenzen und konsistente Agent-Regeln.

**Architecture:** Eine kleine DOM-basierte Client-Policy verbindet gespeichertes HTML und iframe-Runtime mit bestehenden Canvas-Capabilities. Bestehende Panels, Runtime-Nachrichten und Rollback-/Notice-Pfade werden erweitert; TASK-30 bleibt serverseitige Autorität.

**Tech Stack:** TypeScript, React 18, Zustand, bestehender iframe-Bootstrap, Vitest/happy-dom und vorhandene Browser-Test-Harnesses. Keine neuen Dependencies.

**Spec:** `docs/superpowers/specs/2026-11-01-template-editor-design.md`

## Global Constraints

- Rollen über die bestehende Canvas-Capability `manageLocks` bestimmen, nicht über Workspace-Adminstatus oder ein neues Creator-Flag. Bis zum Laden gilt die bestehende fail-closed Voreinstellung.
- `data-od-locked` sperrt für Nicht-Creator den gesamten Teilbaum. Präsenz zählt, auch bei leerem Attributwert. Creator dürfen Template-Sperren bearbeiten.
- Bestehende `data-doop-locked`- und Frame-Sperren behalten ihre bisherige Bedeutung; keine Migration oder Zusammenlegung der Sperrmodelle.
- In templatehaltigen Frames friert TASK-30 Inhalte außerhalb editierbarer Felder ein. UI und Agent dürfen diese nicht als frei bearbeitbar anbieten. Frames ohne Template-Felder behalten das bisherige Verhalten.
- Farblisten enthalten komma-getrennte Namen aus `BRAND_TOKENS` ohne `--`. Änderungen schreiben `var(--<token>)`, niemals Hex-/RGB-Ersatzwerte. Verschachtelte Feldgrenzen gelten gemeinsam, nicht nur das nächste Feld.
- Textlimits zählen wie der Server dekodierte Unicode-Codepoints des gesamten jeweiligen Felds, einschließlich Nachfahren. Auch Vorfahrenlimits beachten. Unveränderte überlange Bestandsinhalte bleiben resavable; keine stille Kürzung.
- Servervalidierung, Metadatenvertrag und Rollenmodell nicht abschwächen. Abgelehnte Saves zeigen verständliches deutsches Feedback und stellen den gespeicherten Zustand in Store und Live-Dokument wieder her.
- Keine neuen Dependencies, kein neues Formular, keine Arbeit an TASK-77/78, kein Push, PR oder Merge. TASK-31 bleibt bis Nutzerabnahme In Progress.
- Nicht markierte/eingefrorene Elemente dürfen zur Orientierung ausgewählt werden, bleiben für Nicht-Creator aber read-only. Das strikte Auswahlverbot gilt für Template-Sperren und deren Nachfahren.
- Agenten haben derzeit keine Capability-Abfrage: ohne ausdrücklichen Auftrag zur Vorlagenerstellung gelten die Nicht-Creator-Regeln. Bei explizitem Authoring-Auftrag dürfen sie Änderungen versuchen; nur die serverseitig geprüfte Identität autorisiert sie. Ein 403 beendet den Versuch ohne Umgehung.

## Review Focus

- Rollen-/HTML-Wechsel während einer aktiven Auswahl oder Texteingabe: Schutz greift ohne Neuladen (Task 1).
- Gesperrte Nachfahren in offenen Feldern und eingefrorene Vorfahren: keine indirekte Löschung/Umformatierung per Shortcut oder Panel (Task 1/2).
- Mehrere verschachtelte Farb-/Textgrenzen: Schnittmenge und gesamte Feldtexte inklusive Emoji statt nur direktes Textelement (Task 2).
- Einfügen/IME/Bestandsüberlänge und fehlgeschlagene Saves: keine stille Textkürzung und kein unsynchroner Live-DOM (Task 2).
- Explizites Creator-Authoring versus Beraterinnen-Agent: keine Selbstautorisierung, tatsächlicher MCP-Write behält Guard (Task 3).

## File Structure

- Neu `src/prowin/templatePolicy.ts`: DOM-Policy und HTML/Selector-Adapter für Client/Runtime; nur die tatsächlich benötigten Exporte, keine Server-Guard-Kopie.
- Bestehend `src/lib/layers.ts`, `layerEdits.ts`, `store.ts`, `frameRuntime.ts`, `frameBridge.ts`: Layerstatus, zentrale Edit-/Auswahlschranken, Capability-Transport und Eingabevalidierung.
- Bestehend `src/components/{FrameView,LayersPanel,ElementPanel}.tsx`: Hinweise, gesperrte Auswahl und rollenabhängige Controls; nur betroffene Callers in Geometry/Resize/Path falls nötig.
- Bestehend `server/guide.ts` und vorhandene gemeinsame Prompt-Einbindung: zentrale Template-Anleitung. Keine neuen Tools für Rollenerkennung.
- Neue fokussierte Tests für Policy, Runtime, UI und Guide; bestehende Template-/Layer-/Browser-/Transporttests erweitern.

### Task 1: Verbinde Template-Policy und Sperrhinweise

**Files:** Create `src/prowin/templatePolicy.ts`, `tests/templatePolicy.test.ts`, `tests/templateSelection.test.tsx`; modify `src/lib/{layers,layerEdits,store,frameRuntime,frameBridge}.ts`, `src/components/{FrameView,LayersPanel,ElementPanel}.tsx`; extend `tests/{layerLock,layersSelection,frameTemplateRuntime}.test.ts` and relevant existing UI tests.

**Interfaces:** Consume `canManageFrameLocks(canvasId): boolean`, `useCanvasCapabilities(canvasId)` and existing template attributes. Produce `templatePolicyOf(html: string, selector: string, manageLocks: boolean): TemplateElementPolicy | null` in `src/prowin/templatePolicy.ts`, where `TemplateElementPolicy` exposes `template: boolean`, `locked: boolean`, `readOnly: boolean`, `allowedColors: string[] | null`. `null` means stale selector; `allowedColors: null` means unrestricted, `[]` means no permitted token. Runtime DOM evaluation must use the same policy semantics without copying a second logic block. Preserve old public contracts wherever possible.

- [ ] **Step 1: Add failing behavioral tests.** Assert a locked field and nested span are blocked for Non-Creator, including empty lock value; Creator can pick/edit template locks; legacy lock behavior remains; unmarked areas in template frames are selectable/read-only; plain frames stay editable. Test actual store/layer commands and Layers mouse/keyboard activation, not only helper output. Assert policy color intersections for nested fields. Assert stale selection and active edit become blocked on HTML/capability change and show accessible German lock feedback.
- [ ] **Step 2: Run RED.** `bun run test -- tests/templatePolicy.test.ts tests/templateSelection.test.tsx tests/layerLock.test.ts tests/layersSelection.test.ts tests/frameTemplateRuntime.test.ts --maxWorkers=2`; confirm failures identify missing behavior.
- [ ] **Step 3: Implement smallest complete policy integration.** Centralize policy at existing selection/edit entry points, transmit trusted parent capability state into runtime on ready/change with fail-closed default, gate direct selectors/keyboard/context/drag actions, and add lock/status hints in all three surfaces. Do not treat locked nodes as ordinary editable siblings or permit frozen wrappers to be mutated. Preserve Creator editor and old layer/frame semantics. Disable readonly design/HTML controls; Task 2 adds constrained input controls. Existing callers may need focused test fixture updates.
- [ ] **Step 4: Verify GREEN.** Run the focused tests plus `bun run typecheck`, then full `bun run test -- --maxWorkers=2` once before commit. Record warnings/failures by name; no unrelated repairs.
- [ ] **Step 5: Self-review and commit.** Explicitly stage task files. Commit `feat: Show template locks in the editor`. Write report with RED/GREEN commands/results, changes, SHA and concerns. Do not mark Backlog Done.

### Task 2: Begrenze Farben und Text ohne Datenverlust

**Files:** Modify `src/prowin/templatePolicy.ts`, `src/components/ElementPanel.tsx`, `src/lib/{frameRuntime,frameBridge,layerEdits}.ts`, `src/components/FrameView.tsx`; create `tests/templateInputs.test.tsx`, `tests/templateInputRuntime.test.ts`; extend existing ElementPanel/browser and save tests.

**Interfaces:** Consume `TemplateElementPolicy` and `templatePolicyOf` from Task 1. Use existing `BRAND_TOKENS`, `requestFrame`, `errorMessage`, store `pushNotice`, and save/rollback paths. Keep exact metadata values and server counting semantics. Any new runtime helpers belong beside existing runtime/policy code; no new validation framework.

- [ ] **Step 1: Add failing tests.** Non-Creator field with `prowin-ci-blau,prowin-ci-orange` offers only those token choices and writes exact `var(--prowin-ci-blau)`. Nested allowlists intersect; empty intersection disables color changes; free hex/RGB/alpha/border/SVG controls cannot bypass policy. Creator retains original controls. For `max-length=3`, decoded `A😀B` fits and `A😀BC` does not; replacing a selection can fit. Count whole ancestor fields including siblings; cover paste and composition events, nested locked content, and unchanged legacy over-limit text. Simulate real save rejection to assert notice, Store rollback and Live-DOM rollback.
- [ ] **Step 2: Run RED.** `bun run test -- tests/templateInputs.test.tsx tests/templateInputRuntime.test.ts --maxWorkers=2`; verify expected behavior failures.
- [ ] **Step 3: Implement minimal controls and runtime guards.** Use existing UI components to expose permitted token colors without alpha escape routes; hide/disable root geometry or HTML changes the server forbids. Intercept inline changes with beforeinput plus input/composition fallback as needed: reject/restore invalid edit and explain, never trim legacy text. Guard applicable ancestor limits and frozen descendants. Mirror rejection rollback into runtime; retain existing save/discrete/history behavior.
- [ ] **Step 4: Verify GREEN.** Run Task 1 and Task 2 focused tests plus existing `tests/elementPanelBrowser.test.ts` and `tests/templateFieldSave.test.ts`; run Typecheck and full suite once before commit. Browser automation belongs to existing test harness, not preview tools.
- [ ] **Step 5: Self-review and commit.** Commit `feat: Constrain template text and colors`. Write report including RED/GREEN evidence and all known limitations. Do not mark Backlog Done.

### Task 3: Erkläre Template-Regeln für Agent und MCP

**Files:** Modify `server/guide.ts`, `docs/prowin/template-attribute.md`, `docs/prowin/doop-fork-umsetzung.md`; create `tests/templateGuide.test.ts`; extend `tests/templateTransports.test.ts` or existing guide/resident integration tests. Modify `server/mcp.ts` or `server/resident.ts` only when existing shared guide embedding does not propagate new rules.

**Interfaces:** Consume current `DOOP_GUIDE` and existing Resident/MCP guide wiring; `assertTemplateWrite` remains unchanged authority. No new capability/tool API. Test real Non-Creator/Creator permission scopes on existing transports.

- [ ] **Step 1: Add failing tests.** Verify all six `data-od-*` attributes, role policy, Unicode/ancestor length, token references, frozen outside-field structure, and 403/no-bypass guidance reach both MCP `get_guide` and resident prompt. Execute a real permitted agent/MCP edit and disallowed lock/limit edit; rejected edit leaves persisted frame unchanged. Verify explicit Creator authoring remains possible under real server permission, not actor labels.
- [ ] **Step 2: Run RED.** `bun run test -- tests/templateGuide.test.ts tests/templateTransports.test.ts --maxWorkers=2`; verify missing-guide tests fail for expected reason while existing guard tests remain green.
- [ ] **Step 3: Implement shared guidance and docs.** Write clear exact attribute contract, preserve stable IDs, never remove constraints or self-escalate role. Default to personalization restrictions unless explicit authoring instruction; server identity decides, 403 means stop/explain. Update TASK-31 documentation, not unrelated generic guide material.
- [ ] **Step 4: Verify GREEN and final checks.** Run focused guide/transport tests and full suite once, then `bun run typecheck`, `bun run lint`, `bun run build`, `bun run doc-lint`, changed-file formatting and `git diff --check`. Record exact results and warnings.
- [ ] **Step 5: Self-review and commit.** Commit `docs: Explain template rules to agents`. Write report. Controller then conducts broad Muse Wonder review, records AC evidence via Backlog CLI, and leaves TASK-31 In Progress for manual acceptance. No push/PR/merge.
