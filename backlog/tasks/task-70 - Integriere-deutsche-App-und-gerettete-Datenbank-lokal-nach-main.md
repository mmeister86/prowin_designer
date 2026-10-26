---
id: TASK-70
title: Integriere deutsche App und gerettete Datenbank lokal nach main
status: Done
assignee: []
created_date: '2026-10-26T07:10:00Z'
updated_date: '2026-10-26T07:41:00Z'
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
- [x] #1 Vollsuite und relevante Projektprüfungen vor und nach der lokalen Integration erfolgreich
- [x] #2 Freigegebene Übersetzung samt Tests und Dokumentation ist auf lokalem main committed
- [x] #3 Gerettete Datenbank und benötigte Assets sind im Hauptcheckout verfügbar; bisheriger Zielstand ist gesichert und DB-/API-Neustart geprüft
- [x] #4 Keine Laufzeitdaten oder Geheimnisse im Git-Commit; Ergebnis und verbleibende Prüfgrenzen dokumentiert
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

Lokaler Code-Merge abgeschlossen: Featurecommit a1ab4cc, historisierter Hauptcheckout-Dokumentstand c2f6189, Mergecommit b08c265. Vorhersehbare reine Add/Add-Dokumentkonflikte zugunsten der neueren Feature-Dokumente aufgelöst; Vergleich feat/german-app..main zeigt ausschließlich den zusätzlich erhaltenen Task69-Record, keine Produkt-/Testabweichungen. Erster Merge-Commitversuch wurde nur vom Commitlint wegen nicht erlaubtem Typ merge abgelehnt; konventioneller chore(merge)-Commit anschließend erfolgreich, keine Hooks umgangen. Git-Arbeitsbaum zunächst sauber; kein Push/Fetch/Pull ausgeführt. Zweite vollständige Suite läuft auf main. DB-Wechsel noch ausstehend; Original weiterhin am Platz und zusätzlich offline gesichert.

Nach-Merge-Gates frisch bestanden auf mainb08c265:165Dateien/1309Tests in255.42s, danach Typecheck, vollständiges Lint, globaler Formatcheck, Web-/Claude-Erweiterungsbuild und git diff --check grün. Merge-Code identisch zum freigegebenen Featurecommit; Runtime/Credentialdateinamen im Commitbaum geprüft und ausgeschlossen. Spocks statischer Transfercheck benannte echte Härtungspunkte; Script vor Ausführung auf vollständige Inventare, versiegeltes Incoming, aktuelle Quellassets, offene eigene DB-FDs und Linux-atomaren renameat2-Verzeichnistausch umgestellt. Plattform-Selfcheck an Wegwerfverzeichnissen erfolgreich; Incoming erneut an39Tabellenfingerprints geprüft und1160Dateien versiegelt. Aktivierung noch nicht ausgeführt; Nachprüfung der Transferkorrektur läuft.

DB-Aktivierung erfolgreich: vollständige Inventare für Ziel, aktuelleQuelle, Incoming undAssets sowie Offlinezustand vor atomarem Linux-renameat2-Tausch geprüft. Erste Guardläufe stoppten ohne Datenmutation an nicht-dumpbaren System-/Loginmanagern; diese per PID/ps/cmdline als systemd--user,sd-pam,sshd-session verifiziert, deren App-Kinder und alle übrigen eigenen Prozesse/DB-FDs weiterhin geprüft. Danach Guard erkannte eine echte Quelländerung um08:25; alten Incoming-Stand und Manifeste gesichert statt Schutz zu umgehen, neue stabile Quellkopie mit1161Dateien erzeugt und versiegelt. Erst diese aktuellere Kopie aktiviert. Atomarer Tausch auf gleichem FS mit vorherigem Assert-Selfcheck erfolgreich, beschädigter altermainStand vollständig in retired-main-pg erhalten. Echte main-initDb inklusive40Migrationen grün; alle39Tabellen mit vollständigen Zeilen-Hashes identisch zur zuletzt geprüften Quelle,2Canvases/2Frames. Maincode-Smoke auf isolierter Kopie zweimalStart/Stop/Neustart, /healthz,/api/login-providers,/api/auth/get-session jeweils200; echte Nutzerdaten nicht durch Smoke verändert. Private Sicherungen: main/data/integration-backups/2026-10-26-task70-Ou03W1. Worktree/Featurebranch erhalten; Sitzung wieder im Hauptcheckout. Fremde während der Arbeit erschienene Änderung an TASK-23 bleibt unangetastet und wird nicht mitcommittet. Keine Remoteoperationen. Prüfprotokoll docs/prowin/deutsche-uebersetzung.md aktualisiert, finale Docs-/Git-Prüfung folgt.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Deutsche App lokal nach main integriert (Feature a1ab4cc, Merge b08c265, Integrationsnachweise 0c90397). Gerettete aktuelle Datenbank und Assets nach Offline-Sicherung atomar in den Hauptcheckout übernommen; 39 Tabellen per Zeilen-Hashes identisch, 40 Migrationen und API-Neustart geprüft. Jeweils 1309 Tests sowie Typecheck, Lint, Formatierung und Build vor/nach Merge bestanden. Kein Push oder Deployment. Sicherungen und Worktree erhalten; native/externe Prüfgrenzen und fehlende Prävention erneuter DB-Schäden dokumentiert. Nutzer hat den Abschluss von TASK-70 ausdrücklich freigegeben. Weitere Backlog-Aufgaben bleiben unverändert.
<!-- SECTION:FINAL_SUMMARY:END -->
