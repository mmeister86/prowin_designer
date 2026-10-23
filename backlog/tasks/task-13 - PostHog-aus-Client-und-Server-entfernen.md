---
id: TASK-13
title: PostHog aus Client und Server entfernen
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
  - docs/prowin/analytics-events.md
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

PostHog wird durch Rybbit ersetzt. Die Anwendung muss auch ohne aktive Analytics-Konfiguration funktionieren.

Quellen: Umsetzung §§ 6, 12.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 posthog-js, direkte Aufrufe und PostHog-Konfiguration sind entfernt; serverseitige Analytics sind zunächst No-op.
- [x] #2 Keine PostHog-Netzwerkaufrufe entstehen; Typecheck und relevante Tests bestehen.
- [x] #3 Die bisherigen Event-Auslöser sind als Grundlage für die Rybbit-Zuordnung dokumentiert.

<!-- AC:END -->

## Implementation Notes

- SDK samt ungenutzten transitiven Abhängigkeiten, Client-Captures, Identifizierung,
  Session-Replay inklusive Iframe-Recorder und Conversations-Support-Chat entfernt.
- `/relay`, Vite-Proxy, Docker-Build-Args und Env-Konfiguration entfernt.
  `server/analytics.ts` behält die MCP-Signaturen als bedingungslose No-ops.
- 63 bisherige explizite Event-Namen mit Auslösern und Eigenschaften in
  `docs/prowin/analytics-events.md` dokumentiert. Rybbit folgt in TASK-42.
- Browser-Tests für Frame-Rendering und Body-Attribute verwenden eine eigenständige
  Fixture ohne Recorder. Nicht mehr benötigte SDK-Mocks und Replay-/Chat-Tests entfernt.
- TASK-12 bleibt auf ausdrücklichen Nutzerwunsch zurückgestellt.

## Verification

- Neue Netzwerk-Regressionsprüfungen zuerst rot, nach Entfernung grün: gesetzte
  Legacy-Keys lösen keine Server-Captures aus; alte Relay-URLs erreichen den lokalen
  Test-Upstream nicht mehr.
- `bun run test -- --maxWorkers=2`: 911/911 Tests in 123 Dateien bestanden.
  Der erste Lauf wurde durch das 120-Sekunden-Ausführungslimit abgebrochen;
  der vollständige Wiederholungslauf dauerte 153 Sekunden.
- `bun run typecheck`, `bun run lint`, `bun run build`, Formatprüfung und
  `git diff --check`: erfolgreich. Build mit bestehendem Large-Chunk-Hinweis.
- Chromium-Smoke-Test des Produktionsbuilds: Login-Formular sichtbar, keine
  Startfehler, kein Analytics-SDK und keine PostHog-/Relay-Requests bei neun
  beobachteten Requests. Auth-API dabei lokal gestubbt, kein echter Login-Roundtrip.
- Scan von 270 Source-/Build-/Konfigurationsdateien ohne PostHog-Referenzen.
- Unabhängiges Review: keine Befunde; vollständiges Event-Inventar bestätigt.
