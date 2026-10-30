---
id: TASK-75
title: Ergänze visuelle Canvas-Referenzen
status: Done
assignee: []
created_date: '2026-10-28T19:16:00Z'
updated_date: '2026-10-29T15:00:00Z'
labels: []
dependencies: []
priority: medium
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ermögliche Bilddatei-Drops auf der aktuellen Canvas-Seite und die ausdrückliche Auswahl vorhandener Frames als visuelle Orientierung für einen einzelnen KI-Auftrag. Verwende den bestehenden Upload-, Karten- und Requesty-EU-Vision-Pfad. Keine editierbare Rekonstruktion und keine globale Referenzbibliothek. PR #5 ist nach main integriert; Nutzerabnahme aller sieben ACs und ausdrücklicher Taskabschluss am 29.10.2026. Technische Grenzen und tatsächlich ausgeführte Nachweise bleiben im Umsetzungsbericht dokumentiert.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bilddateien in den vorhandenen Formaten landen per Drop an der Mausposition unter Berücksichtigung von Pan, Zoom und der beim Drop aktiven Seite; Größenlimit und Fehlermeldungen bleiben erhalten.
- [x] #2 Vorhandene Frames lassen sich über eine sichtbare Tastatur-bedienbare Aktion und das Kontextmenü als Referenz vormerken; Vorschau und Entfernen sind vorhanden, insgesamt höchstens vier Referenzen inklusive neuer Dateianhänge.
- [x] #3 Referenzen und Bearbeitungsziel sind getrennt: Eine Referenz wird nicht zugleich automatisch Scope; ein anderes ausdrücklich ausgewähltes Ziel bleibt erhalten.
- [x] #4 Referenzentwurf übersteht Panelwechsel und Fehler; erfolgreich hochgeladene Bilder werden bei erneutem Senden nicht doppelt angelegt, erfolgreiche Teilimporte bleiben gruppiert rückgängig machbar.
- [x] #5 Die Karte verwendet ausschließlich gültige Frame-IDs derselben Canvas; der Resident erhält auftragsbezogene visuelle Referenzanweisungen und meldet fehlende Referenzen oder bekannte fehlende Vision-Unterstützung ohne vorgetäuschte Analyse.
- [x] #6 Bestehende Brand-, Berechtigungs- und Requesty-EU-Regeln bleiben erhalten; der UI-Hinweis benennt die Übertragung von Referenzbildern und die fehlende Redaktion von Kontaktdaten in Bildpixeln.
- [x] #7 Gezielte Import-, Composer-, Karten-, Vision- und Browser-Regressionstests sowie Typecheck, Lint und Build sind dokumentiert; manuelle Nutzerabnahme bleibt gesondert offen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Umsetzungsstand 28.10.2026: vier Implementierungen mit unabhängigen Task-Reviews und ein konsolidierter Gesamt-Review-Fix samt scoped Nachprüfung abgeschlossen. TASK-75 bleibt In Progress bis ausdrücklicher Nutzerabnahme.
Design: docs/superpowers/specs/2026-10-28-canvas-image-references-design.md
Implementierungsplan: docs/superpowers/plans/2026-10-28-canvas-image-references.md
Nachweise und sämtliche reversiblen Entscheidungen: docs/superpowers/reports/2026-10-28-canvas-image-references.md
1. Ergänze positionsfesten, teilfehlertauglichen Bild-Drop auf bestehendem Import.
2. Verbinde Canvas-Frames und Dateianhänge im auftragsbezogenen Referenzentwurf; trenne Bearbeitungsziel und Quelle.
3. Sichere Kartenvalidierung vor Kontingentverbrauch und präzisiere Resident-/Vision-Verhalten.
4. Dokumentiere Browser-/Visiontests, Datenschutz und Reviews; führe native/live/manuelle Abnahme erst mit Freigabe durch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
28.10.2026: Planung auf main@f732729 erstellt. Bestehende Upload-, Attachment-Persistenz- und Requesty-EU-Vision-Pfade wiederverwenden; keine neuen Dependencies oder Migrationen.
Baseline: bun run test --maxWorkers=2 tests/frameClipboard.test.ts tests/promptComposer.test.tsx tests/cardPrompt.test.ts tests/chatCompletionsAgent.test.ts — 4 Dateien / 37 Tests bestanden.
Read-only Backend-Scout und frischer Builder-Check durchgeführt. Eingearbeitet: Referenz-/Scope-Konflikt, Queueing-Race bei verschwundener Quelle, Anpassung deutscher Upload-Fehlertests, Retry ohne doppelte Uploads.
Undo bleibt wie bisher sitzungsgebunden; kein Erhalt über Canvaswechsel. Pixelinhalte werden nicht automatisch redigiert. Bereits nach gültiger Vorprüfung gebuchte Versuche werden bei späterem Quellenverlust nicht automatisch erstattet.
Richtwert 1–2 Entwicklertage, mit Fehler-/Retryabsicherung am oberen Ende. Empfehlung: native sequenzielle Umsetzung mit unabhängigem Abschlussreview. Keine Feature-ACs abgehakt; Status To Do bis Umsetzungsfreigabe.

