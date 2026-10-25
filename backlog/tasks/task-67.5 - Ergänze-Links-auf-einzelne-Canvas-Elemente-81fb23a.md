---
id: TASK-67.5
title: Ergänze Links auf einzelne Canvas-Elemente (81fb23a)
status: In Progress
assignee: []
created_date: '2026-10-25T12:22:00Z'
updated_date: '2026-10-25T13:28:00Z'
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
<!-- SECTION:NOTES:END -->
