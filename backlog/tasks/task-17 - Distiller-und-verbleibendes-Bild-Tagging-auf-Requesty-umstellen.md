---
id: TASK-17
title: Distiller und verbleibendes Bild-Tagging auf Requesty umstellen
status: To Do
assignee: []
created_date: '2026-10-23T09:50:00Z'
labels:
  - prowin
  - implementation
milestone: m-2
dependencies:
  - TASK-16
  - TASK-12
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der Distiller ruft Anthropic unabhängig vom Agent-Provider auf. Auch eine behaltene Hintergrundbibliothek darf keinen direkten Modellaufruf behalten.

Quellen: Umsetzung §§ 7.4–7.5
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Beide Distiller-Aufrufstellen nutzen Requesty mit der Text-Policy; Tool-Ergebnisse werden weiterhin korrekt ausgewertet.
- [ ] #2 Ohne Requesty-Key bleibt der Distiller kontrolliert deaktiviert; direkte Anthropic-Laufzeitaufrufe sind entfernt.
- [ ] #3 Verbliebenes Background-Tagging nutzt Requesty-Vision; passende Regressionstests bestehen.

<!-- AC:END -->
