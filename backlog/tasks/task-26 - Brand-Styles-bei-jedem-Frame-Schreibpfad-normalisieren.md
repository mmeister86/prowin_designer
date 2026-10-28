---
id: TASK-26
title: Brand-Styles bei jedem Frame-Schreibpfad normalisieren
status: In Progress
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-10-28T12:35:00Z'
labels:
  - prowin
  - implementation
milestone: m-3
dependencies:
  - TASK-23
  - TASK-25
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Frame-HTML ist die gemeinsame Wahrheit aller Renderer. Brand-Styles dürfen sich weder vervielfachen noch über alternative Schreibpfade fehlen.

Quellen: Umsetzung § 8.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Alle relevanten Schreib- und Commit-Pfade erzeugen genau einen style-Block data-od-brand mit Fonts und Tokens und entfernen externe Font-Links.
- [x] #2 Wiederholtes Speichern verändert das Ergebnis nicht; bestehender Inhalt bleibt erhalten.
- [x] #3 Eine wiederholbar sichere Migration aktualisiert vorhandene Frames; Tests decken neue und bestehende Frames sowie mehrere Schreibpfade ab.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Vorhandene Kernfont-Bereitstellung aus TASK-25 als Voraussetzung übernehmen.
2. Zentrale byte-erhaltende Brand-Normalisierung und gezielte Tests erstellen.
3. Store, Kopien, Restore und Streaming mit Rohdatenpuffer integrieren.
4. Wiederholbar sichere Boot-Migration vor Hydration implementieren und testen.
5. Relevante Tests, Typecheck, Build und Lint prüfen; Abnahme offenlassen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-28: Arbeit gestartet. TASK-23 ist Done; TASK-25 (selbst gehostete Fonts, konkrete Dateien und Renderer-Parität) ist noch To Do. Bestehende Brand-Einspeisung aus TASK-24 liefert Markdown, aber noch keine Runtime-Tokens oder Font-CSS. Bestandsaufnahme läuft; Umfang der Font-Anbindung wird vor Produktcodeänderungen im Entwurf abgegrenzt.

2026-10-28: Bestandsaufnahme durch Dana Scully abgeschlossen. Zentrale Pfade: Store createFrame/updateFrame sowie Canvas-/Seitenkopien; Restore und Streaming in actions.ts. Risiko: Normalisierung pro Chunk ohne Rohdatenpuffer beschädigt geteilte Tags; Persistenz-only erzeugt unterschiedliche Speicher-/DB-Inhalte. Konkreter Entwurf: docs/superpowers/specs/2026-10-28-backlog-26-design.md. Nutzerentscheidung angefragt: TASK-25 zuerst bearbeiten (empfohlen) oder TASK-26 vorbereiten und Fontintegration offenlassen. Keine Produktcodeänderungen; alle AC bleiben offen.

2026-10-28 Korrektur nach Nutzerhinweis: TASK-25 ist inhaltlich weitgehend umgesetzt; nur LumiosBrush-Regular und LTKai-Regular fehlen. Separaten Worktree /home/matthias/.local/share/opencode/worktree/9d3066/task-25-brand-fonts gelesen: 12 statische Kern-WOFF2-Dateien für Sofia Sans 300/500, Sofia Sans Condensed 700 und Roboto 300/500/900, jeweils Latin/Latin-Ext, sowie Fontauslieferung und dokumentierte Browser-/Chromium-/Blitz-Prüfungen vorhanden. Ursprünglicher Blocker bezog sich irrtümlich ausschließlich auf main. TASK-26 kann auf diesem vorhandenen Vertrag aufbauen; keine erneute TASK-25-Grundimplementierung nötig. Zwei zusätzliche Fonts bleiben Restarbeit von TASK-25; fremden Worktree nicht verändert. Entwurf korrigiert, Tests anderer Arbeit nur gelesen und nicht erneut ausgeführt.

2026-10-28: Nutzer hat mit „Kannst du dann fortfahren“ die Fortsetzung autorisiert. Umsetzung auf Branch task/26-brand-normalization. Vorhandene TASK-25-Kernfontbereitstellung wird als Voraussetzung übernommen; zusätzliche zwei Fonts bleiben bei TASK-25. Keine Schließung von TASK-25 oder TASK-26.

