---
id: TASK-69
title: Untersuche den PGlite-Absturz beim Entwicklungsstart
status: In Progress
assignee: []
created_date: '2026-10-25T19:50:00Z'
updated_date: '2026-10-26T07:35:00Z'
labels: []
dependencies: []
priority: high
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nur Diagnose: Ursache des PGlite-WASM-Abbruchs beim bun-dev-Start eingrenzen und nachfolgende Vite-Proxyfehler erklären. Originaldatenbank und Anwendungscode nicht verändern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PGlite isoliert mit frischer Datenbank und einer Kopie der vorhandenen Daten prüfen
- [x] #2 Belegte Ursache und sichere nächste Schritte dokumentieren
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Status der ursprünglichen DB und sichere Kopie prüfen.
2. Dokumentierte Recovery-/Backup-Wege recherchieren und nur an Kopie testen.
3. Funktionierenden Start mit Migrationen verifizieren; riskante Originaleingriffe nur nach ausdrücklicher Freigabe.
4. Ergebnis und Grenzen dokumentieren; Task erst nach Nutzerbestätigung schließen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnosebelege: Node v26.12.1, installierte PGlite 0.5.8 / PostgreSQL 18.3; data/pg/PG_VERSION = 18. Frische In-Memory-Datenbank und CREATE SCHEMA IF NOT EXISTS drizzle funktionieren. Vorhandene DB nach /tmp/opencode/pglite-diagnosis-7Pevxz/pg kopiert; nur Kopie gestartet, mit debug:1. startup.log meldet database system was interrupted (last known up 2026-10-25 11:22:16 +01), invalid xl_info in checkpoint record, PANIC could not locate a valid checkpoint record at 0/1B0DF98, danach exakt denselben WASM-Abort. Fehlerschicht damit DB-Wiederanlauf/WAL-Checkpoint; Auslöser der Inkonsistenz nicht belegt. Originaldatenbank und Anwendungscode unverändert. Keine Reparatur/kein Reset beauftragt.

Zusätzlicher Gegencheck: neue persistente DB unter /tmp/opencode/pglite-fresh-AAJQhf/pg erstellt, Schema drizzle angelegt, sauber geschlossen und erneut geöffnet; SELECT 1 und Schemaabfrage erfolgreich. Spock bestätigt: initDb (server/index.ts:80) läuft vor listen (:1577), tsx startet über Node, CREATE SCHEMA ist Drizzles erste DB-Anweisung; kein jüngster PGlite-Upgrade im Lockfile belegt. Sichere nächste Schritte: Original zuerst dauerhaft sichern; bevorzugt funktionsfähiges Backup wiederherstellen; andernfalls Recovery ausschließlich an weiterer Kopie untersuchen. Neuinitialisierung nur bei ausdrücklich entbehrlichen Daten und nach Freigabe. Nicht belegt, weshalb Checkpoint ungültig wurde; unsauberes Ende/WAL- oder Dateninkonsistenz möglich. Keine Codeänderungen und keine Reparatur durchgeführt. Task bleibt bis expliziter Nutzerbestätigung In Progress.

Nutzer hat einen Fixversuch autorisiert. Aktueller Worktree feat-german-app hat zahlreiche fremde Übersetzungsänderungen und noch kein data/pg; diese Änderungen bleiben unangetastet. Ursprüngliche defekte DB liegt weiterhin im Hauptcheckout. Zunächst Recovery nur auf separater Kopie; kein stiller Reset und kein ungeprüfter Austausch der Originaldatenbank.

