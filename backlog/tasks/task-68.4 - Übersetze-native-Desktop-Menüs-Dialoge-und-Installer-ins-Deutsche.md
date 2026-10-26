---
id: TASK-68.4
title: Übersetze native Desktop-Menüs, Dialoge und Installer ins Deutsche
status: In Progress
assignee: []
created_date: '2026-10-25T19:51:00Z'
updated_date: '2026-10-25T23:21:00Z'
labels: []
dependencies: []
parent_task_id: TASK-68
priority: medium
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tauri-/Rust-Nutzertexte und Installationsoberflächen einschließlich DMG-Grafik und Windows-Installer-Sprache übersetzen; Endpunkte und Produktidentitäten nicht ändern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Eigene native Menü- und Dialogtexte sowie ausgelieferte Installer-Texte sind deutsch.
- [x] #2 Prüfungen und fehlende Plattform-Buildmöglichkeiten sind dokumentiert; reine HTML-Änderung ohne Aktualisierung der DMG-Grafik reicht nicht.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Native Text-/Installer-Produzenten und UI-Schnittstellen prüfen, rote Ressourcenchecks.
2. Menü/Dialog/Installer übersetzen und DMG-Grafik neu rendern.
3. Statische/native verfügbare Prüfungen, vollständige Tests und unabhängiger Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Native Desktop-Texte, Menü/Exportpanel, deutsche Bundle-/NSIS-Ressourcen und tatsächliche DMG-PNG übersetzt. Ripley: spec compliant, quality Approved, keine wichtigen Befunde. JS-Vollsuite160Dateien/1263Tests, Typecheck/Lint/Build grün. Cargo/rustfmt/makensis/xcodebuild fehlen; native Builds und echte Installationen explizit offen. Bestehende Desktop-Remote-URL unverändert. Keine Nutzerabnahme.

26.10.2026: Finale breite Prüfung plus gemeinsame Korrekturwelle und unabhängige scoped Nachprüfung abgeschlossen; keine offenen Critical-/Important-Befunde. Controller-Vollsuite165Dateien/1309Tests bestanden; Typecheck, Gesamt-Lint und Web-Build erneut grün. Produkt-/Teststand unverändert zum geprüften Snapshot. Native Builds und echte externe Dienste bleiben gemäß Prüfprotokoll offen. Keine Nutzerabnahme; Status bleibt In Progress.
<!-- SECTION:NOTES:END -->
