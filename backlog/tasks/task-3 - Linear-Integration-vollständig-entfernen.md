---
id: TASK-3
title: Linear-Integration vollständig entfernen
status: Done
assignee: []
created_date: '2026-10-23T09:49:00Z'
labels:
  - prowin
  - implementation
milestone: m-1
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Linear gehört nicht zum proWIN-Produkt und soll aus Registry, Server und Einstellungen verschwinden.

Quellen: Umsetzung § 6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 server/linear, Extension-Registrierung und zugehörige UI, Konfiguration und Dokumentation sind bereinigt.
- [x] #2 Verbliebene Aufrufer und Tests enthalten keine defekten Linear-Abhängigkeiten; Typecheck und relevante Tests bestehen.

<!-- AC:END -->

## Umsetzung

Migration 0034 entfernt Linear-Tabellen und alte Verbindungen. Folgen: `docs/prowin/integration-removal.md`.
Verifiziert: `bun run typecheck`; Account-Deletion-, Migrations-, MCP- und Workspace-Tests: 22 Tests bestanden.
