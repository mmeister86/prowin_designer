---
id: TASK-37
title: M4 mit Creator- und Beraterinnen-Rechten abnehmen
status: In Progress
assignee: []
created_date: '2026-10-23T09:52:00Z'
updated_date: '2026-11-07T21:03:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-31
  - TASK-33
  - TASK-35
  - TASK-36
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vorlagenfähigkeit erfordert den vollständigen Pfad vom Creator-Template bis zur erlaubten Personalisierung und geteilten Datei.

Quellen: Umsetzung §§ 9, 10, 14 (M4)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Creator erstellt eine Vorlage mit Sperren und Constraints; Beraterin kann ausschließlich erlaubte Felder ändern.
- [ ] #2 Preset, Safe Zones, Speicherung, Exportmaße und Teilen funktionieren zusammen.
- [ ] #3 Direkte und Agent-Edits können keine Sperren umgehen; Typecheck und relevante Tests bestehen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Task-1-Kettentest aus 7f7d288 als gemeinsame Rollen-/Persistenz-/Exportevidenz nutzen.
2. AC-Matrix und offene Plattformcheckliste dokumentieren; beide vollständigen Testgruppen mit Chromium sowie Typecheck/Lint/Format/doc-lint frisch ausführen.
3. Nur vollständig belegte ACs abhaken; AC2 und Status bis manueller Nutzerabnahme offen halten.
4. Unabhängige Task-2-Review und finaler Council durch Controller (nicht Implementierungsagent).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
07.11.2026: Designumfang und detaillierter SDD-Plan ausdrücklich vom Nutzer freigegeben. Umsetzung im isolierten Worktree task-37-m4-acceptance gestartet. Frame.locked und bestehende Rechte bleiben unverändert; Done erst nach separater manueller Nutzerabnahme.

07.11.2026 Task 2: docs/prowin/m4-abnahme.md ordnet AC1–3 konkreten Tests und offener manueller Browser/Desktop/iOS-Abnahme zu. Basis 7f7d288. CHROME_PATH=/usr/bin/chromium: vollständige Gruppe ohne Extension einmal ausgeführt: 235 Dateien/2145 Tests bestanden, 4 Dateien/15 Tests fehlgeschlagen, 0 Skips (175.47s). Extension separat einmal: 1 Datei/4 Tests bestanden, 0 Skips. Typecheck und Lint bestanden. Betroffene Browser-Suites: elementResizeBrowser (11), drawingBrowser (1), elementPanelBrowser (2), safeZoneBrowser (1). Serieller Diagnoselauf aller vier: 112 Tests bestanden, 0 Skips (siehe Rohlog für exakte Dauer). Ursprünglicher Volltest bleibt fehlgeschlagen; Vite-Kontextverlust/Timing unter Parallelbetrieb wahrscheinlich, kein bewiesener Produktregressionsfix. Keine Produktionsänderung. AC1 belegt, AC2 wegen realem Teilen/manueller Abnahme offen, AC3 wegen fehlgeschlagenem Pflichtlauf offen. Bun 1.4.4 statt Pin 1.3.10 und bestehende localStorage ExperimentalWarning offengelegt. Datenschutz-Follow-up TASK-82 nach Deduplizierung erstellt (To Do). Rohlogs/Detailbericht im Planworkspace .superpowers/sdd/2026-11-07-m4-acceptance/task-2-*. Unabhängige Review/finaler Council durch Controller ausstehend; Status bleibt In Progress.
<!-- SECTION:NOTES:END -->
