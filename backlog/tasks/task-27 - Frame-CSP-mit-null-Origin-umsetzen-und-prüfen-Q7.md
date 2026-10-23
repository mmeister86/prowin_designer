---
id: TASK-27
title: Frame-CSP mit null-Origin umsetzen und prüfen (Q7)
status: To Do
assignee: []
created_date: '2026-10-23T09:51:00Z'
labels:
  - prowin
  - implementation
milestone: m-3
dependencies:
  - TASK-25
  - TASK-26
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

srcDoc-Frames ohne allow-same-origin haben Origin null. Eine CSP nur mit self würde legitime Assets blockieren und muss mit dem Sandbox-Bootstrap abgestimmt werden.

Quellen: Umsetzung §§ 7.6, 17 (Q7)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Externe Fonts, Bilder und Skripte sind blockiert; Instanz-Assets, data und blob funktionieren im vorgesehenen Umfang.
- [ ] #2 Notwendiger Frame-Bootstrap, Element-Auswahl und Editor-Kommunikation funktionieren ohne Erweiterung auf beliebige externe Hosts.
- [ ] #3 Tests mit null-Origin und fremden Ressourcen sowie ein Browser-Smoke-Test belegen die Policy.

<!-- AC:END -->
