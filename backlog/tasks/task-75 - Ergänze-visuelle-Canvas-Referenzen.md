---
id: TASK-75
title: Ergänze visuelle Canvas-Referenzen
status: To Do
assignee: []
created_date: '2026-10-28T19:16:00Z'
updated_date: '2026-10-28T19:30:00Z'
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
<!-- SECTION:NOTES:END -->
