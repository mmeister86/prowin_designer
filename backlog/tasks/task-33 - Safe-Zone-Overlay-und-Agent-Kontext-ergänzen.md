---
id: TASK-33
title: Safe-Zone-Overlay und Agent-Kontext ergänzen
status: In Progress
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-11-03T18:41:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-32
  - TASK-29
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plattform-Overlays dürfen wichtige Texte nicht verdecken. Safe Zones warnen, ohne die Gestaltung zu blockieren.

Quellen: Umsetzung § 10.3; Referenz R2.2–R2.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 IG/FB Post verwenden 50 px rundum, IG Story oben 200/unten 250, WA oben 150/unten 200 und A4 11 CSS-px rundum.
- [x] #2 Rötliches Overlay ist umschaltbar; betroffene semantische Elemente erhalten eine dezente orange Warnung, Creator können pro Vorlage überschreiben.
- [x] #3 Agent-Kontext enthält die effektiven Safe Zones; Overlays gelangen weder ins Frame-HTML noch in Exporte.
- [x] #4 Die widersprüchlichen A4-Angaben in R2.2 sind anhand 3 mm geprüft und konsistent dokumentiert; 85 px werden nicht ungeprüft übernommen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Council-Vorgehen und Design festhalten
2. Metadaten, Persistenz, Berechtigungen und Copy/Undo mit Muse Spark 1.3 implementieren; mit GPT-6.1 Terra prüfen
3. UI-Overlay, Messung und Creator-Override implementieren und prüfen
4. Agent-Kontext, A4-Dokumentation und Regressionstests ergänzen; Gesamtprüfung durchführen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementierung isoliert auf feat/task-33-safe-zones. Council: Claude Opus 5.5, GPT-6.1 Sol, Muse Wonder; Umsetzung mit Muse Spark 1.3, Reviews GPT-6.1 Terra. Metadaten/Persistenz/Berechtigungen/Copy/Undo und Parent-only Overlay samt Creator-Overrides implementiert. Terra Overlay-Abschlussprüfung: 9/10, keine offenen Findings im letzten Fix-Scope. Letzter Gesamtlauf vor UI: 215 Dateien/1917 Tests grün. Agent-Kontext, A4-Dokumentation, Export-Isolation und finaler Gesamtlauf folgen. Status bleibt In Progress bis manueller Bestätigung.

Implementierung und automatische Verifikation abgeschlossen auf feat/task-33-safe-zones (Code-HEAD f8dc25e). Frischer unveränderter Gesamtlauf: 229 Dateien / 2024 Tests bestanden in 456.94 s; typecheck, lint und build erfolgreich. Terra-Gesamtprüfung: 7/10 mit zwei Findings; abschließende Nachprüfung 8/10, beide Important und Opacity-Minor behoben, keine neue scoped Auffälligkeit. HTML-Download sowie reale PNG/JPG-Pixel gegen Safe-Zone-Overlay geprüft. Alle AC automatisch geprüft; Status bleibt In Progress bis expliziter manueller Abnahme. Kein Push/Merge. Bekannte Grenzen: laufende Animationen nur nach Ende/Abbruch nachmessen; versteckte Tabs im Browser-Test simuliert; abgelehnter Layers-Rollback per Unit-Kette, nicht UI-E2E. Vorheriger paralleler Gesamtlauf war durch Codeänderungen gemischt und zählt nicht als finales Ergebnis.
<!-- SECTION:NOTES:END -->
