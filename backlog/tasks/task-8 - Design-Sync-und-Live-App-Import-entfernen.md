---
id: TASK-8
title: Design Sync und Live-App-Import entfernen
status: Done
assignee: []
created_date: '2026-10-23T09:49:00Z'
labels:
  - prowin
  - implementation
milestone: m-1
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Design Sync gehört nicht zum geplanten Creator- und Beraterinnen-Workflow.

Quellen: Umsetzung § 6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 ingest, doop-sync.js und Import-Quelle Live app sind samt Aufrufern entfernt.
- [x] #2 Migrationen für sync-Tabellen sind auf bestehenden Daten geprüft und Datenverlustfolgen dokumentiert.
- [x] #3 Typecheck und relevante Tests bestehen.

<!-- AC:END -->

## Umsetzung

Snippet, Ingest, Key-/Flow-Routen, Live-App-Import, Flow-Overlay und Agent-Kontext entfernt. Migration 0037 auf befüllten Sync-Tabellen geprüft; Designs und Einstellungen bleiben erhalten. Folgen: `docs/prowin/integration-removal.md`.
Verifiziert: Typecheck und 15 Tests (Migrationen, Duplikat-Persistenz, paralleles Speichern, Canvas-Events).
