---
id: TASK-16
title: Requesty EU als festen Server-Provider integrieren
status: To Do
assignee: []
created_date: '2026-10-23T09:50:00Z'
labels:
  - prowin
  - implementation
milestone: m-2
dependencies:
  - TASK-15
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der bestehende Chat-Completions-Transport soll den Agent-Loop über Requesty bedienen, ohne eine neue Provider-Abstraktion oder benutzerdefinierte Ziel-URLs einzuführen.

Quellen: Umsetzung §§ 7.1–7.3; Referenz R4.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Agent-Loop, Tool-Calls und Vision funktionieren über den geprüften EU-Endpunkt und die konfigurierte Policy.
- [ ] #2 REQUESTY_API_KEY, Agent-Modell und Operator-URL sind dokumentiert; fehlender Key deaktiviert den Server-Tier kontrolliert.
- [ ] #3 RESIDENT_TASK_LIMIT ist für den Test nutzbar und Requesty begrenzt das Budget; Fehler und Fallbacks sind getestet.

<!-- AC:END -->
