---
id: TASK-24
title: Brand-Regeln in Agent, MCP-Guide und Canvas-Memory einspeisen
status: Done
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-10-27T14:21:00Z'
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
ordinal: 1000
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
1. Globale Brand-Datei beim Boot laden und in Resident sowie MCP-Guide priorisieren.
2. Neue Canvases und Kopien mit persistentem, editierbarem prowin-brand ausstatten; lokale Inhalte erhalten.
3. Guideline-Limit in UI und Server auf 64000 Zeichen vereinheitlichen.
4. Regressionstests, Typecheck, Lint und Build prüfen; Task bis zur ausdrücklichen Nutzerabnahme offen lassen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-27: Umfang vom Nutzer freigegeben; Umsetzung im ausdrücklich gewünschten isolierten Worktree task-24-brand-injection. Bestands-Canvases, Fonts und Runtime-Tokens bleiben unverändert.

2026-10-27: Implementierung im isolierten Worktree task-24-brand-injection, Branch task/24-brand-injection. DESIGN-prowin.md wird beim Boot modulrelativ geladen und in beide Resident-Pfade sowie get_guide eingebunden; globale Regeln bleiben gegenüber lokalem Memory maßgeblich, Statusunterscheidungen der Quelle bleiben erhalten. Neue Canvases erhalten persistentes editierbares prowin-brand; Kopien ergänzen nur fehlende Defaults und erhalten lokale Inhalte/Titel/Positionen. Kein Nachsäen bei Hydration/Reads, keine Bestandsmigration. Gemeinsames 64000-Zeichen-Limit in UI/API/MCP/Resident-Vertrag; Boot-Guard verhindert uneditierbar große Default-Dokumente. Docker-Runtime-Datei ergänzt.
Verifikation: vollständige Suite ohne parallele Builds/Edits mit bun run test --maxWorkers=4: 168 Dateien / 1352 Tests grün (170,19s); keine Tests ausgelassen oder Timeouts erhöht. Vorheriger Default-Lauf hatte 13 Fünf-Sekunden-Timeouts in bootGuard/germanUiReview/legacyPagesMigration/prowinMigration, alle vier Dateien separat unverändert grün (22 Tests). Erster begrenzter Lauf parallel zu weiteren Checks/Edits hatte Browser-Navigationsfehler in drawingBrowser/elementPanelBrowser, abschließender isolierter Gesamtlauf grün. Details und exakte Befunde im Implementierungsplan docs/superpowers/plans/2026-10-27-brand-injection.md. Typecheck, Lint, Build, betroffene Formatprüfungen, doc-lint und git diff --check grün; bekannte Node-localStorage- und Build-Chunk-Warnungen bleiben.
Reviews: Hermione prüfte Gesamtintegration, CodeRabbit alle 20 Implementierungsdateien. Zwei Minor-Befunde (Resident-Limittext und Seed-Größenprüfung) mit RED/GREEN-Tests korrigiert; Leia bestätigte beide Korrekturen ohne Restbefunde. Keine Docker-Image-Erstellung, bezahlte Live-Modellanfrage oder manuelle Browserabnahme; keine Pushes/PRs/Merges. Task bleibt bis ausdrücklicher Nutzerabnahme In Progress.

