---
id: TASK-31
title: Template-Sperren in Editor und Agent sichtbar machen
status: To Do
assignee: []
created_date: '2026-10-23T09:51:00Z'
labels:
  - prowin
  - implementation
milestone: m-4
dependencies:
  - TASK-30
  - TASK-24
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Beraterinnen sollen erlaubte Änderungen erkennen und verständliches Feedback erhalten, während Creator den vollständigen Editor behalten.

Quellen: Umsetzung § 9.2; Referenz R1.4, R4.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 FrameView, LayersPanel und ElementPanel zeigen Sperren; Nicht-Creator können gesperrte Elemente nicht auswählen oder bearbeiten.
- [ ] #2 Farbwahl beschränkt sich auf erlaubte Tokens und Textfelder respektieren max-length; Serverfehler werden verständlich angezeigt.
- [ ] #3 Agent- und MCP-Guide erklären Rollen und Attribute; ein Agent-Edit respektiert dieselben Constraints wie manuelle Edits.

<!-- AC:END -->
