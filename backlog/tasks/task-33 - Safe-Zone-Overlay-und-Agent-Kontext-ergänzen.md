---
id: TASK-33
title: Safe-Zone-Overlay und Agent-Kontext ergänzen
status: In Progress
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-11-03T14:34:00Z'
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

- [ ] #1 IG/FB Post verwenden 50 px rundum, IG Story oben 200/unten 250, WA oben 150/unten 200 und A4 11 CSS-px rundum.
- [ ] #2 Rötliches Overlay ist umschaltbar; betroffene semantische Elemente erhalten eine dezente orange Warnung, Creator können pro Vorlage überschreiben.
- [ ] #3 Agent-Kontext enthält die effektiven Safe Zones; Overlays gelangen weder ins Frame-HTML noch in Exporte.
- [ ] #4 Die widersprüchlichen A4-Angaben in R2.2 sind anhand 3 mm geprüft und konsistent dokumentiert; 85 px werden nicht ungeprüft übernommen.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Council-Vorgehen und Design festhalten
2. Metadaten, Persistenz, Berechtigungen und Copy/Undo mit Muse Spark 1.3 implementieren; mit GPT-6.1 Terra prüfen
3. UI-Overlay, Messung und Creator-Override implementieren und prüfen
4. Agent-Kontext, A4-Dokumentation und Regressionstests ergänzen; Gesamtprüfung durchführen
<!-- SECTION:PLAN:END -->
