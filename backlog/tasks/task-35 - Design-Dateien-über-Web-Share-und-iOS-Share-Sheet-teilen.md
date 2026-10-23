---
id: TASK-35
title: Design-Dateien über Web Share und iOS Share Sheet teilen
status: To Do
assignee: []
created_date: '2026-10-23T09:52:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-34
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Direktes Teilen ist ein Kernnutzen gegenüber dem bisherigen Arbeitsablauf. Fehlende Share-Unterstützung darf den Export nicht verhindern.

Quellen: Umsetzung § 10.4
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Unterstützte Browser teilen PNG/JPG als Dateien; andernfalls ist ein Download verfügbar.
- [ ] #2 Abbruch des Share-Dialogs wird nicht als erfolgreicher Share gewertet; Fehler sind verständlich.
- [ ] #3 iOS verwendet das native Share Sheet; Web/Desktop und iOS sind mit einer Exportdatei geprüft.

<!-- AC:END -->
