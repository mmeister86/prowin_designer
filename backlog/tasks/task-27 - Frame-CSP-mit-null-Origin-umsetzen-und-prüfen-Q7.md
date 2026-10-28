---
id: TASK-27
title: Frame-CSP mit null-Origin umsetzen und prüfen (Q7)
status: Done
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-10-28T14:14:00Z'
labels:
  - prowin
  - implementation
milestone: m-3
dependencies:
  - TASK-25
  - TASK-26
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
srcDoc-Frames ohne allow-same-origin haben Origin null. Eine CSP nur mit self würde legitime Assets blockieren und muss mit dem Sandbox-Bootstrap abgestimmt werden.

Quellen: Umsetzung §§ 7.6, 17 (Q7)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Externe Fonts, Bilder und Skripte sind blockiert; Instanz-Assets, data und blob funktionieren im vorgesehenen Umfang.
- [x] #2 Notwendiger Frame-Bootstrap, Element-Auswahl und Editor-Kommunikation funktionieren ohne Erweiterung auf beliebige externe Hosts.
- [x] #3 Tests mit null-Origin und fremden Ressourcen sowie ein Browser-Smoke-Test belegen die Policy.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Gemeinsame Frame-CSP und Vorschau-Integration mit Browser-Sicherheitstests spezifizieren (RED).
2. Explizite Instanz-Origin erlauben; Bootstrap und alle srcDoc-Vorschauen absichern (GREEN).
3. Null-Origin, Fremdressourcen, DOM-Updates, Auswahl und Editor-Kommunikation im Chromium-Smoke-Test prüfen.
4. Gesamtsuite, Typecheck und Review ausführen; Nachweise dokumentieren. Status bleibt bis Nutzerabnahme In Progress.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Umsetzung auf Branch task-27-frame-csp; vorhandene uncommittete Änderungen aus TASK-25/26 bleiben erhalten.
Gemeinsame Policy in src/lib/framePolicy.ts vor FRAME_BOOTSTRAP und allen vier passiven srcDoc-Stellen (Verlauf, zwei Memory-Vorschauen, Zeichnungsverschiebung). Exakte Instanz-Origin statt self; data/blob nur für Bilder/Fonts/Medien; Unterframes, Worker und Formulare gesperrt. Inline-Designskripte bleiben absichtlich erlaubt, Sandbox unverändert ohne allow-same-origin.
TDD: Browsertest zunächst ohne CSP an fehlenden Verstößen gescheitert, anschließend grün. Chromium: 5 neue Smoke-Tests plus bestehende Runtime/Visibility/Fontparität: 10/10 grün. Typecheck und Lint grün.
Unabhängiges read-only Review (Leia): keine konkreten Bugs; Bild-Redirects getestet, Redirects anderer Assettypen und echte UI-Verdrahtung nicht separat automatisiert. Grenzen dokumentiert in docs/prowin/frame-csp.md.
Gesamtsuite erster Lauf: parallele Timeouts, nach 120 Sekunden abgebrochen; Wiederholung mit --maxWorkers=2 läuft. Keine Freigabe zur Task-Schließung, kein Commit/Push angefordert.

Finaler gezielter Lauf: 5 Dateien / 15 Tests grün (framePolicy, frameCspBrowser, frameRuntimeBody, frameVisibilityBrowser, prowinFontsBrowser; --maxWorkers=2). Erneuter Typecheck und Lint grün. Produktionsbuild grün (bekannte Bundle-Größenwarnung). Doc-Lint grün mit Stale-Context-Docs-Hinweis. git diff --check grün. Alle drei AC technisch verifiziert; Status bleibt In Progress bis zur ausdrücklichen manuellen Nutzerabnahme. Gesamtsuite mit zwei Workern läuft weiterhin.

Gesamtsuite mit zwei Workern meldet Fehler in drawingBrowser.test.ts (1 Test) und elementResizeBrowser.test.ts (34 Tests). Beide Dateien anschließend gezielt seriell erneut ausgeführt: 65/65 Tests grün (58,66 s), keine CSP-Regression reproduzierbar. Gesamtlauf noch nicht abgeschlossen; daher keine Aussage, dass die gesamte Suite grün ist. Vollständiges Log: /tmp/opencode/task-27-tests-full.log; serielle Wiederholung: /tmp/opencode/task-27-browser-regressions.log.

Abschließender Gesamtlauf ohne parallele Dateiänderungen: bun run test --maxWorkers=2 → 175/175 Testdateien und 1397/1397 Tests grün (304,64 Sekunden). Log: /tmp/opencode/task-27-tests-stable.log. Der vorherige fehlerhafte Lauf verlor Browser-Harness-Kontexte während paralleler Änderungen; kein Fehler im stabilen Lauf reproduziert.
Alle AC abgehakt, Nachweise und Grenzen in docs/prowin/frame-csp.md. Manuelle Abnahme, Firefox/WebKit und Desktop-Paket nicht durchgeführt. Änderungen bleiben lokal uncommittet auf task-27-frame-csp; bestehende TASK-25/26-Arbeit wurde nicht verworfen. Task bleibt ausdrücklich In Progress.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Add instance-only CSP to editor, presentation and passive previews; preserve opaque-origin sandbox and editor messaging. Verify 1397 tests, typecheck, lint, build and independent security review. User explicitly approved task closure and integration into main on 2026-10-28. Chromium tested; Firefox/WebKit, desktop package and complete navigation isolation remain outside the verified scope.
<!-- SECTION:FINAL_SUMMARY:END -->
