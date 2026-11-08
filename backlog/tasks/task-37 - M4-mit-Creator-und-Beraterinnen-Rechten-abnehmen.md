---
id: TASK-37
title: M4 mit Creator- und Beraterinnen-Rechten abnehmen
status: Done
assignee: []
created_date: '2026-10-23T09:52:00Z'
updated_date: '2026-11-08T20:27:00Z'
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
- [x] #3 Direkte und Agent-Edits können keine Sperren umgehen; Typecheck und relevante Tests bestehen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Nutze den echten M4-Kettentest und die Abnahmematrix als automatisierte Evidenz für AC1/AC3.
2. Halte AC2 und die manuelle Browser-/Desktop-/iOS-Share-Abnahme ausdrücklich offen.
3. Schließe TASK-37 auf ausdrücklichen Nutzerwunsch vom 08.11.2026 administrativ ab.
4. Öffne einen PR gegen main und begleite Checks/Reviews ohne automatischen Merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
07.11.2026: Designumfang und detaillierter SDD-Plan ausdrücklich vom Nutzer freigegeben. Umsetzung im isolierten Worktree task-37-m4-acceptance gestartet. Frame.locked und bestehende Rechte bleiben unverändert; Done erst nach separater manueller Nutzerabnahme.

07.11.2026 Task 2: docs/prowin/m4-abnahme.md ordnet AC1–3 konkreten Tests und offener manueller Browser/Desktop/iOS-Abnahme zu. Basis 7f7d288. CHROME_PATH=/usr/bin/chromium: vollständige Gruppe ohne Extension einmal ausgeführt: 235 Dateien/2145 Tests bestanden, 4 Dateien/15 Tests fehlgeschlagen, 0 Skips (175.47s). Extension separat einmal: 1 Datei/4 Tests bestanden, 0 Skips. Typecheck und Lint bestanden. Betroffene Browser-Suites: elementResizeBrowser (11), drawingBrowser (1), elementPanelBrowser (2), safeZoneBrowser (1). Serieller Diagnoselauf aller vier: 112 Tests bestanden, 0 Skips (siehe Rohlog für exakte Dauer). Ursprünglicher Volltest bleibt fehlgeschlagen; Vite-Kontextverlust/Timing unter Parallelbetrieb wahrscheinlich, kein bewiesener Produktregressionsfix. Keine Produktionsänderung. AC1 belegt, AC2 wegen realem Teilen/manueller Abnahme offen, AC3 wegen fehlgeschlagenem Pflichtlauf offen. Bun 1.4.4 statt Pin 1.3.10 und bestehende localStorage ExperimentalWarning offengelegt. Datenschutz-Follow-up TASK-82 nach Deduplizierung erstellt (To Do). Rohlogs/Detailbericht im Planworkspace .superpowers/sdd/2026-11-07-m4-acceptance/task-2-*. Unabhängige Review/finaler Council durch Controller ausstehend; Status bleibt In Progress.

07.11.2026 Controller-Nachprüfung auf 487e27b: Beide Pflichtgruppen vollständig ohne parallele Dateiänderungen wiederholt. Hauptgruppe: 239 Dateien / 2160 Tests bestanden, 0 Fehler, 0 Skips (165.04s); Extension separat: 1 Datei / 4 Tests bestanden, 0 Skips (9.67s). CHROME_PATH=/usr/bin/chromium; gleiche vorgeschriebene Argumente wie im ersten Lauf. Rohlogs /tmp/opencode/task37-frozen-suite.log und /tmp/opencode/task37-frozen-extension.log. Der ursprüngliche Fehlschlag bleibt dokumentiert; Reload-/Timing-Ursache nicht bewiesen, keine Produkt-/Runneränderungen. AC3 durch frischen grünen Gesamtlauf belegt. AC2/manuelles Teilen und ausdrückliche Nutzerabnahme bleiben offen; Status In Progress.

07.11.2026 Council-Runde 2: Claude Opus 5.5 8,5/10, GPT-6.1 Sol 9/10, Muse Wonder 9/10; alle integrationsbereit, keine kritischen oder wichtigen Befunde. Kleinere Korrekturen gebündelt: tatsächliches PNG/JPEG-Byteformat via sharp prüfen, allgemeine Guard-Evidenz verlinken, lokale/nicht archivierte Rohlogs und Rechtewortlaut präzisieren, Reviewstand aktualisieren. Browser-Stabilitätsbeobachtung zur bestehenden TASK-73 (To Do) ergänzt, kein neuer Fixture-Fix. Nach Testhärtung erneut beide Pflichtgruppen vollständig: 2160 + 4 bestanden, 0 Fehler, 0 Skips (164.53s / 9.70s); Typecheck und Lint grün. Logs /tmp/opencode/task37-final-suite.log und task37-final-extension.log. Begrenzte Council-Nachprüfung folgt. AC2 und manuelle Nutzerabnahme weiterhin offen, keine Produktänderung, kein Push/PR/Merge.

07.11.2026 Abschluss der begrenzten Council-Nachprüfung auf 32b48b2: Claude Opus 5.5, GPT-6.1 Sol und Muse Wonder bewerten den freigegebenen Implementierungsumfang jeweils mit 9/10. Alle sieben Korrekturpunkte adressiert, keine neuen kritischen oder wichtigen Befunde. Beide unabhängigen Task-Reviews ebenfalls freigegeben. AC1/AC3 automatisch belegt; AC2/manuelles Browser-, Desktop- und iOS-Teilen sowie ausdrückliche Nutzerabnahme bleiben offen, Status In Progress. Produkt-/Rechteverhalten unverändert. Lokale Rohlogs/Agent-Berichte sind nicht dauerhaft archiviert; temporäre Evidenzkopie /tmp/opencode/task37-evidence/. Keine Pushes, PRs oder Merges vorgenommen.

08.11.2026: Nutzeranweisung: „setze den task auf done, mit AC2 explizit noch offen. PR auf main öffnen mit babysit-pr“. Status deshalb ausdrücklich Done trotz offener AC2; AC2 NICHT abhaken. Die Plattformcheckliste bleibt unausgeführt und die M4-Milestone-Abnahme bleibt offen. Der administrative Taskabschluss darf nicht als erfolgreiche manuelle Share-Abnahme interpretiert werden.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ergänze den echten M4-Kettentest und die Abnahmematrix; belege AC1 und AC3 automatisiert. Schließe TASK-37 auf ausdrücklichen Nutzerwunsch vom 08.11.2026 administrativ ab. AC2 bleibt ausdrücklich offen und ungeprüft; keine manuelle Browser-/Desktop-/iOS-Share-Abnahme und keine vollständige M4-Milestone-Freigabe.
<!-- SECTION:FINAL_SUMMARY:END -->
