---
id: TASK-14
title: Creator-Rolle und Berechtigungsmodell festlegen (Q4)
status: To Do
assignee: []
created_date: '2026-10-23T09:49:00Z'
labels:
  - prowin
  - decision
milestone: m-4
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Template-Sperren und Local-Agent-Zugriff benötigen eine belastbare serverseitige Rolle. Die Workspace-Rolle ist eine Empfehlung, noch keine beschlossene Lösung.

Quellen: Umsetzung §§ 7.3, 9.3, 17 (Q4); Referenz R1.2–R1.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Admin, Creator, Beraterin und Viewer sind auf bestehende oder neue Rollen abgebildet; Eigentumsgrenzen sind dokumentiert.
- [ ] #2 Rollenvergabe ist serverseitig autorisiert und testbar; Beraterinnen können sich nicht selbst zu Creator machen.
- [ ] #3 Die Testgruppe erhält Creator-Rechte; Veröffentlichung, Sperren und Local Agent sind nur für berechtigte Rollen verfügbar.

<!-- AC:END -->
