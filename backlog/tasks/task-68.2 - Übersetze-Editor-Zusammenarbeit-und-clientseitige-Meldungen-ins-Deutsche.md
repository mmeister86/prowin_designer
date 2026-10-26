---
id: TASK-68.2
title: Übersetze Editor, Zusammenarbeit und clientseitige Meldungen ins Deutsche
status: In Progress
assignee: []
created_date: '2026-10-25T19:51:00Z'
updated_date: '2026-10-25T23:21:00Z'
labels: []
dependencies: []
parent_task_id: TASK-68
priority: medium
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Canvas-Werkzeuge, Eigenschaften, Ebenen, Kommentare, Aufgaben, Memory, Export und clientseitige Standardnamen und Statusmeldungen übersetzen; vorhandene Benutzerinhalte nicht verändern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Editor und Zusammenarbeit einschließlich Accessibility, Standardnamen und Vorlagentexten sind deutsch.
- [x] #2 Betroffene Editor-/Browser-Tests sind angepasst und prüfen weiterhin Verhalten statt technische Werte zu übersetzen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Anforderungen, Aufrufstellen und neue deutsche Helfer prüfen; rote Regressionen für IDs/Namen beobachten.
2. Editor/Zusammenarbeit und übrige Lib-Anzeigen übersetzen.
3. Fokus- und Gesamttests, statische Prüfungen, unabhängiger Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Editor/Zusammenarbeit und zugewiesene Libtexte übersetzt. Trinity-Review plus Fixrunde: I1-I3/M1 behoben, Nachprüfung spec compliant/quality Approved. Gemeinsamer UserFacingError erhält eigene Recovery-Hinweise, unbekannte externe Fehler weiter sicher generisch. Echter Helper statt Mock geprüft; negative Browserassertion durch Gegenprobe validiert. Vollsuite159Dateien/1259Tests bei maxWorkers2 grün, Typecheck/Lint/Format grün. Manuelle Abnahme offen.

26.10.2026: Finale breite Prüfung plus gemeinsame Korrekturwelle und unabhängige scoped Nachprüfung abgeschlossen; keine offenen Critical-/Important-Befunde. Controller-Vollsuite165Dateien/1309Tests bestanden; Typecheck, Gesamt-Lint und Web-Build erneut grün. Produkt-/Teststand unverändert zum geprüften Snapshot. Native Builds und echte externe Dienste bleiben gemäß Prüfprotokoll offen. Keine Nutzerabnahme; Status bleibt In Progress.
<!-- SECTION:NOTES:END -->
