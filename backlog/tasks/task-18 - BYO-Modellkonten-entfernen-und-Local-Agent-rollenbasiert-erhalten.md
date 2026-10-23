---
id: TASK-18
title: BYO-Modellkonten entfernen und Local Agent rollenbasiert erhalten
status: To Do
assignee: []
created_date: '2026-10-23T09:50:00Z'
labels:
  - prowin
  - implementation
milestone: m-1
dependencies:
  - TASK-16
  - TASK-14
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Beraterinnendaten sollen nicht über private Modellkonten laufen. Zunächst wird BYO ausgeblendet, nach verfügbarer Requesty-Alternative vollständig entfernt; Local Agent bleibt für Creator/Admins.

Quellen: Umsetzung §§ 6, 7.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 ChatGPT-, OpenAI-, Anthropic-, OpenRouter- und Gemini-Konten sind aus UI und nutzbaren API-Pfaden entfernt.
- [ ] #2 Gespeicherte Zugangsdaten und zugehörige Konfiguration werden mit dokumentierter Migration behandelt.
- [ ] #3 Creator/Admins können Local Agent verwenden, Beraterinnen nicht; Rollen- und Regressionstests sowie Typecheck bestehen.

<!-- AC:END -->
