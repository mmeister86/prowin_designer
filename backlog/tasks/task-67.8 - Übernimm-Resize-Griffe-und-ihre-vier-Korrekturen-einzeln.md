---
id: TASK-67.8
title: Übernimm Resize-Griffe und ihre vier Korrekturen einzeln
status: In Progress
assignee: []
created_date: '2026-10-25T12:23:00Z'
updated_date: '2026-10-25T16:20:00Z'
labels: []
dependencies: []
parent_task_id: TASK-67
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teil 8 des Plans docs/superpowers/plans/2026-10-25-upstream-adoption.md. Eigenständige Upstream-Commits, Tests und unabhängiges Task-Review; keine Statusschließung ohne Benutzerbestätigung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Upstream-Commit(s) einzeln mit Herkunft übernommen und Fork-Verhalten bewahrt
- [x] #2 Tests und unabhängiges Spec-/Qualitätsreview dokumentiert
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Task 8 im SDD-Plan lesen
2. Regressionstest RED, Upstream-Commit einzeln portieren, GREEN
3. Task-Verifikation und unabhängiges Spec-/Qualitätsreview
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fünf Originalcommits einzeln: f897395→8912ce8, cb176aa→eefce65, 91e8bad→84f85fa, 0ab9cf0→0c6a54e, 0531b70→a1a9049. Jeweils RED/GREEN/Typecheck; Hover-Test ergänzt (RED3>3). Review-Aragorn: Funktionscode freigegeben, Browser-Synchronisierung als Important; Fix071955b nur Tests/Fixture (echte Runtime-Bereitschaft und Mutation-Polling bei gleicher Assertion/Timeout). Arwen-Nachreview beideBefunde ADDRESSED, keine neuenImportant. Fokus26/81Tests und volle4Worker147Dateien/1135Tests erfolgreich. Original-main full2 hatte1019pass; frühere Baseline-Flake-Vermutung korrigiert. Status bleibtInProgress.

Konkrete Wiederholung nach PNG-Port widerlegte die reine Polling-Diagnose. Fixrunde2 c89dc5a (Objektidentität) bestand Tests, aber Batman reproduzierte einen Klon-Bypass deterministisch; NICHT freigegeben. Fixrunde3 a0eae1e ersetzt das unzureichende Muster durch Auswahl-Epochen und behält deterministischen Regressionstest (späte Refreshantwort + Deselect, dann legitime Neuauswahl). Batman-Nachreview I1 ADDRESSED, Spec/Quality Approved, keine neuenImportant. Fokussiert82/26 und volle4Worker147Dateien/1140Tests erfolgreich. Früherer Diagnoseclaim React-Commit-Reihenfolge und108 kritischeWiederholungen im Bericht korrigiert.
<!-- SECTION:NOTES:END -->
