---
id: TASK-13
title: PostHog aus Client und Server entfernen
status: To Do
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
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

PostHog wird durch Rybbit ersetzt. Die Anwendung muss auch ohne aktive Analytics-Konfiguration funktionieren.

Quellen: Umsetzung §§ 6, 12.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 posthog-js, direkte Aufrufe und PostHog-Konfiguration sind entfernt; serverseitige Analytics sind zunächst No-op.
- [ ] #2 Keine PostHog-Netzwerkaufrufe entstehen; Typecheck und relevante Tests bestehen.
- [ ] #3 Die bisherigen Event-Auslöser sind als Grundlage für die Rybbit-Zuordnung dokumentiert.

<!-- AC:END -->
