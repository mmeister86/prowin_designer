---
id: TASK-37
title: M4 mit Creator- und Beraterinnen-Rechten abnehmen
status: In Progress
assignee: []
created_date: '2026-10-23T09:52:00Z'
updated_date: '2026-11-07T20:50:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-31
  - TASK-33
  - TASK-35
  - TASK-36
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vorlagenfähigkeit erfordert den vollständigen Pfad vom Creator-Template bis zur erlaubten Personalisierung und geteilten Datei.

Quellen: Umsetzung §§ 9, 10, 14 (M4)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Creator erstellt eine Vorlage mit Sperren und Constraints; Beraterin kann ausschließlich erlaubte Felder ändern.
- [ ] #2 Preset, Safe Zones, Speicherung, Exportmaße und Teilen funktionieren zusammen.
- [ ] #3 Direkte und Agent-Edits können keine Sperren umgehen; Typecheck und relevante Tests bestehen.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ergänze den echten M4-Workspace-Kettentest gemäß docs/superpowers/plans/2026-11-07-m4-acceptance.md.
2. Erstelle Abnahmematrix, führe Typecheck/Lint/Tests aus und dokumentiere offene Plattformabnahme.
3. Führe unabhängige Task-Reviews und abschließenden Council durch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
07.11.2026: Designumfang und detaillierter SDD-Plan ausdrücklich vom Nutzer freigegeben. Umsetzung im isolierten Worktree task-37-m4-acceptance gestartet. Frame.locked und bestehende Rechte bleiben unverändert; Done erst nach separater manueller Nutzerabnahme.
<!-- SECTION:NOTES:END -->
