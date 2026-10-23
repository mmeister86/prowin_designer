---
id: TASK-1
title: Devbox einrichten und lokalen Kernablauf prüfen
status: Done
assignee: []
created_date: '2026-10-23T09:49:00Z'
labels:
  - prowin
  - implementation
milestone: m-0
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Die Devbox ist die Grundlage für den Fork-Umbau. Lokal genügt PGlite; die Erreichbarkeit vom Mac erfolgt über Tailscale.

Quellen: Umsetzung §§ 5, 14 (M0)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 bun install und bun run dev funktionieren mit Web auf 4300 und API/WS/MCP auf 4400.
- [x] #2 Login und Canvas-Anlage sind vom Mac über Tailscale geprüft; Daten bleiben nach Neustart erhalten.
- [x] #3 Nicht benötigte Integrationen, fremde Modell-Keys und Stripe sind gemäß § 5.1 deaktiviert; keine Secrets sind versioniert.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

2026-10-23: Vom Nutzer als erledigt abgenommen: „läuft alles, ich kann mich einloggen, .env ist
aufgeräumt“. Abschluss und Akzeptanzkriterien basieren auf dieser Nutzerabnahme; keine erneute
technische Prüfung durch den Agenten.
<!-- SECTION:NOTES:END -->