Council-Review 28.10.2026: Vollständigen Plan nach Codeprüfung nachgeschärft (noch keine Implementierung). Desktop benötigt HTML5-Drop-Freigabe am Tauri-Builder plus aktualisierte Shell; Datei-Drops auf Panels dürfen nicht navigieren. Karten-Retry muss Referenzen ebenfalls vor Kontingentbuchung prüfen; Fehler verweist auf neuen Auftrag statt nicht vorhandenen Karteneditor. Automatisches Redesign-Preset für Referenzläufe deaktivieren. Busy-Schutz auch für Kontextmenü, interne Upload-Konversion weiterhin erlauben, Object-URLs bei Konversion freigeben. Admission- und Quellpixeltests konkreter definiert.
Aktueller Aufwand ersetzt die erste Schätzung: 3–5 Entwicklertage für den vollständigen geplanten Umfang; Plattform-Build-/Release-Wartezeiten und manuelle OS-/Live-Modell-Abnahme separat. Ein zweiter Council-Check folgt; Status weiterhin To Do, keine Feature-ACs abgehakt.

Abschluss Council-Planreview 28.10.2026: Drei vollständige Runden, zuletzt alle Mitglieder ohne Planblocker. Zusätzlich zum äußeren Datei-Navigationsschutz nun minimalen Files-only-Defaultaktionsschutz im bestehenden FRAME_BOOTSTRAP vorsehen; direkter Drop ins Bearbeitungsiframe bleibt ohne Import und darf nicht navigieren. Bestehenden sandboxed Runtime-Harness für Tests nach HTML-Morph nutzen; echte OS-Navigation separat manuell nachweisen.
Nur Design, Implementierungsplan und diese Backlog-Notizen geändert. Keine Produktcode-Implementierung, keine neuen Featuretests ausgeführt, keine native Auslieferung, kein Push/PR. Aufwand 3–5 Entwicklertage bleibt grober Richtwert; TASK-75 bleibt To Do bis zur ausdrücklichen Umsetzungsfreigabe.

28.10.2026: Umsetzung des Council-geprüften Plans mit Subagent-Driven Development ausdrücklich beauftragt. Isolierter Worktree /home/matthias/.local/share/opencode/worktree/9d3066/task-75-canvas-references, Branch task/75-canvas-references. Frische vollständige Baseline: 175 Testdateien / 1397 Tests bestanden mit --maxWorkers=2 --testTimeout=30000; bestehende Node-localStorage-Warnungen dokumentiert.
Preflight-Ruling: Ersetze den geplanten rein textuellen Desktop-Source-Test durch ausführbare Rust-Tests der tatsächlich verwendeten Navigationsentscheidung; Builder zusätzlich per cargo/OS-Gate prüfen. Keine neue Funktionalität, keine automatische Auslieferung.
Ablauf: vier sequenzielle frische Implementer mit Task-Reviews, anschließend Gesamt-Review. Kein Push/Merge, Task bleibt bis zur manuellen Nutzerabnahme In Progress.

