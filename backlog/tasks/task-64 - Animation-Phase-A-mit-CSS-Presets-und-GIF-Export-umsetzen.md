---
id: TASK-64
title: Animation Phase A mit CSS-Presets und GIF-Export umsetzen
status: To Do
assignee: []
created_date: '2026-10-23T09:56:00Z'
labels:
  - prowin
  - post-mvp
  - animation
milestone: m-8
dependencies:
  - TASK-52
  - TASK-29
  - TASK-34
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: low
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Animationen bleiben Post-MVP. Zuerst kommen einfache Presets und GIF; Timeline und Video gehören nicht in Phase A.

Quellen: Umsetzung § 12.3; Referenz R3.1–R3.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Einblenden, Einfliegen, Zoom-In, Pulsieren und Schreibmaschine sind als CSS-Presets an stabilen Element-IDs nutzbar.
- [ ] #2 GIF wird serverseitig gerendert; Fonts sind vor Capture geladen und Dauer, Dateigröße sowie Elementzahl begrenzt.
- [ ] #3 Reduced Motion und Autoplay nur auf Klick werden respektiert; Duplikation und veränderte Feldgrößen sind getestet.

<!-- AC:END -->
