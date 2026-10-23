---
id: TASK-41
title: M5 inklusive Egress und Bildkosten abnehmen
status: To Do
assignee: []
created_date: '2026-10-23T09:52:00Z'
labels:
  - prowin
  - implementation
milestone: m-5
dependencies:
  - TASK-40
  - TASK-22
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Die Bildpipeline erweitert die überprüften Datenflüsse um Magnific und muss gemeinsam mit dem Agent abgesichert sein.

Quellen: Umsetzung §§ 7.6, 11, 14 (M5)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Ein bestätigter Bildlauf erzeugt ein nutzbares Asset; ohne Bestätigung gibt es keinen kostenpflichtigen Request.
- [ ] #2 Egress-Test umfasst die verifizierten Magnific-Hosts und blockiert frühere Bildprovider.
- [ ] #3 PII-Filter, Timeout, Rate Limit und Kostenkontrolle sind mit belegten Ergebnissen geprüft.

<!-- AC:END -->
