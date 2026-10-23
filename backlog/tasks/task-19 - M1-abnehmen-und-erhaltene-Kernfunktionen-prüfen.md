---
id: TASK-19
title: M1 abnehmen und erhaltene Kernfunktionen prüfen
status: To Do
assignee: []
created_date: '2026-10-23T09:50:00Z'
labels:
  - prowin
  - implementation
milestone: m-1
dependencies:
  - TASK-3
  - TASK-4
  - TASK-5
  - TASK-6
  - TASK-7
  - TASK-8
  - TASK-9
  - TASK-10
  - TASK-11
  - TASK-12
  - TASK-13
  - TASK-18
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Einzelne Entfernungen können gemeinsame Funktionen treffen. M1 benötigt deshalb eine gemeinsame Abnahme über alle beschlossenen Bereinigungen.

Quellen: Umsetzung §§ 6, 14 (M1)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Keine entfernte Integration bleibt über UI, API, MCP oder Konfiguration aktiv; Ausnahmen aus den Vorschlägen sind begründet.
- [ ] #2 bun run typecheck und die Testsuite bestehen.
- [ ] #3 Local Agent, Web/Desktop/iOS, APNs, Webhooks, Workspaces, Gallery, Memory und MCP sind erhalten; optionale Pexels-Suche bleibt key-gesteuert.

<!-- AC:END -->
