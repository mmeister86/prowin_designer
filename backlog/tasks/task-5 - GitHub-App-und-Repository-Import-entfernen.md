---
id: TASK-5
title: GitHub-App und Repository-Import entfernen
status: Done
assignee: []
created_date: '2026-10-23T09:49:00Z'
labels:
  - prowin
  - implementation
milestone: m-1
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Die GitHub-App ist eine entfallende Produktintegration; das Git-Repository und der Coolify-Deploy-Zugang bleiben davon unabhängig.

Quellen: Umsetzung § 6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 githubApp, githubRecon, zugehörige Routen und Import-Quelle GitHub repo sind entfernt.
- [x] #2 Die Migration für github_connections ist auf einer bestehenden Datenbank geprüft; Auswirkungen auf gespeicherte Verbindungen sind dokumentiert.
- [x] #3 Konfiguration, Aufrufer und Tests sind bereinigt; Typecheck und relevante Tests bestehen.

<!-- AC:END -->

## Umsetzung

Migration 0036 an bestehenden Verbindungen, Frames und offenen Importaufträgen geprüft; wiederholter Migrator-Lauf erfolgreich. Importaufträge werden historisiert, nicht als normale Prompts ausgeführt. Folgen: `docs/prowin/integration-removal.md`.
Verifiziert: Typecheck und 34 Tests (Migration, Task-Frames, Resident-Queue, Zugriff).
