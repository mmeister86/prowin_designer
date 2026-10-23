---
id: TASK-49
title: Backups und Wiederherstellung der Testinstanz prüfen
status: To Do
assignee: []
created_date: '2026-10-23T09:53:00Z'
labels:
  - prowin
  - implementation
milestone: m-6
dependencies:
  - TASK-48
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Automatische Datenbank-Backups allein schützen die lokal gespeicherten Bildassets nicht. Wiederherstellbarkeit muss vor dem Test belegt sein.

Quellen: Umsetzung § 13
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Postgres-Backups sind aktiviert; persistente Assets und notwendige Deployment-Konfiguration sind in der Wiederherstellung berücksichtigt.
- [ ] #2 Ein Restore in einer separaten Umgebung stellt Login, Canvas und zugehörige Assets erfolgreich wieder her.
- [ ] #3 Backup-Intervall, Aufbewahrung und Wiederherstellungsablauf sind dokumentiert.

<!-- AC:END -->
