---
id: TASK-67.11
title: Normalisiere optionale Flags bei Transfer-Undo
status: In Progress
assignee: []
created_date: '2026-10-25T17:28:00Z'
labels: []
dependencies: []
parent_task_id: TASK-67
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explizit freigegebene Restkorrektur I4 aus final-fix-review.md: hidden/locked mit vorhandener Boolean-Semantik vergleichen, Versions- und andere Zustandsprüfungen unverändert erhalten. Regression: Transfer, eigener Flag-Toggle, Toggle-Undo, Transfer-Undo/Redo; keine neue breite Reviewwelle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Optionale hidden/locked-Werte undefined und false werden für Transfer-Zustandsvergleich gleich behandelt
- [ ] #2 Regression für beide Flags und bestehende Konflikt-/Undo-/Redo-Tests bestehen; Versionsschutz bleibt erhalten
- [ ] #3 Gezieltes unabhängiges Review sowie finale Tests und statische Prüfungen sind dokumentiert
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. I4 und alle Aufrufer des Vergleichs prüfen
2. Regression RED, minimalen Vergleich korrigieren, GREEN
3. Gezieltes Review und finale Verifikation, Übergabedokument aktualisieren
<!-- SECTION:PLAN:END -->
