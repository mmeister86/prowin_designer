---
id: TASK-35
title: Design-Dateien über Web Share und iOS Share Sheet teilen
status: In Progress
assignee: []
created_date: '2026-10-23T09:52:00Z'
updated_date: '2026-11-04T09:56:00Z'
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
- [x] #1 Unterstützte Browser teilen PNG/JPG als Dateien; andernfalls ist ein Download verfügbar.
- [x] #2 Abbruch des Share-Dialogs wird nicht als erfolgreicher Share gewertet; Fehler sind verständlich.
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

BLOCKIERT: Muse Spark 1.3 (opencodex/meta-muse/muse-spark-1.3 via OpenCode) konnte am 2026-11-04 nicht starten. T3 delegate_task: failed; ECONNREFUSED: Unable to connect. Is the computer able to access the url? Kein Ersatzmodell verwendet. Council/Design/Plan abgeschlossen; keine Produktcode-Änderungen und kein Terra-Code-Review. Fortsetzung sobald exakt dieses Modell erreichbar ist oder der Benutzer einen Ersatz ausdrücklich erlaubt. Plan-Basis f51e14d; Task-1-Brief und SDD-Ledger im isolierten Worktree vorhanden. Status bleibt In Progress, da die Projektkonfiguration nur To Do/In Progress/Done erlaubt; Blocked wurde vom CLI ohne Änderung abgelehnt.

Blocker aufgehoben: aktueller T3-Katalog führt Muse Spark 1.3 als meta/muse-spark-1.3. Verbindungsprobe via delegate_task/OpenCode mit exakt diesem Modell erfolgreich (MUSE_SPARK_1_3_READY). Vorheriger opencodex/meta-muse/muse-spark-1.3-Pfad schlug fehl; kein Modellwechsel, nur korrekter verfügbarer Modellpfad. Fortsetzung bei Task 1, kein erneutes Council/Design.

Web-Implementierung: d51c08b, Terra-Review und Korrektur e8af516. Terra bestätigt vier Laufzeitfehler behoben, keine offenen Critical/Important; eine Minor-Testlücke (stale-guard Szenario) für Abschlussreview dokumentiert. Fokus-Tests 55/55, Typecheck/Lint sauber laut Muse-Bericht. Vollsuite vor Korrektur 237 Dateien/2119 Tests bestanden; Abschlusslauf folgt. Native Umsetzung startet als Task 2, AC3 weiterhin offen.

Abschlussstand Quellcode ccb98a7: Web-Freigabe und native iOS-Quellen implementiert; Muse Spark1.3, unabhängige Terra-Reviews. Controller: 238 Dateien/2140 Tests bestanden, Typecheck/Lint/Build bestanden. Build mit bekanntem Bundle-Warning, doc-lint mit erklärter mtime-Warnung. AC1/2 anhand automatisierter Web-Datei-/Abbruch-/Fallbacktests verifiziert; keine reale Browser-/iOS-UI-Abnahme behauptet. AC3 bleibt offen.
BLOCKIERENDER RESTBEFUND aus Terra final-review-2: Native DesignFrame dekodiert updatedAt nicht; Revision-only Update oder Edit/Revert vor SwiftUI-onChange kann veraltete vorbereitete Bytes teilen. Live-Inhaltsänderungen/Löschung werden bereits erkannt, tatsächliche Revision fehlt aber. Nächster eng begrenzter Schritt: updatedAt/Eventgeneration dekodieren und in Pending/Prepared-Identität aufnehmen, Revision-only-/Edit-Revert-Tests und Terra-Nachprüfung. Finaler SDD-Fixlauf ist ausgeschöpft; Befund ausdrücklich übergeben statt als erledigt zu markieren. Keine Freigabeempfehlung.
Weiter offen: Swift DoopCoreChecks, Xcode-Simulatorbuild und reale Web/Desktop/iOS-Dateifreigabe inkl. Photos/Files/Abbruch; Linux ohne Apple-Toolchain. Bericht/Entscheidungen: docs/superpowers/reports/2026-11-04-file-sharing.md. Branch feat/task-35-file-sharing lokal erhalten, kein Push/Merge/PR. Task bleibt In Progress, nicht Done.

Benutzer fordert neue Council-Lösung für nativen Restfehler. Scoped Council Runde1: Opus5.5 5/10, GPT-6.1Sol 5/10, MuseWonder4/10; alle empfehlen optionales updatedAt + vorhandene Inhaltsidentität statt Eventzähler. Server-Version ist bereits streng monoton (store.ts607). Sol ergänzt konkreten verspäteten REST-/Snapshot-Rückschritt: gemeinsame native Zuweisungsgrenze soll streng ältere bekannte Frame-Versionen verwerfen, gleiche/unbekannte Versionen und Löschungen weiterhin zulassen. Task3 ergänzt im bestehenden Plan; Muse implementiert, Terra prüft, danach scoped Council Runde2. Keine erneute Umsetzung abgeschlossener Teile; Apple-Abnahme/AC3 bleibt offen.
<!-- SECTION:NOTES:END -->
