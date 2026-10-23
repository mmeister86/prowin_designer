---
id: TASK-34
title: PNG/JPG in Preset-Größe zuverlässig exportieren
status: To Do
assignee: []
created_date: '2026-10-23T09:51:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-32
  - TASK-25
  - TASK-33
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der Export soll die gewählte Zielgröße und Markenfonts reproduzieren. Bei A4 ergeben die gerundeten CSS-Maße mal 3,125 nicht exakt die genannten Druckpixel.

Quellen: Umsetzung §§ 10.1, 10.4; Referenz R1.6, R1.8
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 PNG/JPG der vier Social-Presets haben exakt die angegebenen Pixelmaße und keine Safe-Zone-Overlays.
- [ ] #2 A4 nutzt den vorgesehenen 300-dpi-Skalierungsansatz; Zielpixel und Rundungsregel sind ausdrücklich geklärt und automatisiert geprüft.
- [ ] #3 Export wartet auf Fonts und behandelt Ladefehler kontrolliert; bestehende freie Frames bleiben exportierbar.

<!-- AC:END -->
