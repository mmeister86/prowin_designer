---
id: TASK-48
title: Coolify-Testumgebung mit Postgres und persistenten Assets aufsetzen
status: To Do
assignee: []
created_date: '2026-10-23T09:53:00Z'
labels:
  - prowin
  - implementation
milestone: m-6
dependencies:
  - TASK-1
  - TASK-25
  - TASK-20
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der zustandsbehaftete doop-Server braucht einen dauerhaften Prozess und persistente Daten. Billing bleibt im ersten Deploy deaktiviert.

Quellen: Umsetzung § 13; Referenz R6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Coolify baut den Fork über Dockerfile inklusive Chromium und Fonts; Postgres und Asset-Volume überstehen einen Redeploy.
- [ ] #2 TLS und WebSockets unter /ws funktionieren; Auth-URLs, Trusted Origins und Secrets sind passend gesetzt.
- [ ] #3 Requesty/Magnific sind konfiguriert, Stripe-Keys fehlen; Registrierung ist geschlossen und Admin-Zugang ist geprüft.

<!-- AC:END -->
