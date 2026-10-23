---
id: TASK-26
title: Brand-Styles bei jedem Frame-Schreibpfad normalisieren
status: To Do
assignee: []
created_date: '2026-10-23T09:51:00Z'
labels:
  - prowin
  - implementation
milestone: m-3
dependencies:
  - TASK-23
  - TASK-25
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Frame-HTML ist die gemeinsame Wahrheit aller Renderer. Brand-Styles dürfen sich weder vervielfachen noch über alternative Schreibpfade fehlen.

Quellen: Umsetzung § 8.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Alle relevanten Schreib- und Commit-Pfade erzeugen genau einen style-Block data-od-brand mit Fonts und Tokens und entfernen externe Font-Links.
- [ ] #2 Wiederholtes Speichern verändert das Ergebnis nicht; bestehender Inhalt bleibt erhalten.
- [ ] #3 Eine wiederholbar sichere Migration aktualisiert vorhandene Frames; Tests decken neue und bestehende Frames sowie mehrere Schreibpfade ab.

<!-- AC:END -->
