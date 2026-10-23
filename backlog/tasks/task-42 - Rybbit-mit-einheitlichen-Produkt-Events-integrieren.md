---
id: TASK-42
title: Rybbit mit einheitlichen Produkt-Events integrieren
status: To Do
assignee: []
created_date: '2026-10-23T09:52:00Z'
labels:
  - prowin
  - implementation
milestone: m-6
dependencies:
  - TASK-13
  - TASK-35
  - TASK-39
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der Testlauf braucht aussagekräftige Nutzungsdaten aus der eigenen Analytics-Instanz statt PostHog.

Quellen: Umsetzung § 12.2; Referenz R1.8
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Self-hosted Rybbit erfasst SPA-Navigation und design_requested, frame_generated, element_edited, frame_exported, frame_shared sowie template_used.
- [ ] #2 Ein dünner track-Wrapper ersetzt die bisherigen Auslöser; fehlendes Rybbit beeinträchtigt den Produktfluss nicht und Event-Properties enthalten keine Frame-Kontaktdaten.
- [ ] #3 App-CSP erlaubt gezielt die Rybbit-Instanz; Frame-CSP wird dafür nicht aufgeweicht. Server-Events sind verifiziert oder bleiben ausdrücklich No-op.

<!-- AC:END -->
