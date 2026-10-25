---
id: TASK-67.4
title: Übernimm die Design-Panel-Basis in vier Einzelcommits
status: In Progress
assignee: []
created_date: '2026-10-25T12:22:00Z'
updated_date: '2026-10-25T13:14:00Z'
labels: []
dependencies: []
parent_task_id: TASK-67
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teil 4 des Plans docs/superpowers/plans/2026-10-25-upstream-adoption.md. Eigenständige Upstream-Commits, Tests und unabhängiges Task-Review; keine Statusschließung ohne Benutzerbestätigung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Upstream-Commit(s) einzeln mit Herkunft übernommen und Fork-Verhalten bewahrt
- [x] #2 Tests und unabhängiges Spec-/Qualitätsreview dokumentiert
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Task 4 im SDD-Plan lesen
2. Regressionstest RED, Upstream-Commit einzeln portieren, GREEN
3. Task-Verifikation und unabhängiges Spec-/Qualitätsreview
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Vier Einzelcommits: 4e3e8b6→87241e6, 1a3373f→b4a0734, 8ef7396→3fabf52, d98df37→5851cc2. Jeweils RED/GREEN und Typecheck dokumentiert (2/21/31/51 fokussierte Tests); vollständige Suite 144 Dateien/1063 Tests, exit 0. Gandalf: Spec PASS, Qualität PASS. Rohlogs im SDD-Arbeitsbereich. Keine Fork-Produktionsanpassung nötig; Status bleibt In Progress.
<!-- SECTION:NOTES:END -->
