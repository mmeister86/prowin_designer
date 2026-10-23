---
id: TASK-9
title: Webseiten-Import einschließlich Chromium-Fallback entfernen
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
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Ein fehlender Context.dev-Key deaktiviert den lokalen Import-Fallback nicht. Deshalb muss der komplette Importpfad entfallen.

Quellen: Umsetzung §§ 5.1, 6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Website-Import, importer, webpageImport und contextDev sind aus Server, UI und Tools entfernt.
- [x] #2 cssPrune wird nur entfernt, wenn keine verbleibenden Aufrufer existieren; Chromium-Export bleibt funktionsfähig.
- [x] #3 Typecheck und relevante Tests bestehen.

<!-- AC:END -->

## Umsetzung

Import, Discovery, Context.dev, Chromium-Capture und Website-Access samt exklusivem CSS-Pruning entfernt. Leere Importdialoge und Einstiege auf Home/Canvas entfernt. Uploads und Screenshot-/Export-Renderer bleiben erhalten; Task-Abbruch und Verifikationspflicht im Agent bleiben aktiv.
Verifiziert: Typecheck und 36 Tests (MCP, Home-Hero, Tool-Batches, Export, Gallery, Zugriff und Rate-Limits) bestanden.
