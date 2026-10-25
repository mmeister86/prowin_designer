---
id: TASK-67.9
title: Ergänze das Kopieren von Frames als PNG (06169b4)
status: In Progress
assignee: []
created_date: '2026-10-25T12:23:00Z'
updated_date: '2026-10-25T16:20:00Z'
labels: []
dependencies: []
parent_task_id: TASK-67
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teil 9 des Plans docs/superpowers/plans/2026-10-25-upstream-adoption.md. Eigenständige Upstream-Commits, Tests und unabhängiges Task-Review; keine Statusschließung ohne Benutzerbestätigung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Upstream-Commit(s) einzeln mit Herkunft übernommen und Fork-Verhalten bewahrt
- [x] #2 Tests und unabhängiges Spec-/Qualitätsreview dokumentiert
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Task 9 im SDD-Plan lesen
2. Regressionstest RED, Upstream-Commit einzeln portieren, GREEN
3. Task-Verifikation und unabhängiges Spec-/Qualitätsreview
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
06169b4→34d925b; Produktionspatch exakt upstream, manageLocks bewahrt. RED fehlender API-Export offengelegt, GREEN11/11, Typecheck0, volleWiederholung147Dateien/1139Tests0. Lando: Spec/Quality PASS für PNG. Dabei erneut ausgelöster branchenweiter Auswahlfehler durch Task67.8-Fixrunde3 a0eae1e mit permanentem Test behoben und unabhängig freigegeben. Status bis Benutzerbestätigung In Progress.
<!-- SECTION:NOTES:END -->
