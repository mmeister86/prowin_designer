---
id: TASK-30
title: Template-Constraints auf allen serverseitigen Schreibpfaden erzwingen
status: To Do
assignee: []
created_date: '2026-10-23T09:51:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-29
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

UI-Sperren und Agent-Prompts reichen nicht aus. Serverprüfungen müssen die ursprünglichen Regeln auch gegen manipulierte HTML- und Metadaten-Änderungen schützen.

Quellen: Umsetzung § 9.2; Referenz R1.3–R1.4
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Nicht-Creator können gesperrte Elemente nicht ändern oder löschen und Längen-/Token-Farbgrenzen nicht umgehen.
- [ ] #2 updateFrame und appendFrameHtml-Commit sowie weitere erreichbare Schreibpfade verwenden dieselbe rollenbasierte Prüfung.
- [ ] #3 Tests decken gültige Edits, entfernte Constraints, doppelte/geänderte IDs, direkte API/MCP-Edits und unberechtigte Rollen ab; abgelehnte Edits verändern den gespeicherten Frame nicht.

<!-- AC:END -->
