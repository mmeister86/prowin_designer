---
id: TASK-36
title: Ansichts-Link gegenüber Mitbearbeitungs-Link entscheiden (Q11)
status: To Do
assignee: []
created_date: '2026-10-23T09:52:00Z'
labels:
  - prowin
  - decision
milestone: m-4
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

doops Link-Sharing erteilt Bearbeitungsrechte. Es darf gegenüber Nutzerinnen nicht als reine Ansicht dargestellt werden.

Quellen: Umsetzung § 17 (Q11); Referenz R1.2, R5.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Es ist entschieden und dokumentiert, ob zunächst nur Gallery/Dateiexport oder ein neuer Read-only-Link angeboten wird.
- [ ] #2 UI und Onboarding benennen bestehende Mitbearbeitungsrechte korrekt.
- [ ] #3 Falls Read-only gewählt wird, liegt ein abgegrenzter Umsetzungstask mit serverseitiger REST/WS/MCP-Rechteprüfung vor; bis dahin wird keine Read-only-Funktion behauptet.

<!-- AC:END -->
