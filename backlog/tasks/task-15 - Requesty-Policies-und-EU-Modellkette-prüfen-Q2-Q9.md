---
id: TASK-15
title: 'Requesty-Policies und EU-Modellkette prüfen (Q2, Q9)'
status: To Do
assignee: []
created_date: '2026-10-23T09:50:00Z'
labels:
  - prowin
  - decision
  - ai
milestone: m-2
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Policy-Namen und Modellketten der Draft-Spec sind vor produktiver Nutzung gegen die aktuelle API zu prüfen. Der Agent braucht Tool-Calling und Vision.

Quellen: Umsetzung §§ 7.2, 17 (Q2, Q9); Referenz R4.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Policy-Syntax, EU-Routing und verfügbare Modelle sind anhand aktueller Dokumentation und eines Testaufrufs belegt.
- [ ] #2 Zehn Agent-Briefs messen Tool-Call-Fehler, Latenz und Kosten pro fertigem Design; zwanzig deutsche Textprompts vergleichen Qualität und Constraint-Treue.
- [ ] #3 Ausgewählte Policies und Fallbacks sowie Requesty-Budget und Kosten-Alerts sind dokumentiert; keine unbestätigten Modellnamen gelten als freigegeben.

<!-- AC:END -->
