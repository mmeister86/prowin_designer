---
id: TASK-68.1
title: Übersetze Web-Seiten, Navigation und gemeinsame UI ins Deutsche
status: In Progress
assignee: []
created_date: '2026-10-25T19:51:00Z'
updated_date: '2026-10-25T23:21:00Z'
labels: []
dependencies: []
parent_task_id: TASK-68
priority: medium
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Anmeldung, Home, Workspace, Community, Admin, Einstellungen, Desktop-Handoff, optionale Seiten, Navigation, Kontoverwaltung, Verbindungsanleitungen, Integrationen und UI-Standardtexte übersetzen. index.html und sichtbare Extension-Metadaten einbeziehen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Alle Texte im zugewiesenen Bereich einschließlich aria-label, Tooltips und Bestätigungen sind deutsch.
- [x] #2 Anmelde-, Navigations- und Dialogtests prüfen die deutschen Texte; technische Werte und Optionen bleiben kompatibel.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Deutsche UI- und Auth-Regressionen zunächst rot nachweisen.
2. Alle zugewiesenen Web-Seiten und Komponenten übersetzen, Auth-Fehlerhelper integrieren.
3. Fokus-/Gesamttests, Typecheck und unabhängiger Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Web-Seiten und zugewiesene UI vollständig übersetzt. Auth-Helper, deutsche Accessibility/Metadaten und unveränderte Select-Werte geprüft. Leia-Review plus eine Fixrunde: I1-I3 und M1 korrigiert; Nachprüfung spec compliant/quality Approved.82 fokussierte Tests bestanden, Typecheck/Lint/Build grün. Native String-Schnittstelle für TASK-68.4 im Report115-128 dokumentiert. Parallele Timeouts seriell bestanden; manuelle Abnahme offen.

26.10.2026: Finale breite Prüfung plus gemeinsame Korrekturwelle und unabhängige scoped Nachprüfung abgeschlossen; keine offenen Critical-/Important-Befunde. Controller-Vollsuite165Dateien/1309Tests bestanden; Typecheck, Gesamt-Lint und Web-Build erneut grün. Produkt-/Teststand unverändert zum geprüften Snapshot. Native Builds und echte externe Dienste bleiben gemäß Prüfprotokoll offen. Keine Nutzerabnahme; Status bleibt In Progress.
<!-- SECTION:NOTES:END -->
