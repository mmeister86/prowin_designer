---
id: TASK-32
title: Fünf Kernformate persistent integrieren
status: In Progress
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-11-02T10:30:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-14
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Social- und Druckausgaben benötigen feste, reproduzierbare Maße. Bestehende Frames ohne Preset müssen weiterhin funktionieren.

Quellen: Umsetzung §§ 10.1–10.2; Referenz R1.6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 IG Post 1080×1080, IG Story/WA Status 1080×1920, FB Post 1200×630 und A4 794×1123 CSS-px sind auswählbar.
- [ ] #2 Frame.preset, Datenbankschema, Migration und Serialisierung erhalten die Auswahl über Speichern und Neuladen; alte Frames ohne preset bleiben kompatibel.
- [ ] #3 Preset-Maße sind für Nicht-Creator auch serverseitig gegen Resize geschützt; Creator-Ausnahmen sind geprüft.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Gemeinsamen Formatkatalog, Frame.preset und Datenbankmigration samt Persistenz ergänzen.
2. REST-, MCP-, Resident-, Restore- und Live-Resize-Pfade über bestehende Canvas-Creator-Rechte schützen.
3. Separaten Preset-Dialog integrieren, Kopien/Undo erhalten und Resize-UI absichern.
4. Pro Schritt Spec-/Qualitätsreview, abschließend Gesamttests und Branch-Review; manuelle Abnahme bleibt offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
02.11.2026: Nutzer wählt separaten Preset-Dialog und gibt Entwurf sowie isolierten Worktree frei. Implementierungsplan: docs/superpowers/plans/2026-11-02-format-presets.md. Keine Änderungen an Safe-Zone-Overlay oder Exportauflösung.
<!-- SECTION:NOTES:END -->
