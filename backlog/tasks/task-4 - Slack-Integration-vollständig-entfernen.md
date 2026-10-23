---
id: TASK-4
title: Slack-Integration vollständig entfernen
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
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Slack wird im proWIN-Fork nicht benötigt. Die Entfernung darf gemeinsame Webhooks und Workspace-Funktionen nicht beschädigen.

Quellen: Umsetzung § 6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Slack-Servermodule, Registry-Eintrag, Settings und zugehörige Konfiguration sind entfernt.
- [x] #2 Gemeinsam verwendete Funktionen bleiben erreichbar; angepasste Tests und Typecheck bestehen.

<!-- AC:END -->

## Umsetzung

Migration 0035 entfernt Slack-Tabellen. Folgen: `docs/prowin/integration-removal.md`.
Verifiziert: Typecheck sowie 59 Tests für Kontolöschung, Migrationen, Webhooks und Workspaces bestanden.
