---
id: TASK-67.5
title: Ergänze Links auf einzelne Canvas-Elemente (81fb23a)
status: Done
assignee: []
created_date: '2026-10-25T12:22:00Z'
updated_date: '2026-10-27T10:59:00Z'
labels: []
dependencies: []
parent_task_id: TASK-67
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teil 5 des Plans docs/superpowers/plans/2026-10-25-upstream-adoption.md. Eigenständige Upstream-Commits, Tests und unabhängiges Task-Review; keine Statusschließung ohne Benutzerbestätigung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Upstream-Commit(s) einzeln mit Herkunft übernommen und Fork-Verhalten bewahrt
- [x] #2 Tests und unabhängiges Spec-/Qualitätsreview dokumentiert
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Task 5 im SDD-Plan lesen
2. Regressionstest RED, Upstream-Commit einzeln portieren, GREEN
3. Task-Verifikation und unabhängiges Spec-/Qualitätsreview
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
81fb23a→91b90d5; README-Ergänzung um bestehende Fork-Dokumentation platziert, Produktionspatch unverändert. RED: 8 Browserfälle ohne Feature; GREEN 15/15, Typecheck0, volle Suite145Dateien/1076Tests0. Sherlock: Spec PASS, Qualität PASS. Inerter PostHog-Testmock als kleiner finaler Reviewhinweis notiert. Wartet auf manuelle Bestätigung.

27.10.2026: Ausdrückliche Nutzerfreigabe zum Abschluss: "ok, task auf done bitte. ebenso task 21, sowie Task 66ff - 69 (nice)." Die Freigabe umfasst die zugehörigen Untertasks. Dokumentierte Prüfgrenzen bleiben bestehen; dieser Abschluss behauptet keine zusätzlichen Live- oder nativen Tests. Keine weiteren Produktänderungen für den Abschluss erforderlich.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implementierung, Regressionen und unabhängige Prüfung gemäß den vorhandenen Nachweisen von TASK-67.5 und TASK-67 abgeschlossen; in main enthalten. Untertask durch ausdrückliche Nutzerfreigabe für TASK-66 bis TASK-69 abgenommen. Dokumentierte Plattform- und manuelle Prüfgrenzen bleiben bestehen.
<!-- SECTION:FINAL_SUMMARY:END -->
