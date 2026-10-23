---
id: TASK-37
title: M4 mit Creator- und Beraterinnen-Rechten abnehmen
status: To Do
assignee: []
created_date: '2026-10-23T09:52:00Z'
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
