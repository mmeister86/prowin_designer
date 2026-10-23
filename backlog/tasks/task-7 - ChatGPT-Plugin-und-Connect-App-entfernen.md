---
id: TASK-7
title: ChatGPT-Plugin und Connect-App entfernen
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
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der proWIN-Fork benötigt keine ChatGPT-App; der allgemeine MCP-Server bleibt bestehen.

Quellen: Umsetzung § 6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 chatgptApp, chatgpt-plugin und zugehörige Connect-Routen, UI und Konfiguration sind entfernt.
- [x] #2 Der verbleibende MCP-Zugang ist geprüft; Typecheck und relevante Tests bestehen.

<!-- AC:END -->

## Umsetzung

Plugin, Preview-Ressourcen und App-Connector entfernt; MCP verlangt jetzt auch für Ressourcen Authentifizierung. Generische OAuth-/Consent- und Agent-Key-Zugänge bleiben erhalten. BYO-Konten sind separat TASK-18.
Verifiziert: Typecheck und 64 Tests (MCP, Kommentare, Connect-UI, Agent-Keys, Zugriff) bestanden.
