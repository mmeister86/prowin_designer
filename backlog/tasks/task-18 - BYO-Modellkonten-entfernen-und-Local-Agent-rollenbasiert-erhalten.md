---
id: TASK-18
title: BYO-Modellkonten entfernen und Local Agent rollenbasiert erhalten
status: Done
assignee: []
created_date: '2026-10-23T09:50:00Z'
updated_date: '2026-10-24T20:49:00Z'
labels:
  - prowin
  - implementation
milestone: m-1
dependencies:
  - TASK-16
  - TASK-14
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Beraterinnendaten sollen nicht über private Modellkonten laufen. Zunächst wird BYO ausgeblendet, nach verfügbarer Requesty-Alternative vollständig entfernt; Local Agent bleibt für Creator/Admins.

Quellen: Umsetzung §§ 6, 7.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 ChatGPT-, OpenAI-, Anthropic-, OpenRouter- und Gemini-Konten sind aus UI und nutzbaren API-Pfaden entfernt.
- [x] #2 Gespeicherte Zugangsdaten und zugehörige Konfiguration werden mit dokumentierter Migration behandelt.
- [x] #3 Creator/Admins können Local Agent verwenden, Beraterinnen nicht; Rollen- und Regressionstests sowie Typecheck bestehen.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. BYO-UI, Account-/OAuth-APIs, Laufzeitauswahl, Bildgenerierung, Kontingent und gespeicherte Konfiguration erfassen.
2. Regressionsfälle für gesperrte Alt-APIs, credential-freie Laufzeitauswahl und Creator/Admin-vs-Beraterinnen schreiben und vorheriges Scheitern belegen.
3. BYO-Pfade und zugehörige Konfiguration entfernen; versionierte Migration für gespeicherte Zugangsdaten ergänzen. Local Agent rollenbasiert erhalten.
4. Dokumentation und betroffene Tests aktualisieren; gezielte und vollständige Tests, Typecheck, Build/Lint sowie unabhängiges Review durchführen. Status bis manueller Nutzerabnahme In Progress.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Schnittstellenanalyse durch Spock (Backend/Migration) und Furiosa (UI/Rollen). Umsetzung im aktuellen Checkout auf bestehender TASK15/16/17-Arbeit. BYO-Modul, OAuth/Device/Loopback/Refresh, alle privaten Text-/Bildproviderzweige und UI/API-Client entfernt. Alt-API liefert authentifiziert 410. Local Agent vom alten Kontopanel entkoppelt; aktuelle Creator/Admin-Rolle für Auswahl und Kontingent-Bypass geprüft, stale Beraterinnen-Präferenz ignoriert.
Migration 0039 mit Drizzle generiert, DROP bewusst auf IF EXISTS ohne CASCADE begrenzt; nur temporäre DBs getestet. Lokale/produktive DB nicht gestartet. Zugangsdaten aller Typen verschwinden, Local-/Bildpräferenzen, Verbrauch und Designs bleiben. Upgrade-/Widerruf-/Backupgrenzen dokumentiert.
RED: 14 API-/Vertragsfälle und zwei Allowance-Fälle scheiterten vor Umsetzung. Anschließend 23 initiale Tests und breiter gezielter Lauf14 Dateien/93Tests grün. Typecheck grün. Obsolete positive BYO-Tests durch Abschaltungs-/Rollen-/Serverbilling-Abdeckung ersetzt. Gesamtsuite/Build/Lint und unabhängiges Review laufen. iOS nur zwei veraltete Texte korrigiert; kein nativer Build auf Linux.

Review-Runde 1: zwei Important-Befunde. (1) Kostenlos lokal eingereihte Aufträge konnten nach Serverwechsel oder Rollenentzug ohne Nachzulassung serverbezahlt laufen. Neuer Integrationstest belegt RED mit drei Aufträgen und Verbrauch0. Fix: Migration0040 nullable server_paid auf tasks/comments/feedback, vertrauenswürdiges Gate an REST/MCP/Automation-EntryPoints, geordnete Snapshot-Persistenz und transaktionale Nachzulassung per Work-Zeilensperre/counter-upsert; vorhandene bezahlte Zulassung wird wiederverwendet. Unbekannte historische Zulassungen pausieren für ausdrücklichen Retry. Integration jetzt grün mit used1 und zwei pausierten Aufträgen; drei DB-Tests prüfen alle Typen/Doppelzählung/Limit/Altstatus. (2) Local-Serverpräferenz hing an nativem CLI-Status. Furiosa belegte zwei RED-Fälle und veröffentlicht sie jetzt unabhängig;10 zugehörige Tests grün.
Gezielte Review-Fix-Prüfung:7 Dateien/32Tests grün. Erster Gesamtlauf:968 bestanden, ein drawingBrowser-Test scheiterte mit Execution context was destroyed; isolierter Lauf unverändert26/26 grün. Zweite Gesamtsuite und Review-Runde2 laufen. Kein Test gegen reale Kundendaten oder produktive DBs.

