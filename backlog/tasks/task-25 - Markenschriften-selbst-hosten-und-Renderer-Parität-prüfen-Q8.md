---
id: TASK-25
title: Markenschriften selbst hosten und Renderer-Parität prüfen (Q8)
status: To Do
assignee: []
created_date: '2026-10-23T09:51:00Z'
labels:
  - prowin
  - implementation
milestone: m-3
dependencies:
  - TASK-23
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Browser, Chromium-Export und iOS/Blitz müssen dieselben Fonts darstellen, ohne Google-Fonts-CDN oder andere externe Font-Requests.

Quellen: Umsetzung §§ 8.3, 17 (Q8); Referenz R1.8
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Freigegebene WOFF2-Fonts mit Latin/Latin-Ext werden versionsgesichert unter /fonts ausgeliefert und im Docker-Export verfügbar gemacht.
- [ ] #2 Browser und Chromium rendern dieselbe Referenz; Export wartet auf document.fonts.ready.
- [ ] #3 Blitz-URL-Laden ist geprüft und die notwendige URL- oder Bundle-Lösung dokumentiert und umgesetzt; externe Font-Requests bleiben aus.

<!-- AC:END -->
