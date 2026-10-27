---
id: TASK-24
title: Brand-Regeln in Agent, MCP-Guide und Canvas-Memory einspeisen
status: In Progress
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-10-27T13:36:00Z'
labels:
  - prowin
  - implementation
milestone: m-3
dependencies:
  - TASK-23
  - TASK-16
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alle generierenden Zugänge sollen dieselben Markenregeln erhalten. Canvas-Memory darf die globale Brand-Quelle nicht versehentlich ersetzen.

Quellen: Umsetzung § 8.2; Referenz R4.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Resident-Systemprompt und get_guide enthalten beim Start die globale Brand-Datei.
- [x] #2 Neue Canvases erhalten ein sichtbares, editierbares GuidelineDoc prowin-brand; die globale Datei bleibt als Quelle erkennbar.
- [x] #3 Tests prüfen die Einspeisung in beide Agent-Zugänge und die Anlage ohne doppelte Guidelines.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Globale Brand-Quelle beim Boot laden und in Resident sowie MCP-Guide priorisieren.
2. Neue Canvases und Kopien mit persistentem prowin-brand ausstatten; lokale Inhalte erhalten.
3. Guideline-Limit in UI und Server auf 64000 Zeichen vereinheitlichen.
4. Regressionstests, Typecheck, Lint und Build prüfen; Task bis Nutzerabnahme offen lassen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-27: Umfang vom Nutzer freigegeben; Umsetzung im ausdrücklich gewünschten isolierten Worktree task-24-brand-injection. Bestands-Canvases, Fonts und Runtime-Tokens bleiben unverändert.

2026-10-27: Implementierung im isolierten Worktree task-24-brand-injection, Branch task/24-brand-injection. DESIGN-prowin.md wird beim Boot modulrelativ geladen und in beide Resident-Pfade sowie get_guide eingebunden; globale Regeln bleiben gegenüber lokalem Memory maßgeblich, Statusunterscheidungen der Quelle bleiben erhalten. Neue Canvases erhalten persistentes editierbares prowin-brand; Kopien ergänzen nur fehlende Defaults und erhalten lokale Inhalte/Titel/Positionen. Kein Nachsäen bei Hydration/Reads, keine Bestandsmigration. Gemeinsames 64000-Zeichen-Limit in UI/API/MCP/Resident-Vertrag; Boot-Guard verhindert uneditierbar große Default-Dokumente. Docker-Runtime-Datei ergänzt.
Verifikation: vollständige Suite ohne parallele Builds/Edits mit bun run test --maxWorkers=4: 168 Dateien / 1352 Tests grün (170,19s); keine Tests ausgelassen oder Timeouts erhöht. Vorheriger Default-Lauf hatte 13 Fünf-Sekunden-Timeouts in bootGuard/germanUiReview/legacyPagesMigration/prowinMigration, alle vier Dateien separat unverändert grün (22 Tests). Erster begrenzter Lauf parallel zu weiteren Checks/Edits hatte Browser-Navigationsfehler in drawingBrowser/elementPanelBrowser, abschließender isolierter Gesamtlauf grün. Details und exakte Befunde im Implementierungsplan docs/superpowers/plans/2026-10-27-brand-injection.md. Typecheck, Lint, Build, betroffene Formatprüfungen, doc-lint und git diff --check grün; bekannte Node-localStorage- und Build-Chunk-Warnungen bleiben.
Reviews: Hermione prüfte Gesamtintegration, CodeRabbit alle 20 Implementierungsdateien. Zwei Minor-Befunde (Resident-Limittext und Seed-Größenprüfung) mit RED/GREEN-Tests korrigiert; Leia bestätigte beide Korrekturen ohne Restbefunde. Keine Docker-Image-Erstellung, bezahlte Live-Modellanfrage oder manuelle Browserabnahme; keine Pushes/PRs/Merges. Task bleibt bis ausdrücklicher Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
