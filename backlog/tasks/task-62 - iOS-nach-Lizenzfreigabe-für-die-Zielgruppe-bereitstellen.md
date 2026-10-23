---
id: TASK-62
title: iOS nach Lizenzfreigabe für die Zielgruppe bereitstellen
status: To Do
assignee: []
created_date: '2026-10-23T09:56:00Z'
labels:
  - prowin
  - post-mvp
  - ios
milestone: m-8
dependencies:
  - TASK-45
  - TASK-52
  - TASK-25
  - TASK-35
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Die App bleibt erhalten, ihre Verteilung ist aber von einer positiven Lizenzentscheidung abhängig. Eine dokumentierte Ablehnung aus Q3 ist keine Freigabe.

Quellen: Umsetzung §§ 13, 14 (M7), 17 (Q3, Q8)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Eine ausdrückliche rechtliche Freigabe für den gewählten Verteilungsweg liegt vor; andernfalls bleibt dieser Task blockiert.
- [ ] #2 Login, Server-URL, Brand-Fonts, Frame-Darstellung und natives Teilen sind auf iOS geprüft.
- [ ] #3 Ein signierter Build ist über den freigegebenen Weg zugänglich; bekannte Unterschiede zu Web/Desktop sind dokumentiert.

<!-- AC:END -->
