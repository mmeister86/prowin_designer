---
id: TASK-24
title: 'Brand-Regeln in Agent, MCP-Guide und Canvas-Memory einspeisen'
status: To Do
assignee: []
created_date: '2026-10-23T09:51:00Z'
labels:
  - prowin
  - implementation
milestone: m-3
dependencies:
  - TASK-23
  - TASK-16
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Alle generierenden Zugänge sollen dieselben Markenregeln erhalten. Canvas-Memory darf die globale Brand-Quelle nicht versehentlich ersetzen.

Quellen: Umsetzung § 8.2; Referenz R4.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Resident-Systemprompt und get_guide enthalten beim Start die globale Brand-Datei.
- [ ] #2 Neue Canvases erhalten ein sichtbares, editierbares GuidelineDoc prowin-brand; die globale Datei bleibt als Quelle erkennbar.
- [ ] #3 Tests prüfen die Einspeisung in beide Agent-Zugänge und die Anlage ohne doppelte Guidelines.

<!-- AC:END -->
