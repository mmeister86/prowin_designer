---
id: TASK-20
title: Boot-Guard gegen unerlaubte Modell- und Analytics-Keys einführen
status: To Do
assignee: []
created_date: '2026-10-23T09:50:00Z'
labels:
  - prowin
  - implementation
milestone: m-2
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Ein falsch gesetzter Key darf keine unerwünschten direkten Datenabflüsse reaktivieren. Der Guard muss vor Provider-Initialisierung greifen.

Quellen: Umsetzung § 7.6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Gesetzte ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, ARK_API_KEY, POSTHOG_KEY oder VITE_POSTHOG_KEY verhindern den Serverstart.
- [ ] #2 Fehlermeldungen nennen Variablennamen, aber keine Geheimnisse; erlaubte Konfiguration startet normal.
- [ ] #3 Tests decken jeden verbotenen Key und den erlaubten Startfall ab; weitere aktive Providerpfade werden beim Egress-Test berücksichtigt.

<!-- AC:END -->