2026-10-28 Umsetzung: gemeinsame tagbewusste HTML-Bearbeitung in shared/frameBrandHtml.ts; serverseitig kanonisches CSS mit 13 CI-Tokens und 12 vorhandenen Kernfontfaces. Store normalisiert Create, Update, Canvas- und Seitenkopie vor Persistenz. Actions führen separate Streaming-Rohdaten, ignorieren Brand-CSS bei Designähnlichkeit und normalisieren Restore. Boot-Migration nach Legacy-Import und vor Store.init arbeitet in 100er-Batches mit inhaltsbedingten Updates; Autor/Zeitstempel/Historienoriginale bleiben erhalten. Leere Frames bleiben in UI und MCP leer; UI-Prüfung ist pro HTML-Änderung memoisiert. TASK-25-Voraussetzungen unverändert übernommen, dessen Worktree bleibt unberührt. Zwei CodeRabbit-Prüfungen durchgeführt: Zeichnungs-/Pfadkompatibilität durch Tests bestätigt; gemeinsame Empty-Erkennung vereinheitlicht; SVG-CDATA und CSS-Import-Kommentare durch Regressionstests abgesichert. Erweiterter Nachlauf: 5 Dateien/84 Tests grün; Nachlauf der zuvor auffälligen Gesamttest-Dateien: 9 Dateien/98 Tests grün. Typecheck, Lint und Build grün; abschließender Gesamtlauf noch in Auswertung.

2026-10-28 Technische Verifikation abgeschlossen: 5 Dateien/84 Tests für Normalisierung, Writes, Migration, Zeichnungen und Pfade grün; 9 Dateien/26 reale HTML-, Versions-, Kopier-, Font- und Runtime-Tests grün. Browser-Nachlauf: 71 Tests grün; zunächst ausgelassene 2 Font-Paritätstests nach Setup-Korrektur separat ebenfalls grün. Neue Fonttest-Vite-Caches sind isoliert. Vollständiger Lauf mit 4 Workern/30s Testtimeout: 171/173 Dateien grün, 1343 Tests bestanden, 1 Browserfall fehlgeschlagen und 41 Browserfälle wegen Fixture-Start-Timeout ausgelassen. Diese Fälle bestehen im gezielten Nachlauf; Gesamtsuite ausdrücklich nicht als grün behauptet. Restinstabilität separat als TASK-73 (To Do) erfasst. Typecheck, Lint und Build bestanden; git diff --check sauber. AC1 technisch auf dem vorhandenen TASK-25-Kernfontvertrag geprüft; LumiosBrush-Regular und LTKai-Regular bleiben Restarbeit von TASK-25. Details und Prüfgrenzen in docs/superpowers/specs/2026-10-28-backlog-26-design.md. Kein Commit/Push/PR. TASK-26 bleibt In Progress bis zur ausdrücklichen manuellen Nutzerabnahme.

2026-10-28: Nutzer hat ausdrücklich das Zusammenführen der Ergebnisse von TASK-25 und TASK-26 nach main angefordert. Arbeitsstände werden separat committed und zusammengeführt; die gegenüber TASK-25 verbesserten Fonttests mit isolierten Vite-Caches bleiben erhalten. Keine automatische Abnahme oder Statusänderung auf Done.

2026-10-28 Integration: TASK-26 als Commit c8d945b gesichert. TASK-25 (00deb31) wird vollständig in denselben Integrationsstand übernommen. Zwei Add/Add-Konflikte in den Fonttests zugunsten der neueren TASK-26-Version mit isolierten Caches aufgelöst; keine offenen Merge-Konflikte. Gezielte Integrationsprüfung vor Übernahme nach main läuft. Status bleibt In Progress.

2026-10-28 Merge-Verifikation: 14 Dateien/110 gezielte Tests grün; Typecheck, Lint und Build grün. Dieser geprüfte Stand wird auf ausdrücklichen Nutzerwunsch nach main übernommen. Bekannte Parallelitätsprobleme der Gesamtsuite bleiben unter TASK-73 dokumentiert; keine erneute vollständige Suite und keine automatische Abnahme.
<!-- SECTION:NOTES:END -->
