---
id: TASK-73
title: Stabilisiere parallele Browser-Tests
status: In Progress
assignee: []
created_date: '2026-10-28T11:29:00Z'
updated_date: '2026-11-26T12:00:00Z'
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
- [x] #1 Ursache der Fixture-Start-Timeouts mit einem reproduzierbaren Testlauf belegen.
- [x] #2 Browser-Testserver und benötigte Caches so isolieren, dass parallele Läufe keine gegenseitigen Reloads auslösen.
- [x] #3 Vollständigen Testlauf mit vier Workern ohne Browser-Startfehler oder übersprungene Browser-Fälle prüfen.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-75 / 28.10.2026, Code-HEAD 43d3e6934cd09c4db67950529ec008ad5cd2b23a: Zusätzliche Startfehler ohne Änderung an tests/frameLocalEdits.test.ts oder tests/harness.ts beobachtet. Frischer Controller-Gesamtlauf mit bun run test --maxWorkers=2 --testTimeout=30000: Exit 1, 178 Dateien bestanden / 1 Suite fehlgeschlagen, 1463 Tests bestanden / 1 übersprungen. beforeAll in tests/frameLocalEdits.test.ts:32 wartet 30000 ms vergeblich auf window.elementPanelHarness. Unveränderter diagnostischer Nachlauf mit --maxWorkers=1: 1 Datei / 1 Test bestanden. Vorheriger Implementer-Gesamtlauf am selben Code-HEAD: 179 Dateien / 1464 Tests bestanden, keine Skips. Kein grüner Nachlauf überschreibt den fehlgeschlagenen Gesamtlauf; gemeinsame Ursache mit TASK-73 ist plausibel, aber nicht belegt. Keine pauschalen Timeout-/Parallelitäts-/Harness-Änderungen vorgenommen.
Weiteres Signal aus TASK-75 Task 3: pageControlsBrowser-Setup konnte Port 39347 nicht binden; 1450 bestanden / 2 übersprungen, unveränderter gezielter Nachlauf bestanden. Der Harness verwirft Child-stderr; Originalursache unbewiesen. Diagnostik beim künftigen Fix erhalten.
Follow-up: Baseline-Node-localStorage-Warnungen (tests/setup.ts greift Node-Getter an), localhost ECONNREFUSED ::1:3000 / 127.0.0.1:3000 und Happy-DOM-Teardown-AbortError getrennt den verursachenden Fixtures zuordnen. Beide letzteren erscheinen bereits in der Baseline; genauer Besitzer weiterhin unbewiesen. Nicht nur unterdrücken. Nachweise: docs/superpowers/reports/2026-10-28-canvas-image-references.md und lokale .superpowers/sdd/2026-10-28-canvas-image-references/controller-*.log. Status bleibt To Do; keine Umsetzung dieses Follow-ups in TASK-75.

Follow-up aus TASK-37 Council (07.11.2026): Pflichtlauf mit maxWorkers=4 zeigte 15 Fehler in elementResizeBrowser (11), drawingBrowser (1), elementPanelBrowser (2), safeZoneBrowser (1). Seriell alle 112 bestanden; erneuter vollständiger Lauf ohne parallele Repository-Dateiänderungen 2160/2160 bestanden. Undefined Harness/DOM-Kontextverlust und Timing beobachtet; Vite-Reload durch gleichzeitige Dokumentations-/Backlog-Änderungen ist nur Hypothese, Ursache unbewiesen. Keine Fixture-/Produktänderung in TASK-37. Details docs/prowin/m4-abnahme.md.
26.11.2026 (Branch fix/task-73-browser-test-isolation, Basis main 5d82cce): Ursache belegt. Alle 21 Suites mit echtem Chromium starten je einen Vite-Dev-Server im Checkout-Root mit aktivem Datei-Watcher und HMR. Reproduktion: nur die 17 *Browser-Suites mit --maxWorkers=4, dabei alle 2 s `touch src/lib/utils.ts` -> 5 Dateien / 33 von 164 Tests rot (Harness-/Selector-Timeouts in elementPanelBrowser, drawingBrowser, pageControlsBrowser, framePresetBrowser, safeZoneBrowser). Derselbe Lauf ohne touch: 17/17 Dateien, 164/164 Tests grün. Fix: `tests/browserVite.ts` (`createBrowserVite`) setzt `server.watch: null` und `hmr: false`; alle 21 Vite-Starts in tests/ nutzen ihn. Kontrolllauf mit Fix und touch alle 2 s: 164/164 grün. Keine Timeouts, Worker-Zahlen oder Produktcode geändert. Getrennte Vite-Caches pro Suite nicht nötig, solange kein Reload ausgelöst wird; die Fonttests behalten ihre eigenen Caches. Abnahmelauf mit Fix (währenddessen Doku-/Backlog-Dateien geändert): `bun run test --maxWorkers=4 --exclude tests/claudeExtension.test.ts` 239 Dateien / 2160 Tests grün, keine übersprungenen Browser-Fälle; `tests/claudeExtension.test.ts --maxWorkers=1` 4/4 grün. Status bleibt bis zur Nutzerbestätigung In Progress. Offen bleiben die Follow-ups zu localStorage-Warnungen, ECONNREFUSED :3000 und Happy-DOM-AbortError (nicht Teil dieses Fixes).
<!-- SECTION:NOTES:END -->
