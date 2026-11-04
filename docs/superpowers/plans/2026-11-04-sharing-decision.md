# Sharing Decision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement TASK-36 by choosing export/gallery and accurately naming coediting links.

**Architecture:** Copy-only product change in the existing ShareModal and shared Onboarding checklist. Preserve all access behavior and document Q11 consistently. One implementation task, since copy, decision and regression tests form one deliverable.

**Tech Stack:** Existing React/TypeScript, Vitest happy-dom; no new packages.

**Spec:** `docs/superpowers/specs/2026-11-04-sharing-decision-design.md`

## Global Constraints

- Keine Backend-, Datenbank-, REST-, WebSocket-, MCP- oder Rollenänderung.
- `linkAccess` bleibt ausschließlich `'edit' | 'none'`; Kopieren aktiviert nichts.
- Keine neuen Dependencies, Abstraktionen, Onboarding-Schritte oder Speicherfelder.
- Deutsche sichtbare Texte; vorhandene UI-Komponenten und Textstufen verwenden.
- Kein Ansichtsmodus behaupten; Galerie niemals als private Freigabe bewerben.
- TASK-36 bleibt bis zur ausdrücklichen Nutzerabnahme In Progress.
- Vorhandene Nutzeränderungen im Hauptcheckout nicht verändern.

## Review Focus

- Active link for a non-owner: warning remains visible without management controls.
- Inactive link in a workspace: copy must not deny existing workspace-member access.
- Publishing while edit link is enabled: gallery copy must not claim overall privacy.
- Copy success/failure: no implicit access mutation, retain clipboard error feedback.
- Desktop/mobile onboarding before connection: hint visible without changing progress or AI notice.
- Ownerless legacy canvases: warn that existing open access is independent of the link setting, never claim privacy.

---

### Task 1: Clarify sharing and document Q11

**Files:**

- Modify: `src/components/ShareModal.tsx`
- Modify: `src/components/Onboarding.tsx`
- Modify: `docs/prowin/doop-fork-umsetzung.md` (Q11 only)
- Modify: `docs/prowin/bezugsdokumente-referenz.md` (R5.2 sharing row only)
- Modify: `docs/prowin/rollen-berechtigungen.md` (Viewer/Canvas-Grenzen paragraph only)
- Create: `tests/sharingDecision.test.tsx`

**Interfaces:**

- Consume existing `ShareModal({ canvas, onChange, onClose, onCopied })` and `Onboarding({ canvasId })` unchanged.
- Preserve `api.setLinkAccess(id, 'edit' | 'none')` and clipboard URL `${location.origin}/c/${canvas.id}`.
- Produce no new interfaces, only accurate visible copy, documentation and tests.
- Read `tests/germanUiReview.test.tsx` for createRoot/act, API mocks, portal-aware dialog queries and cleanup patterns. Read `tests/prowinCreatorUi.test.tsx` if needed for capability mocks.

- [ ] **Step 1: Add focused failing tests.** In `tests/sharingDecision.test.tsx`, mock session/capabilities/workspaces and mobile hook with existing test conventions. Render actual components, no source-string tests. Assert:
  - Owner and non-owner with `linkAccess: 'edit'`: visible warning includes „kein reiner Ansichts-Link“, label says „Angemeldeten“, button „Bearbeitungslink kopieren“.
  - Owner with `none` and non-owner with omitted access: „Link kopieren“, no active-link warning; inactive status explains existing access, including workspace members when `workspaceId` is set.
  - Legacy canvas without owner for omitted, `none` and `edit` link settings: visible legacy open-access warning, no restrictive owner/invitation claim, no owner management checkbox.
  - Clipboard success copies the unchanged URL and calls `onCopied`, without calling `setLinkAccess`/`onChange`; failure preserves error feedback and does not claim success.
  - Checkbox still requests `edit`/`none`; rejection does not report a changed access setting.
  - Publish capability false hides gallery promotion; true plus published canvas and active edit link describes public browsing/copying without promising overall privacy.
  - Unconnected Onboarding on desktop and mobile contains the sharing hint; mobile remains `0/2` and has the two-step description. Existing dismissed+notice state remains hidden; dismissed without notice still shows AI notice, not checklist.

