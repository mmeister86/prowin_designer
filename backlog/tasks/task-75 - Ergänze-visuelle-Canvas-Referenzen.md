---
id: TASK-75
title: Ergänze visuelle Canvas-Referenzen
status: In Progress
assignee: []
created_date: '2026-10-28T19:16:00Z'
updated_date: '2026-10-28T20:32:00Z'
labels: []
dependencies: []
priority: medium
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ermögliche Bilddatei-Drops auf der aktuellen Canvas-Seite und die ausdrückliche Auswahl vorhandener Frames als visuelle Orientierung für einen einzelnen KI-Auftrag. Verwende den bestehenden Upload-, Karten- und Requesty-EU-Vision-Pfad. Keine editierbare Rekonstruktion und keine globale Referenzbibliothek. Zunächst nur Planung; Implementierung erst nach Freigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bilddateien in den vorhandenen Formaten landen per Drop an der Mausposition unter Berücksichtigung von Pan, Zoom und der beim Drop aktiven Seite; Größenlimit und Fehlermeldungen bleiben erhalten.
- [ ] #2 Vorhandene Frames lassen sich über eine sichtbare Tastatur-bedienbare Aktion und das Kontextmenü als Referenz vormerken; Vorschau und Entfernen sind vorhanden, insgesamt höchstens vier Referenzen inklusive neuer Dateianhänge.
- [ ] #3 Referenzen und Bearbeitungsziel sind getrennt: Eine Referenz wird nicht zugleich automatisch Scope; ein anderes ausdrücklich ausgewähltes Ziel bleibt erhalten.
- [ ] #4 Referenzentwurf übersteht Panelwechsel und Fehler; erfolgreich hochgeladene Bilder werden bei erneutem Senden nicht doppelt angelegt, erfolgreiche Teilimporte bleiben gruppiert rückgängig machbar.
- [ ] #5 Die Karte verwendet ausschließlich gültige Frame-IDs derselben Canvas; der Resident erhält auftragsbezogene visuelle Referenzanweisungen und meldet fehlende Referenzen oder bekannte fehlende Vision-Unterstützung ohne vorgetäuschte Analyse.
- [ ] #6 Bestehende Brand-, Berechtigungs- und Requesty-EU-Regeln bleiben erhalten; der UI-Hinweis benennt die Übertragung von Referenzbildern und die fehlende Redaktion von Kontaktdaten in Bildpixeln.
- [ ] #7 Gezielte Import-, Composer-, Karten-, Vision- und Browser-Regressionstests sowie Typecheck, Lint und Build sind dokumentiert; manuelle Nutzerabnahme bleibt gesondert offen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Planungsstand: keine Implementierung freigegeben.
Design: docs/superpowers/specs/2026-10-28-canvas-image-references-design.md
Implementierungsplan: docs/superpowers/plans/2026-10-28-canvas-image-references.md
1. Ergänze positionsfesten, teilfehlertauglichen Bild-Drop auf bestehendem Import.
2. Verbinde vorhandene Canvas-Frames und Dateianhänge im auftragsbezogenen Referenzentwurf; trenne Bearbeitungsziel und Quelle.
3. Sichere Kartenvalidierung vor Kontingentverbrauch und präzisiere Resident-/Vision-Verhalten.
4. Prüfe den Browserdurchstich, bestehende Regressionen und Datenschutzhinweise; manuelle Abnahme bleibt offen.
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
<!-- SECTION:NOTES:END -->
