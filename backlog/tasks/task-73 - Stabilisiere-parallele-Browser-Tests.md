---
id: TASK-73
title: Stabilisiere parallele Browser-Tests
status: To Do
assignee: []
created_date: '2026-10-28T11:29:00Z'
labels: []
dependencies: []
priority: medium
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Beim vollständigen Testlauf zu TASK-26 mit vier Workern schlagen Browser-Fixtures sporadisch beim Start fehl: elementPanelHarness nach 5s und drawingHarness nach 10s nicht verfügbar. Betroffene Tests bestehen in gezielten Nachläufen. Ursache (Vite-Cache-/Reload-Konkurrenz und Laufzeitlast) eingrenzen, ohne globale Timeouts pauschal zu erhöhen. Die neuen Fonttests verwenden bereits getrennte Vite-Caches.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ursache der Fixture-Start-Timeouts mit einem reproduzierbaren Testlauf belegen.
- [ ] #2 Browser-Testserver und benötigte Caches so isolieren, dass parallele Läufe keine gegenseitigen Reloads auslösen.
- [ ] #3 Vollständigen Testlauf mit vier Workern ohne Browser-Startfehler oder übersprungene Browser-Fälle prüfen.
<!-- AC:END -->