- [ ] **Step 2: Run tests red.** `bun run test tests/sharingDecision.test.tsx`; record actual missing-copy failures, not environment/import errors.

- [ ] **Step 3: Update the two components with minimal copy changes.** Use these texts verbatim, broken across JSX lines as appropriate:
  - Owner checkbox in both states and active non-owner status: „Alle Angemeldeten mit dem Link können bearbeiten“.
  - Active visible warning for both roles: „Angemeldete Personen mit diesem Link können Deine Arbeitsfläche mitbearbeiten. Dies ist kein reiner Ansichts-Link.“
  - Always-visible alternative: „Nur zeigen? Exportiere Dein Design als Datei oder nutze „Als Datei teilen“. Die Datei ist eine Momentaufnahme ohne Zugriff auf Deine Arbeitsfläche.“
  - Inactive link helper/status, separate from the owner's checkbox label: „Zugriff haben nur der Eigentümer, eingeladene Personen und Mitglieder des zugehörigen Arbeitsbereichs.“ Include workspace qualification only when there is one. Fix the owner checkbox tooltip consistently. Keep existing access behavior.
  - Ownerless legacy canvas status takes precedence in both link states: „Diese ältere Arbeitsfläche hat keinen Eigentümer und ist für alle zugänglich. Der Bearbeitungslink schränkt diesen Zugriff nicht ein.“ Existing `server/access.ts:28` stays unchanged.
  - Active copy label „Bearbeitungslink kopieren“; inactive „Link kopieren“.
  - Gallery description: „Alle angemeldeten Nutzerinnen können veröffentlichte Vorlagen ansehen und in ihr eigenes Konto kopieren. Die Veröffentlichung allein gewährt keinen Bearbeitungszugriff auf das Original.“ Update its tooltip consistently.
  - Onboarding, inside existing `showChecklist` fragment, before agent steps: „Teilen: Ein aktivierter Bearbeitungslink erlaubt angemeldeten Personen die Mitbearbeitung. Zum reinen Zeigen exportiere Dein Design als Datei.“ Use `obHint`; no progress changes.
  - Retain existing named text tokens or a plain paragraph matching neighboring copy; no new helper/component needed for these few static strings. Never advertise gallery outside the existing publish-capability block.

- [ ] **Step 4: Update decision docs.** Q11 status „entschieden (04.11.2026, TASK-36)“; recommendation explicitly chooses existing export/file-sharing for private snapshots and gallery for published templates, no private read-only link. R5.2 references this deliberate decision. Roles paragraph must say gallery browsing/copying requires login (confirmed in community.ts and index.ts session gate), publication does not grant editing, export is a snapshot, existing enabled link means coediting not template privileges. Do not format unrelated tables/sections wholesale.

- [ ] **Step 5: Verify green and quality.** Run focused new tests plus `tests/germanUiReview.test.tsx`, `tests/access.test.ts`, `tests/community.test.ts`, `tests/frameExportModal.test.tsx`, `tests/nativeFrameShare.test.ts`. Run `bun run typecheck`, `bun run lint`, targeted `bunx prettier --check` on changed source/test/new plan/spec files, `bun run doc-lint`. Run full `bun run test` once, capture output to this plan's workspace and report existing failures honestly; do not fix unrelated failures. Baseline focused set: 51 tests passed, known stderr localStorage warning and connection refusal localhost:3000 from existing component test.

- [ ] **Step 6: Self-review and commit.** Stage only the six implementation files above. `git commit -m "fix: Clarify coediting links for Q11"`. Write report with red/green commands/results, full-suite result, quality commands and limitations. Do not change Backlog status or commit controller-owned planning/backlog files; controller handles those. Do not push, create PR, merge, or spawn agents.
