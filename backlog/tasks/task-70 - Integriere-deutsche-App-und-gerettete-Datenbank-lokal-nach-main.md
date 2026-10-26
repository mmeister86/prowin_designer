---
id: TASK-70
title: Integriere deutsche App und gerettete Datenbank lokal nach main
status: In Progress
assignee: []
created_date: '2026-10-26T07:10:00Z'
updated_date: '2026-10-26T07:17:00Z'
labels: []
dependencies: []
priority: high
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vom Nutzer autorisierte lokale Integration der Übersetzung aus feat/german-app nach main. Gerettete ignorierte PGlite-Laufzeitdaten separat und nur nach Offline-Sicherung des Ziels übernehmen. Kein Push, keine Veröffentlichung, keine fremden Änderungen verwerfen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Vollsuite und relevante Projektprüfungen vor und nach der lokalen Integration erfolgreich
- [ ] #2 Freigegebene Übersetzung samt Tests und Dokumentation ist auf lokalem main committed
- [ ] #3 Gerettete Datenbank und benötigte Assets sind im Hauptcheckout verfügbar; bisheriger Zielstand ist gesichert und DB-/API-Neustart geprüft
- [ ] #4 Keine Laufzeitdaten oder Geheimnisse im Git-Commit; Ergebnis und verbleibende Prüfgrenzen dokumentiert
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ausgangsbranches, vorhandene Änderungen und laufende DB-Prozesse prüfen.
2. Vollsuite unter bewährtem Node24/Bun-PATH und unabhängige Merge-Prüfung; danach Typecheck/Lint/Build/Format.
3. Übersetzungsänderungen kontrolliert committen; abweichende ungetrackte Zieldokumente vor Merge separat sichern.
4. Lokal ohne Remote-Aktionen nach main integrieren und Prüfungen auf main wiederholen.
5. Gerettete DB offline inklusive Backup und Assets übernehmen; Zeilen-Hashes, Migrationen und API-Neustart prüfen.
6. Lokales Ergebnis dokumentieren; Worktree und Sicherungen erhalten, kein Done ohne ausdrückliche Bestätigung.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nutzerfreigabe: Übersetzung passt erstmal; ausdrücklich alles lokal nach main inkl. geretteter DB integrieren. main und feat/german-app stehen beide auf886cfbd; Hauptcheckout hat keine getrackten Änderungen, aber ungetrackte Backlog-/Plan-/Spec-Dateien. Keine App-/Vite-/tsx-Prozesse aktiv, Ports4300/4400 frei. Deshalb Offline-DB-Übernahme möglich. Task68/69 bleiben bis ausdrücklicher Done-Freigabe offen; Nutzerakzeptanz/Mergefreigabe wird vermerkt.

Vorintegration: Leia bestätigt bytegleichen Produkt-/Test-/Konfigurationsstand zum finalen unabhängigen Review (680 Produktdateien; 870/871 Manifestdateien geprüft, .env.example bewusst ausgelassen); keine neuen Critical/Important. Ziel- und Quell-DB offline gesichert nach main/data/integration-backups/2026-10-26-task70-Ou03W1; 1164 Original-Zieldateien und1160 gerettete Quelldateien mit SHA256 geprüft. Rettungsunterlagen und Assets separat mitkopiert. Aktueller Worktree-Datenstand nach manueller Nutzung:2Canvases/2Frames,39Tabellen,40Migrationen (nicht den älteren Rettungssnapshot4/5 wieder einspielen). DB-Eingangskopie im Hauptcheckout data/pg-task70-incoming erfolgreich geöffnet/gelesen/sauber geschlossen; vollständige Tabellen-Fingerprints als private Backupdatei gesichert. Originalziel noch unverändert.

Vor-Merge-Gates frisch bestanden: Vollsuite165Dateien/1309Tests,268.22s unter Node24.21.0/Bun-PATH und maxWorkers2, unveränderte Timeouts. Typecheck, vollständiges Lint, globaler Formatcheck, Web-/Claude-Erweiterungsbuild und git diff --check grün. Bekannte nichtfatale Happy-DOM-/Port3000-Ausgaben und bestehender Chunkgrößenhinweis bleiben sichtbar. Keine Runtime-/Credentialdateinamen unter872nichtignorierten Git-Dateinamen. Alle10ungetrackten alten Hauptcheckout-Records zusätzlich privat im Datenbackup gesichert. Danach bestehende Hauptcheckout-Records per eigenem Dokumentationscommit historisieren; bei reinen Add/Add-Dokumentkonflikten den nachweislich aktuelleren Feature-Stand verwenden, Task69 bleibt erhalten.
<!-- SECTION:NOTES:END -->
