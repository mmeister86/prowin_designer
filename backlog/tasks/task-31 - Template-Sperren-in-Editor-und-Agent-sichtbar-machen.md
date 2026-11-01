---
id: TASK-31
title: Template-Sperren in Editor und Agent sichtbar machen
status: In Progress
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-11-01T20:26:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-30
  - TASK-24
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Beraterinnen sollen erlaubte Änderungen erkennen und verständliches Feedback erhalten, während Creator den vollständigen Editor behalten.

Quellen: Umsetzung § 9.2; Referenz R1.4, R4.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 FrameView, LayersPanel und ElementPanel zeigen Sperren; Nicht-Creator können gesperrte Elemente nicht auswählen oder bearbeiten.
- [ ] #2 Farbwahl beschränkt sich auf erlaubte Tokens und Textfelder respektieren max-length; Serverfehler werden verständlich angezeigt.
- [ ] #3 Agent- und MCP-Guide erklären Rollen und Attribute; ein Agent-Edit respektiert dieselben Constraints wie manuelle Edits.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verbinde Template-Policy, Auswahl und Sperrhinweise
2. Begrenze Tokenfarben und Inline-Texte; sichere Save-Feedback/Rollback
3. Erklaere Agent-/MCP-Regeln und verifiziere reale Edits
4. Pruefe jeden Schritt und gesamten Branch mit Muse Wonder
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nutzerfreigabe 01.11.2026: bestehenden Editor erweitern, isolierter Worktree; Muse Spark 1.3 implementiert, Muse Wonder reviewt. Designabstimmung vor Umsetzung. TASK-30/PR #7 vom Nutzer als abgeschlossen bestaetigt.

Blocker nach Worktree-Wechsel: T3 delegate_task ist nicht mehr im Tool-Katalog verfuegbar; direkter Aufruf meldet Unknown tool, erneute Discovery liefert keine T3-Tools. Gewuenschte Modelle waren vorher per orchestrator_capabilities bestaetigt (meta/muse-spark-1.3, meta/muse-wonder-1.0). Kein Ersatzmodell/CLI-Fallback verwendet. Designentwurf liegt unter docs/superpowers/specs/2026-11-01-template-editor-design.md; Builder-Review und Implementierung noch nicht gestartet.

Blocker aufgeloest durch ausdrueckliche Nutzerfreigabe fuer native OpenCode-Delegation mit denselben Modellen. Design zur Umsetzung freigegeben. Baseline: 192 Dateien / 1611 Tests PASS. Isolierter Worktree; keine Produktivcode-Aenderungen vor TDD. Builder-Check Muse Wonder: eingefrorene Nicht-Felder bleiben auswaehlbar/read-only; Agent-Authoring nur auf expliziten Auftrag, Serverrolle autorisiert.
<!-- SECTION:NOTES:END -->