2026-10-27: Backlog-Stand aus dem isolierten Implementierungs-Worktree in den Hauptcheckout übernommen, damit das dort gestartete Board dieselben Nachweise zeigt. Die Produktcodeänderungen liegen weiterhin im Branch task/24-brand-injection und im offenen PR #4: https://github.com/mmeister86/prowin_designer/pull/4 (Head 663c3bec32f1ac746d284749528276427baa0c00). Nicht nach main gemergt; diese Backlog-Aktualisierung integriert keinen Produktcode.
Implementiert und automatisiert geprüft: modulrelatives einmaliges Laden von DESIGN-prowin.md; vollständige globale Quelle in beiden Resident-Pfaden und MCP get_guide; expliziter Vorrang globaler Regeln unter Erhalt ihrer Quellen-/Statusunterscheidungen. Neue Canvases erhalten persistentes editierbares prowin-brand; Kopien ergänzen nur fehlende Defaults, lokale Inhalte/Titel/Positionen bleiben erhalten. Keine Nachrüstung von Bestands-Canvases, kein Nachsäen bei Reads/Hydration. Einheitliches 64000-Zeichen-Limit in UI/API/MCP/Resident, Startprüfung des vollständig gewrappten Defaults und Docker-Runtime-Datei ergänzt.
Nachweise: vollständiger abschließender Testlauf mit bun run test --maxWorkers=4: 168 Dateien / 1352 Tests erfolgreich; keine Tests ausgelassen oder Timeouts erhöht. Typecheck, Lint, Build, Formatprüfung, doc-lint und Diffprüfung erfolgreich. PR #4: alle neun CI-Prüfungen einschließlich vier Test-Shards und aggregiertem Tests-Check erfolgreich; zuletzt CLEAN/konfliktfrei, keine offenen Review-Threads. Frühere lokale Läufe hatten Last-/Browser-Timeouts; abschließender Lauf ohne parallele Builds/Edits grün. Lokale unabhängige Reviews und CodeRabbit-CLI-Review erfolgt; zwei Minor-Befunde mit RED/GREEN-Tests korrigiert und unabhängig nachgeprüft.
Online-Review-Grenzen: Greptile-Credits aufgebraucht, deshalb kein Greptile-Review; automatisches CodeRabbit-GitHub-Review übersprungen. T3-PR-Verknüpfung nach Neustart nicht verfügbar. Überwachung mit pr-wait nach grüner CI beendet, kein Merge vorgenommen.
Devbox-Wartung: auf ausdrücklichen Nutzerwunsch GitHub CLI 2.103.3 dauerhaft unter ~/.local/bin/gh installiert; offizielles Release per SHA-256 geprüft, bestehende Anmeldung und gh pr checks --json erfolgreich getestet. Debian-Systempaket unverändert; Benutzerinstallation wird nicht über APT aktualisiert.
Abnahme offen: AC1–3 sind anhand automatisierter Nachweise im Feature-Branch abgehakt, nicht als bereits in main ausgelieferter Stand zu verstehen. Manuelle Nutzerabnahme, Docker-Image-Build und bezahlter Live-Modelltest stehen aus. Status bleibt In Progress bis zur ausdrücklichen Nutzerbestätigung.

2026-10-27 Abschluss: Nutzer meldet den Merge und weist ausdrücklich an, TASK-24 auf Done zu setzen. GitHub bestätigt PR #4 (https://github.com/mmeister86/prowin_designer/pull/4) als MERGED am 27.10.2026 um 14:04:57 UTC; Merge-Commit dc22d7bb6f8554178193104b92106b52d3cd2cec. AC1–3 sind bereits anhand der dokumentierten automatisierten Nachweise abgehakt. Die vorherigen Hinweise auf offenen PR und ausstehende Abschlussfreigabe sind damit historisch; keine zusätzliche manuelle Testdurchführung behauptet. Vereinfachung geprüft: vorhandene Cache-, Editor- und Persistenzpfade wiederverwendet, keine neue generische Seed-Abstraktion oder zusätzliche Abhängigkeit erforderlich. Docker-Build und bezahlter Live-Modelltest wurden weiterhin nicht durchgeführt. Abschluss ausschließlich per Backlog-CLI im Hauptcheckout; keine anderen Tasks, Nutzeränderungen oder Git-Branches verändert.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Binde DESIGN-prowin.md als globale Quelle in beide Resident-Pfade und den MCP-Guide ein; ergänze persistentes, editierbares prowin-brand für neue Canvases und fehlende Kopie-Defaults. Erhalte lokale Anpassungen und Löschungen; vereinheitliche das Guideline-Limit auf 64.000 Zeichen und ergänze Docker-Runtime-Datei sowie Startvalidierung. Sichere die Integration mit Regressionstests ab: 1.352 Tests und neun PR-CI-Prüfungen erfolgreich. PR #4 ist gemergt; Abschluss am 27.10.2026 ausdrücklich vom Nutzer beauftragt. Fonts, Runtime-Tokens und Exportvalidierung bleiben separate Folgeaufgaben.
<!-- SECTION:FINAL_SUMMARY:END -->
