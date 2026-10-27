---
id: TASK-67.9
title: Ergänze das Kopieren von Frames als PNG (06169b4)
status: Done
assignee: []
created_date: '2026-10-25T12:23:00Z'
updated_date: '2026-10-27T10:59:00Z'
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

27.10.2026: Ausdrückliche Nutzerfreigabe zum Abschluss: "ok, task auf done bitte. ebenso task 21, sowie Task 66ff - 69 (nice)." Die Freigabe umfasst die zugehörigen Untertasks. Dokumentierte Prüfgrenzen bleiben bestehen; dieser Abschluss behauptet keine zusätzlichen Live- oder nativen Tests. Keine weiteren Produktänderungen für den Abschluss erforderlich.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implementierung, Regressionen und unabhängige Prüfung gemäß den vorhandenen Nachweisen von TASK-67.9 und TASK-67 abgeschlossen; in main enthalten. Untertask durch ausdrückliche Nutzerfreigabe für TASK-66 bis TASK-69 abgenommen. Dokumentierte Plattform- und manuelle Prüfgrenzen bleiben bestehen.
<!-- SECTION:FINAL_SUMMARY:END -->
