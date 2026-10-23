---
id: TASK-29
title: Template-Attribute und Creator-Bearbeitung bereitstellen
status: To Do
assignee: []
created_date: '2026-10-23T09:51:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-14
  - TASK-23
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Creator benötigen stabile, semantische HTML-Felder, damit dieselbe Vorlage später sicher durch Beraterinnen personalisiert werden kann.

Quellen: Umsetzung §§ 9.1, 9.3; Referenz R1.3–R1.4
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 data-od-id, role, label, locked, max-length und allowed-colors sind dokumentiert und vom Creator bearbeitbar.
- [ ] #2 IDs sind innerhalb eines Frames eindeutig und bleiben bei Bearbeitung stabil; beim Duplizieren entstehen konfliktfreie IDs.
- [ ] #3 Nur berechtigte Rollen ändern Sperren und Constraints; optionale font/size-Locks werden nicht als beschlossen vorausgesetzt.

<!-- AC:END -->