Recovery-Versuch auf zusätzlicher Kopie /tmp/opencode/pglite-recovery-FFtDpO/pg erfolgreich angelaufen: WAL read-only nach Checkpoint-Records gescannt, CRC32C gegen Standardvektor und vorhandene Control-/Record-Checksummen geprüft. Letzter gültiger Shutdown-Checkpoint 0/1B0DF20 (2026-10-25 10:22:14 UTC), aktueller defekter Verweis 0/1B0DF98 zeigt auf XLOG_FPI_FOR_HINT. Nur auf Recovery-Kopie pg_control.checkPoint und checkPointCopy auf gültigen vorherigen Checkpoint gesetzt, korrekte CRC32C neu berechnet; Transaktions-/OID-Zähler identisch, DB_IN_PRODUCTION beibehalten. PostgreSQL führte echte Crash-Recovery von 0/1B0DF98 bis 0/1B630A0 aus. Alle 40 Anwendungstabellen/Journal lesbar, 4 Canvases und 5 Frames vorhanden; sauber geschlossen. Original unverändert. Vor Nutzung noch logischen Dump/Restore und App-Start verifizieren; Datenvollständigkeit ohne Vergleichsbackup nicht beweisbar.

Fixversuch erfolgreich im aktuellen Worktree feat-german-app bereitgestellt, ohne das defekte Original im Hauptcheckout auszutauschen. Nach Recovery kompatibles @electric-sql/pglite-tools@0.4.8 mit PGlite0.5.8 nur im privaten /tmp-Recovery-Verzeichnis installiert (keine Projektdependency geändert). SQL-Dump (105977 Bytes) in vollständig neue DB importiert; alle 39 Tabellen per Zeilenzahl und sortiertem Vollzeilen-Hash identisch, Constraints beim Import validiert, erneutes Öffnen ebenfalls identisch. Korrektur vorheriger Notiz: 39 Tabellen, 40 Journal-Einträge/Migrationen. Aktuelle Originaldateien gegen Diagnosebasis verglichen: abgesehen von postmaster.pid keine Abweichungen. Dauerhafte private Sicherung im Worktree unter data/recovery-backups/2026-10-26-pglite: original-pg (1164 Dateien mit SHA256 geprüft), recovered.sql (0600), Hashes, Recovery-Skripte und Logs; Backupordner0700. Original-PG-Control unverändert. Wiederhergestellte frische DB nach Worktree/data/pg übernommen, Assets ebenfalls kopiert, keine vorhandene Worktree-DB/Assets überschrieben. Smoke mit aktuellem Anwendungscode auf weiterer Kopie: zweimal Start/Stop; /healthz, /api/login-providers, /api/auth/get-session jeweilsHTTP200. Danach echte initDb() inklusive Migrationen auf installierter Worktree-DB erfolgreich; 4Canvases,5Frames,40Migrationen, client.close erfolgreich. Daten und Backups gitignored. Keine Anwendungscodeänderungen; fremde Übersetzungsänderungen unangetastet. Alter Hauptcheckout-Vite lauscht weiterhin4300; Nutzer muss alten bun-dev-Lauf beenden und im aktuellen Worktree neu starten. Nicht geprüft: manueller Login/Ansichten, vollständige Datenhistorie mangels Vergleichsbackup. Keine präventive Shutdown-Änderung vorgenommen; ursprünglicher Schadensauslöser nicht bewiesen. Status bleibt bis expliziter Nutzerbestätigung In Progress.

26.10.2026: Nutzer autorisiert lokale main-Integration inklusive geretteter DB. Unter TASK-70 aktuelle Worktree-Daten (nach manueller Nutzung2Canvases/2Frames) offline und SHA256-geprüft übernommen. Nach während der Gates erkannter weiterer Quelländerung neue aktuelle Kopie erstellt (1161Dateien),39Tabellenfingerprints identisch nach main-initDb mit40Migrationen. Linux-atomarer Verzeichnistausch; beschädigter ursprünglicher Hauptcheckout-Stand bleibt unter data/integration-backups/2026-10-26-task70-Ou03W1/original-main-pg sowie retired-main-pg erhalten. Ursprüngliche Rettungsunterlagen samt SQL-Export ebenfalls dort unter source-recovery-backups. Zweifacher App-Start/Neustart auf isolierter Kopie des übernommenen Datenstands und3HTTP-Endpunkte jeweils200. Kein präventiver Shutdown-Umbau; ursprünglicher Schadensauslöser weiter ungeklärt. Taskstatus ohne ausdrückliche Done-Freigabe offen.
<!-- SECTION:NOTES:END -->
