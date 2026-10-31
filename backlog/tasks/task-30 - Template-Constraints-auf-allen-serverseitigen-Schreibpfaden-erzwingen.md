---
id: TASK-30
title: Template-Constraints auf allen serverseitigen Schreibpfaden erzwingen
status: In Progress
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-10-31T20:23:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-29
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
UI-Sperren und Agent-Prompts reichen nicht aus. Serverprüfungen müssen die ursprünglichen Regeln auch gegen manipulierte HTML- und Metadaten-Änderungen schützen.

Quellen: Umsetzung § 9.2; Referenz R1.3–R1.4
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Nicht-Creator können gesperrte Elemente nicht ändern oder löschen und Längen-/Token-Farbgrenzen nicht umgehen.
- [x] #2 updateFrame und appendFrameHtml-Commit sowie weitere erreichbare Schreibpfade verwenden dieselbe rollenbasierte Prüfung.
- [x] #3 Tests decken gültige Edits, entfernte Constraints, doppelte/geänderte IDs, direkte API/MCP-Edits und unberechtigte Rollen ab; abgelehnte Edits verändern den gespeicherten Frame nicht.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Vollstaendigen HTML-Guard mit Parser und Tests implementieren
2. Alle Frame-Schreibpfade und atomare Append-Commits absichern
3. REST/MCP/Resident sowie Regressionen testen und dokumentieren
4. Task-Reviews und abschliessendes Branch-Review durch Muse Spark 1.3
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Umsetzung vom Nutzer am 31.10.2026 freigegeben: SDD mit Muse Spark 1.3; TASK-29 laut Nutzer abgeschlossen. Isolierter Branch task/30-template-constraints. TASK-31-UI bleibt ausserhalb Scope.

Implementierung und automatische AC-Pruefung am 31.10.2026: gemeinsamer parse5-Guard auf Update/Append-Commit/Restore/Create/Delete/Resize; atomare nutzer- und revisionsgebundene Streams; sourceFrameId fuer Kopie/Redo/API/MCP/Resident.
SDD mit Muse Spark 1.3: drei Task-Reviews und abschliessendes Branch-Review/Nachreview. Event-Handler- und Farbentfernungs-Luecken korrigiert; kleine anschliessende CSS-Kurzform-Haertung lokal per TDD und Gesamtsuite verifiziert.
Finale Verifikation auf Produktionsstand 6772c12: 190 Dateien / 1585 Tests PASS; Typecheck, Lint, Build und diff-check PASS. Doc-lint PASS mit einem Stale-.context-Hinweis; bekannte Node-localStorage-/Build-Chunk-Hinweise.
Details und Entscheidungen: docs/superpowers/reports/2026-10-31-template-constraints.md. Kein manueller Browser-Test, Push, PR oder Merge. TASK-30 bleibt In Progress bis Nutzerabnahme; TASK-31-UI bleibt Folgearbeit.
<!-- SECTION:NOTES:END -->
