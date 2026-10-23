---
id: TASK-54
title: Hintergrundentfernung mit ormbg für Web/Desktop ergänzen
status: To Do
assignee: []
created_date: '2026-10-23T09:54:00Z'
labels:
  - prowin
  - implementation
  - post-mvp
milestone: m-8
dependencies:
  - TASK-52
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Creator sollen Bilder lokal freistellen können. ormbg ist beschlossen, iOS folgt später; die Alpha-Bereinigung verhindert den bekannten Grauschleier.

Quellen: Umsetzung § 12.1; Referenz R1.7, R1.10
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Bild-Tab bietet Hintergrund entfernen; Modelldateien sind selbst gehostet, gecacht und mit Fortschritt geladen.
- [ ] #2 Alpha-Werte bis 6 Prozent werden transparent, ab 80 Prozent deckend; Zwischenwerte werden geglättet und getestet.
- [ ] #3 Ergebnis nutzt Asset-Upload und ersetzt src; Fehler, knapper Speicher und erneute Aufrufe sind kontrolliert behandelt.
- [ ] #4 Modell- und Runtime-Lizenzen sind geprüft; reale Web/Desktop-Bilder zeigen keinen Grauschleier.

<!-- AC:END -->
