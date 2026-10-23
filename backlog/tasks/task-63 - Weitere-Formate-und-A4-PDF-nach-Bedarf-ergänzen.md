---
id: TASK-63
title: Weitere Formate und A4-PDF nach Bedarf ergänzen
status: To Do
assignee: []
created_date: '2026-10-23T09:56:00Z'
labels:
  - prowin
  - post-mvp
  - export
milestone: m-8
dependencies:
  - TASK-52
  - TASK-34
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: low
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der MVP startet mit fünf Kernformaten. Facebook-Cover, LinkedIn, Print-Erweiterungen und Instagram Portrait sowie PDF sind spätere Erweiterungen.

Quellen: Umsetzung § 10.4; Referenz R1.6, R2.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Gewünschte Reihenfolge für FB-Cover, LinkedIn, A4 quer, A5, Visitenkarte und IG Portrait ist anhand des Feedbacks entschieden.
- [ ] #2 Beschlossene Presets besitzen geprüfte Maße, Safe Zones und Export-Skalierung; widersprüchliche Druckangaben sind vor Übernahme geklärt.
- [ ] #3 A4-PDF über serverseitigen Export erhält Fonts und Maße ohne UI-Overlays; Ausgabegrößen sind geprüft.

<!-- AC:END -->
