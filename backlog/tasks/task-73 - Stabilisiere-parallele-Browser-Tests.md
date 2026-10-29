---
id: TASK-73
title: Stabilisiere parallele Browser-Tests
status: To Do
assignee: []
created_date: '2026-10-28T11:29:00Z'
updated_date: '2026-10-28T22:10:00Z'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-75 / 28.10.2026, Code-HEAD 43d3e6934cd09c4db67950529ec008ad5cd2b23a: Zusätzliche Startfehler ohne Änderung an tests/frameLocalEdits.test.ts oder tests/harness.ts beobachtet. Frischer Controller-Gesamtlauf mit bun run test --maxWorkers=2 --testTimeout=30000: Exit 1, 178 Dateien bestanden / 1 Suite fehlgeschlagen, 1463 Tests bestanden / 1 übersprungen. beforeAll in tests/frameLocalEdits.test.ts:32 wartet 30000 ms vergeblich auf window.elementPanelHarness. Unveränderter diagnostischer Nachlauf mit --maxWorkers=1: 1 Datei / 1 Test bestanden. Vorheriger Implementer-Gesamtlauf am selben Code-HEAD: 179 Dateien / 1464 Tests bestanden, keine Skips. Kein grüner Nachlauf überschreibt den fehlgeschlagenen Gesamtlauf; gemeinsame Ursache mit TASK-73 ist plausibel, aber nicht belegt. Keine pauschalen Timeout-/Parallelitäts-/Harness-Änderungen vorgenommen.
Weiteres Signal aus TASK-75 Task 3: pageControlsBrowser-Setup konnte Port 39347 nicht binden; 1450 bestanden / 2 übersprungen, unveränderter gezielter Nachlauf bestanden. Der Harness verwirft Child-stderr; Originalursache unbewiesen. Diagnostik beim künftigen Fix erhalten.
Follow-up: Baseline-Node-localStorage-Warnungen (tests/setup.ts greift Node-Getter an), localhost ECONNREFUSED ::1:3000 / 127.0.0.1:3000 und Happy-DOM-Teardown-AbortError getrennt den verursachenden Fixtures zuordnen. Beide letzteren erscheinen bereits in der Baseline; genauer Besitzer weiterhin unbewiesen. Nicht nur unterdrücken. Nachweise: docs/superpowers/reports/2026-10-28-canvas-image-references.md und lokale .superpowers/sdd/2026-10-28-canvas-image-references/controller-*.log. Status bleibt To Do; keine Umsetzung dieses Follow-ups in TASK-75.
<!-- SECTION:NOTES:END -->
