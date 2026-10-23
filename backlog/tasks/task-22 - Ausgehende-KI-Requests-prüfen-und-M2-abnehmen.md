---
id: TASK-22
title: Ausgehende KI-Requests prüfen und M2 abnehmen
status: To Do
assignee: []
created_date: '2026-10-23T09:50:00Z'
labels:
  - prowin
  - implementation
milestone: m-2
dependencies:
  - TASK-16
  - TASK-17
  - TASK-20
  - TASK-18
  - TASK-21
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Die Provider-Auswahl allein beweist keine EU-Routen. Der Agent-Lauf benötigt einen Test für tatsächlich angesprochene Hosts; Magnific erweitert ihn später.

Quellen: Umsetzung §§ 7.6, 14 (M2)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Ein repräsentativer Agent-Lauf mit Distiller protokolliert ausgehende Requests und scheitert bei unerlaubten Hosts.
- [ ] #2 Requesty verwendet router.eu.requesty.ai; Magnific ist nur im freigegebenen Bildpfad zulässig und Stripe erst bei späterer Aktivierung.
- [ ] #3 Direkte Modell- und PostHog-Aufrufe sind ausgeschlossen; Boot-Guard, Egress-Test und Agent-Smoke-Test bestehen.

<!-- AC:END -->
