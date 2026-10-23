---
id: TASK-11
title: SSO/OIDC und Microsoft-Login aus allen Clients entfernen
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
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Die vorgesehenen Login-Wege sind E-Mail/Passwort, Google und Apple. iOS verwendet bislang auch die OIDC-Konfiguration.

Quellen: Umsetzung §§ 4, 6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 OIDC- und Microsoft-Konfiguration, Serverpfade und Login-Buttons sind entfernt.
- [ ] #2 iOS benötigt /api/oidc-config nicht mehr; E-Mail, Google und Apple bleiben verfügbar.
- [ ] #3 Typecheck, relevante Auth-Tests und betroffene Client-Prüfungen bestehen.

<!-- AC:END -->