28.10.2026: Lokale Umsetzung auf task/75-canvas-references, Code-HEAD 43d3e6934cd09c4db67950529ec008ad5cd2b23a. Alle vier Tasks unabhängig spec-/qualitätsreviewt. Whole-Branch-Review fand drei wichtige Integrationsfehler (Overlay über Panels, Seiten-/Canvaswechsel während Allowance-Await, Überschreiben neuerer gestreamter Frames) und Decoding vor Validierung; ein gemeinsamer Fixlauf mit jeweils beobachtetem RED/GREEN, frische scoped Nachprüfung alle vier ADDRESSED. Keine neue Critical-/Important-Feststellung.
Frischer Controller-Featurelauf: 17 Dateien / 219 Tests bestanden, keine Skips; tatsächliches hochgeladenes PNG am EU-Vision-Transport mit RGB-Prüfung nachgewiesen. Typecheck, vollständiger Lint, Build, Doc-Lint und Diff-Prüfung Exit 0. Implementer-Gesamtlauf am selben Code-HEAD: 179 Dateien / 1464 Tests bestanden, keine Skips.
WICHTIG: Neuerer Controller-Gesamtlauf ist NICHT grün: 178 Dateien bestanden / 1 Suite fehlgeschlagen, 1463 Tests bestanden / 1 Skip. Unveränderte tests/frameLocalEdits.test.ts:32-Fixture wartete beim Start 30000 ms auf elementPanelHarness. Unveränderter diagnostischer Nachlauf 1/1 bestanden; ursprüngliche Ursache unbewiesen. Vorherigen Port-39347-Startfehler ebenfalls nicht umdeuten. Start-/Baseline-Runtime-Diagnosen unter bestehender TASK-73 dokumentiert; Bundle-Bewertung als TASK-76 To Do, keine ungefragte Optimierung. Warnungen nicht unterdrückt.
AC 2–7 anhand automatisierter Nachweise/Dokumentation abgehakt; AC 7 behauptet keinen grünen Gesamtlauf. AC 1 bleibt für eingeschlossene native/echte Drop-Abnahme offen: Cargo fehlt, kein Rust-Build/Test und keine neue Shell-/OS-Prüfung möglich. Keine Live-Modell-/ästhetische oder manuelle Nutzerabnahme. Entwürfe bleiben live/client-memory, Bildpixel unredigiert, Quellschutz anweisungsbasiert. Acht reversible Rulings vollständig im versionierten Umsetzungsbericht. Rohlogs vorerst bewusst behalten.
Kein Push, PR, Merge, Release oder bezahlter Modellaufruf. Status bleibt In Progress; nur ausdrückliche manuelle Nutzerabnahme darf schließen.

29.10.2026: Push und Pull Request des bestehenden Branches gegen main ausdrücklich beauftragt; kein Merge oder Release. Frischer PR-Preflight am unveränderten Code-HEAD 43d3e69: bun run test --maxWorkers=2 --testTimeout=30000 — 179 Dateien / 1464 Tests bestanden, keine Skips, Exit 0, 325,48 s. Typecheck, vollständiger Lint, Build, Formatprüfung aller getrackten Dateien und Doc-Lint ebenfalls Exit 0. Frühere fehlgeschlagene Browser-Fixture-Gesamtläufe bleiben historisch dokumentiert und TASK-73 offen; Warnungen nicht unterdrückt.
PR-Ziel ausdrücklich mmeister86/prowin_designer:main, nicht das GitHub-CLI-Default kgoedecke/doop. Branch enthält zusätzlich den bereits vorhandenen, noch nicht auf origin/main liegenden Font-Basiscommit f732729; Historie unverändert und im PR transparent ausweisen. .env, lokale Datenbanken, Nutzer-Backup und ignorierte Rohlogs sind nicht im PR-Diff. Neuer grüner Lauf im versionierten Bericht ergänzt. TASK-75 bleibt In Progress, AC 1/native/volle manuelle Abnahme weiter offen.

PR-Preflight-Zusatz: git diff --check origin/main...HEAD meldet ausschließlich die unveränderte originale public/fonts/lt-kai-LICENSE aus dem bereits vorhandenen Basiscommit f732729 (CRLF/Whitespace). Datei gegenüber f732729 bytegleich; keine ungefragte Umformatierung der Fremdlizenz. TASK-75-Range und gestagte Dokumentation bestehen den Whitespace-Check; den gesamten PR-Whitespace-Check nicht als grün ausgeben. Im PR ausdrücklich dokumentiert.

29.10.2026: Nutzer nimmt TASK-75 ausdrücklich vollständig ab und beauftragt Done mit allen sieben Acceptance Criteria. AC 1 deshalb ebenfalls auf ausdrückliche Nutzerfreigabe abgehakt; keine zusätzlichen nativen OS-/Live-Modelltests durch den Agenten behauptet. Bereits dokumentierte technische Grenzen bleiben als Nachweis erhalten. PR #5 ist nach main gemergt (e35684f); letzter Main-Testlauf: 179 Dateien / 1464 Tests bestanden, keine Skips. Taskabschluss nach ausdrücklicher Abnahme, nicht allein wegen Merge oder grüner CI.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ergänze visuelle Canvas-Referenzen

- Ermögliche Bild-Drops und auftragsbezogene Referenzvorschauen mit sicheren Uploads und wiederholbarem Senden.
- Trenne Quellreferenzen und Bearbeitungsziel; bewahre Brand-, Berechtigungs- und Datenschutzgrenzen.
- Sichere Import, Composer, Karten, Vision-Transport und Browserbedienung durch Regressionstests ab.
- Übernimm PR #5 nach main; dokumentiere die ausdrückliche Nutzerabnahme aller sieben ACs am 29.10.2026.
<!-- SECTION:FINAL_SUMMARY:END -->
