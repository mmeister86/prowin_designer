---
id: TASK-17
title: Distiller und verbleibendes Bild-Tagging auf Requesty umstellen
status: Done
assignee: []
created_date: '2026-10-23T09:50:00Z'
updated_date: '2026-10-24T20:49:00Z'
labels:
  - prowin
  - implementation
milestone: m-2
dependencies:
  - TASK-16
  - TASK-12
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der Distiller ruft Anthropic unabhängig vom Agent-Provider auf. Auch eine behaltene Hintergrundbibliothek darf keinen direkten Modellaufruf behalten.

Quellen: Umsetzung §§ 7.4–7.5
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Beide Distiller-Aufrufstellen nutzen Requesty mit der Text-Policy; Tool-Ergebnisse werden weiterhin korrekt ausgewertet.
- [x] #2 Ohne Requesty-Key bleibt der Distiller kontrolliert deaktiviert; direkte Anthropic-Laufzeitaufrufe sind entfernt.
- [x] #3 Verbliebenes Background-Tagging nutzt Requesty-Vision; passende Regressionstests bestehen.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Requesty-Transport um optionale erzwungene Tool-Auswahl und JSON-Schema-Ausgabe ergänzen; Regressionen zuerst nachweisen.
2. Beide Distiller-Aufrufe auf Requesty-Text-Policy umstellen, fehlenden Key kontrolliert behandeln und Tool-Ergebnisse erhalten.
3. Dormantes Background-Tagging auf Requesty-Vision migrieren; Feature bleibt deaktiviert.
4. Konfiguration/Dokumentation aktualisieren und Tests, Typecheck, Lint sowie unabhängiges Review durchführen. Status bis manueller Nutzerabnahme In Progress belassen.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Umsetzung: Distiller-Zusammenfassung und Regelprüfung auf Requesty EU / policy/prowin-text-gen umgestellt, kein Anthropic-Laufzeitclient mehr. Dormantes Background-Tagging verwendet Requesty-Vision und JSON-Schema; Feature-Gate bleibt aus. Transport unterstützt forced function choice und response_format; Trunkierung wird vor tool_use ausgewertet.
Nachweise: initiale Regressionen 17 rot/5 grün, nach Migration 47 gezielte Tests grün; Trunkierungsregression danach mit zwei roten Tests nachgewiesen und behoben. Breiter gezielter Lauf: 8 Dateien / 84 Tests grün. Typecheck und Vite-Build einschließlich Extension-Build grün. Gesamtsuite und unabhängiges Review laufen.
Projektweiter Lint scheitert an 14 bereits vorhandenen no-undef-Fehlern in data/requesty-evaluation/run-checks.mjs; diese fremde Evaluierungsdatei bleibt unverändert. Doc-Lint bestanden mit einem Hinweis auf ältere CLAUDE.md/.context-Dokumente.

Unabhängige Reviews: Spock bestätigte die Transportoptionen und Testgrenzen. Leia meldete eine Validierungslücke bei optionalen Tool-Metadaten. Drei Regressionstests wiesen den Evidenzverbrauch nach; Guard ergänzt und Trunkierungstests für Summary/Tagging hinzugefügt. Review-Runde 2: APPROVE, keine verbleibenden Findings.
Finaler gezielter Lauf: 8 Dateien / 89 Tests grün; Typecheck, Oxlint und ESLint der geänderten Dateien sowie Prettier grün. Volle Suite zunächst 972 bestanden, drei 5s-Timeouts (legacyPagesMigration, prowinMigration, rate-limit-wiring) und fehlendes bun im claudeExtension-Setup. Alle drei Timeout-Tests einzeln mit maxWorkers=1 grün (3/3). Wiederholung der Gesamtsuite mit temporär per npx bereitgestelltem Bun 1.3.10 und maxWorkers=4 läuft.
Kein Live-Inferenztest in TASK-17; tatsächliche forced-tool-/JSON-Schema-Unterstützung sämtlicher Policy-Fallbacks bleibt gesondert nachzuweisen. Keine automatische Schließung: manuelle Nutzerabnahme erforderlich.

Review-Fix verifiziert: 89/89 gezielte Tests grün; erneuter Typecheck, Oxlint/ESLint der Änderungen und Prettier grün. Gesamter Oxlint und ESLint ebenfalls grün, wenn ausschließlich die vorhandene Evaluierungsdatei data/requesty-evaluation/run-checks.mjs von ESLint ausgenommen wird. Die drei zuvor wegen 5s-Timeout gescheiterten Tests bestehen bei unverändertem Code mit maxWorkers=1. Lokale Modellkonfiguration geprüft: Requesty-Layout-Policy gesetzt, kein veralteter DOOP_DISTILL_MODEL-Override vorhanden. Kein .env-Änderungsbedarf.

Abschließende Gesamtsuite: npx --yes --package=bun@1.3.10 -c "npm test -- --maxWorkers=4" erfolgreich: 136 Testdateien / 983 Tests bestanden, keine übersprungenen Tests, Laufzeit 102.91s. Dabei keine Produktcode-/Timeout-Anpassungen vorgenommen. Gesamtlauf gibt zudem ECONNREFUSED-Meldungen für localhost:3000 aus, beendet sich trotzdem mit Exit 0.
Implementierungsplan und Operator-Dokumentation mit finalem Prüfstand aktualisiert. Alle drei Akzeptanzkriterien technisch verifiziert. Status bleibt In Progress; kein Commit/Push und keine automatische Done-Markierung. Abschluss erst nach ausdrücklicher Nutzerbestätigung nach manuellem Test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Distiller-Zusammenfassung und Regelprüfung auf Requesty EU mit Text-Policy umgestellt; verbleibendes Bild-Tagging nutzt Requesty-Vision und JSON-Schema. Fehlender Requesty-Key deaktiviert diese Pfade; kein direkter Anthropic-Laufzeitclient verbleibt. Tool-Validierung und Trunkierungsschutz ergänzt. Regressionen und unabhängiges Review bestanden. Vom Nutzer im Chat ausdrücklich als Done abgenommen.
<!-- SECTION:FINAL_SUMMARY:END -->
