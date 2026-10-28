---
id: TASK-76
title: Bewerte die Größe des Web-Bundles
status: To Do
assignee: []
created_date: '2026-10-28T22:10:00Z'
labels: []
dependencies: []
priority: low
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Untersuche die bestehende Vite-Warnung aus der TASK-75-Abschlussprüfung: main JS 960,94 kB minifiziert / 299,15 kB gzip überschreitet die 500-kB-Warnschwelle. Der Build besteht; ein Laufzeitproblem oder eine Feature-Regression ist nicht nachgewiesen. Prüfe Nutzen und Kosten einer Aufteilung, statt im Referenzfeature ungefragt Chunking oder Grenzwerte zu verändern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dokumentiere Bundle-Anteile und gemessene Auswirkungen auf Start beziehungsweise Laden.
- [ ] #2 Begründe anhand der Messwerte, ob eine Optimierung nötig ist; unterdrücke die Warnung nicht lediglich per höherem Grenzwert.
<!-- AC:END -->