Review-Runde2 bestätigte die regulären Fixes und fand einen Fehlerpfad bei Snapshot-/Admission-Exceptions vor der Run-Fehlerbehandlung. prepareServerWork kapselt jetzt pro Claim Flush und Zulassung, pausiert Fehler sichtbar retryfähig und lässt erfolgreiche frühere Claims weiterlaufen. Drei neue Regressionen zunächst rot (neue Helper-API fehlte); nach Umsetzung5 Dateien/32Tests grün inkl. DB-Fehlern, Local-Queue, Requesty-Resident, Automations und Local-Auswahl. Review-Runde3 PASS, keine verbleibenden konkreten Findings.
Typecheck, Oxlint und ESLint (nur bekannte fremde Datei data/requesty-evaluation/run-checks.mjs ausgenommen) grün. Standard-Lint bleibt wegen deren14 bestehenden no-undef-Fehlern rot. Vite-/Extension-Build erfolgreich. Doc-Lint bestanden mit einem Hinweis zu älteren CLAUDE.md/.context-Dateien. Gesamtlauf nach finaler Fehlerbehandlung läuft; vorheriger Zwischenlauf enthielt bewusst noch die neuen roten Exception-Tests und einen inzwischen angepassten Automations-Textvergleich.
Alle drei Akzeptanzkriterien technisch verifiziert; Status bleibt bis ausdrücklicher Bestätigung nach manuellem Test In Progress. Keine Commits/Pushes oder produktive Migrationsausführung gestartet.

Letzter gemeinsamer Gesamtlauf:134 Dateien grün, drawingBrowser mit1Fehler;979/980Tests bestanden. Ursache eingegrenzt: drawingBrowser meldete Reload/fehlendes drawingHarness exakt22:29:23; das Extension-Paket public/claude-extension/doop.mcpb wurde durch claudeExtension.test.ts um22:29:23.557 neu geschrieben. Der öffentliche Vite-Watcher kann dadurch gleichzeitig aktive Browser-Harnesses neu laden. Isoliert bestand drawingBrowser26/26. Abschließende Prüfung daher alle übrigen Tests zuerst, Extension-Test erst danach (keine Produkt-/Timeoutänderungen, keine Tests übersprungen). Review-Runde3 und finale gezielte Exception-Prüfung32/32 bereits grün.

Abschließende Verifikation erfolgreich: Hauptsuite mit Bun1.3.10 --maxWorkers=4 --exclude tests/claudeExtension.test.ts:134Dateien/976Tests grün in99.70s. Danach Extension allein:1Datei/4Tests grün in15.67s. Zusammen alle135Dateien/980Tests, keine Tests übersprungen. Die Trennung vermeidet Vite-Reloads durch den öffentlichen Extension-Paket-Write; kein Produkt-/Timeoutfix für den Browser nötig.
Finaler Typecheck, Vite-/Extension-Build, Formatprüfung und Review-Runde3 PASS. Gesamtlint mit ausschließlich bekannter Evaluierungsdatei ausgenommen grün; Standard-Lint weiterhin14 vorhandene no-undef-Fehler dort. Migrationshinweise und Plan finalisiert. Alle Akzeptanzkriterien erfüllt. TASK-18 bleibt In Progress bis ausdrücklicher manueller Nutzerabnahme; kein Commit/Push oder produktiver Migrationsstart.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Private BYO-Modellkonten aus UI, APIs und Text-/Bildinferenz entfernt; Alt-API liefert 410. Credential-Migration und Upgrade-Hinweise ergänzt. Local Agent bleibt rollenbasiert für Creator/Admins erhalten. Nachzulassung eingereihter Local-Aufträge, Fehlerbehandlung und CLI-unabhängiger Serverwechsel abgesichert. Alle 980 Tests in zwei Prüfgruppen, Typecheck, Build und abschließendes Review bestanden; bekannte 14 Lint-Altfehler dokumentiert. Vom Nutzer im Chat ausdrücklich als Done abgenommen.
<!-- SECTION:FINAL_SUMMARY:END -->
