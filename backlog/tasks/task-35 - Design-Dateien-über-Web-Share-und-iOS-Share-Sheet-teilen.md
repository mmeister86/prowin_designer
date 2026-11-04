---
id: TASK-35
title: Design-Dateien über Web Share und iOS Share Sheet teilen
status: In Progress
assignee: []
created_date: '2026-10-23T09:52:00Z'
updated_date: '2026-11-04T07:20:00Z'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Council-Design und Plan festhalten
2. Web-Dateifreigabe mit Muse Spark 1.3 implementieren und Terra prüfen lassen
3. Native iOS-Dateifreigabe und Dokumentation mit Muse implementieren und Terra prüfen lassen
4. Gesamtreview und Tests; manuelle iOS-Abnahme offenlassen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Council: Claude Opus 5.5, GPT-6.1 Sol und Muse Wonder (high) beraten. Empfehlung: Export vorbereiten, zweiter Klick zum Teilen, keine Erfolgsmeldung bei Abbruch/Share-Auflösung, Download bleibt verfügbar. Isolierter Branch feat/task-35-file-sharing. Design/Plan: docs/superpowers/{specs/2026-11-04-file-sharing-design.md,plans/2026-11-04-file-sharing.md}. Keine automatische Done-Markierung. Linux ohne Swift/Xcode; native Ausführung/AC3 bleibt ohne zusätzliche Evidenz offen. Baseline voller Testlauf nach 120s abgebrochen; zwei UI-Timeouts im fokussierten Wiederholungslauf bestanden (50/50). Session-Verzeichnis bleibt wegen T3-Tool-Verfügbarkeit im Hauptcheckout; sämtliche Implementation arbeitet ausschließlich im isolierten Worktree.
<!-- SECTION:NOTES:END -->
