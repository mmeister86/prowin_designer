---
id: TASK-10
title: Website-Publishing und Website-Viewer entfernen
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
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Website-Publishing ist nicht Teil des Design-Produkts. Canvas-Sharing und Community-Gallery sind davon getrennte, weiterhin benötigte Funktionen.

Quellen: Umsetzung § 6; Referenz R5.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 website, websiteAccess und view_website samt UI und Aufrufern sind entfernt.
- [x] #2 Canvas-Sharing, Export und Gallery bleiben funktionsfähig; Typecheck und relevante Tests bestehen.

<!-- AC:END -->

## Umsetzung

Viewer und `view_website` entfernt. Gemeinsames `websiteAccess` bleibt bis zum unmittelbar folgenden TASK-9 für den Import erforderlich.
TASK-9 hat nun auch `websiteAccess` und dessen letzte Aufrufer entfernt; damit ist die Entfernung vollständig. Gallery-Publishing bleibt der separate Community-Pfad.
Verifiziert: Typecheck und 32 Tests (MCP, Zugriff, Gallery, Export und Exportdialog) bestanden.
