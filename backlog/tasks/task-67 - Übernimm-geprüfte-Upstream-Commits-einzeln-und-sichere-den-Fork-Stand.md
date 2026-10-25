---
id: TASK-67
title: Übernimm geprüfte Upstream-Commits einzeln und sichere den Fork-Stand
status: In Progress
assignee: []
created_date: '2026-10-25T12:19:00Z'
updated_date: '2026-10-25T12:19:00Z'
labels: []
dependencies: []
priority: high
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Den Stand 2272d9d als Backup erhalten und die 17 geprüften Web-/Server-Commits bis aa04e95 einzeln mit Tests und unabhängigen Reviews in einem isolierten Branch übernehmen. iOS bf3ebac bleibt bis zu einem iOS-Build zurückgestellt. Keine Wiederaufnahme entfernter Integrationen; kein Push oder Merge nach main.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backup-Branch und externes Git-Bundle sind erstellt und verifiziert
- [ ] #2 Alle 17 ausgewählten Upstream-Commits sind einzeln mit Herkunft und gezielten Testergebnissen dokumentiert
- [ ] #3 Requesty, PII-Redaktion, Boot-Guard, Creator-Rechte und entfernte Integrationen bleiben erhalten
- [ ] #4 Abschließende Tests, Typecheck, Lint, Build und unabhängiges Gesamt-Review sind dokumentiert
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Backup verifizieren und isolierten Branch mit sauberer Test-Baseline vorbereiten
2. Die 17 Web-/Server-Commits bis aa04e95 einzeln mit gezielten Tests und Reviews übernehmen
3. Vollständige Tests und Fork-Regressionsprüfungen ausführen
4. Gesamt-Review und Übergabe ohne Push/Merge; Status bis manueller Bestätigung In Progress lassen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backup: refs/heads/backup/pre-upstream-2026-10-25-2272d9d; externes und verifiziertes Bundle /home/matthias/code/prowin_designer-backups/pre-upstream-2026-10-25-2272d9d.bundle. Ausgangs-HEAD 2272d9d3056588c92af5c1a28974bdb04d90fe5c. Git-Backup enthält Versionshistorie; ignorierte .env-/Laufzeitdaten werden nicht verändert und sind nicht Teil des Bundles.
<!-- SECTION:NOTES:END -->
