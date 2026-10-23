---
id: TASK-61
title: Stripe und monatliche Workspace-Kontingente aktivieren
status: To Do
assignee: []
created_date: '2026-10-23T09:56:00Z'
labels:
  - prowin
  - post-mvp
  - billing
milestone: m-8
dependencies:
  - TASK-60
  - TASK-22
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Vorhandenes Stripe-Billing und Allowance-System werden an freigegebene Tarife angepasst, statt einen neuen Zahlungsanbieter einzuführen.

Quellen: Umsetzung § 7.3; Referenz R1.9, R4.5, R6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Freigegebene Pläne und Limits gelten pro Workspace/Monat und werden serverseitig durchgesetzt.
- [ ] #2 Planwechsel, Monatsreset, parallele Nutzung und wiederholte Zahlungs-Webhooks führen nicht zu falschen Kontingenten.
- [ ] #3 UI zeigt Limits und Upgrades konsistent; upgrade_clicked, Datenschutzunterlagen und Egress-Freigabe sind angepasst.
- [ ] #4 Stripe-Testmodus belegt Abrechnung und Fehlerfälle vor einer ausdrücklich freigegebenen Live-Aktivierung.

<!-- AC:END -->
