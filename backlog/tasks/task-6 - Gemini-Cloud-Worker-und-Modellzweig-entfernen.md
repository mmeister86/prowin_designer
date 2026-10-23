---
id: TASK-6
title: Gemini-Cloud-Worker und Modellzweig entfernen
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
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Cloud-Worker und ihr eigener Modellpfad werden durch den festen Requesty-Serverpfad überflüssig.

Quellen: Umsetzung § 6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Gemini-Cloud-Runs, Worker, MCP-Modul, shared/geminiCloud und workers/gemini samt Aufrufern sind entfernt.
- [x] #2 pickModel, Konfiguration und UI bieten keinen Gemini-Cloud-Pfad mehr an; Local Agent bleibt nutzbar.
- [x] #3 Typecheck und relevante Tests bestehen.

<!-- AC:END -->

## Umsetzung

Cloud-Routing, Worker, Env und Allowance-/Settings-Anzeigen entfernt. Local-Harness und dessen MCP bleiben erhalten.
Verifiziert: Typecheck und 17 Tests zu Local-Agent-Routing, Auswahl, Runs, MCP und Server-Routing bestanden.
