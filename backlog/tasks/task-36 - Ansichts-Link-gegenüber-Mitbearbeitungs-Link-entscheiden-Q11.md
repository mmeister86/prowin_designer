---
id: TASK-36
title: Ansichts-Link gegenüber Mitbearbeitungs-Link entscheiden (Q11)
status: In Progress
assignee: []
created_date: '2026-10-23T09:52:00Z'
updated_date: '2026-11-04T11:14:00Z'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Council-Entscheidung dokumentieren: Dateiexport zum privaten Zeigen, Galerie für veröffentlichte Vorlagen; kein Read-only-Link.
2. ShareModal und Onboarding mit DeepSeek V4.1 Flash 1017 präzisieren, fokussierte Regressionstests ergänzen.
3. Mit GPT-6.1 Terra prüfen, Tests und Qualitätssicherung ausführen; Nutzerabnahme abwarten.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Council (Claude Opus 5.5, GPT-6.1 Sol, Muse Wonder) empfiehlt einstimmig keinen neuen Read-only-Link. Implementierung isoliert im Worktree task-36-sharing-decision. Nutzer akzeptiert empfohlene Entscheidungen vorab. AC3: Bedingung Read-only gewählt trifft nicht zu; kein Enforcement-Folgetask erforderlich.
<!-- SECTION:NOTES:END -->
