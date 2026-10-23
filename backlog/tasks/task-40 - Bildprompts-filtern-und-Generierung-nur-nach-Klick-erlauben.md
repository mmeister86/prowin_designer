---
id: TASK-40
title: Bildprompts filtern und Generierung nur nach Klick erlauben
status: To Do
assignee: []
created_date: '2026-10-23T09:52:00Z'
labels:
  - prowin
  - implementation
milestone: m-5
dependencies:
  - TASK-39
  - TASK-29
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Magnific ist der teuerste Schritt und darf weder automatisch durch den Agent starten noch persönliche Kontaktdaten aus dem Canvas erhalten.

Quellen: Umsetzung § 11; Referenz R4.5–R4.6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Jede Generierung benötigt eine ausdrückliche Nutzeraktion; Agent- und MCP-Aufrufe können die Bestätigung nicht umgehen.
- [ ] #2 Der Adapter entfernt personenbezogene Inhalte einschließlich Namen, Telefonnummern und Adressen anhand Kontext/Rollen und Filter; Tests enthalten contact/date-Felder und Freitext.
- [ ] #3 Der Prompt enthält no text, no letters, no logos, no watermarks; MCP_GENERATIONS_PER_MIN und konfigurierte Kostenlimits greifen.

<!-- AC:END -->
