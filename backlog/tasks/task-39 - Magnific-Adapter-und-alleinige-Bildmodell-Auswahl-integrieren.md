---
id: TASK-39
title: Magnific-Adapter und alleinige Bildmodell-Auswahl integrieren
status: To Do
assignee: []
created_date: '2026-10-23T09:52:00Z'
labels:
  - prowin
  - implementation
milestone: m-5
dependencies:
  - TASK-38
  - TASK-23
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Die bisherigen OpenAI/Gemini/Ark-Bildpfade werden durch Magnific ersetzt. Ergebnisse müssen als eigene Assets erhalten bleiben.

Quellen: Umsetzung § 11
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 magnific-one ist der vorgesehene Eintrag in IMAGE_MODELS; alte Bildprovider sind aus produktiven Pfaden und Konfiguration entfernt.
- [ ] #2 Generierung verarbeitet Task-ID, Polling, Timeout und API-Fehler gemäß verifizierter API; Ergebnisse landen über storage als Assets.
- [ ] #3 Tests decken Erfolg, Fehler, Timeout und Asset-Persistenz ab; Brand-Kit oder beschlossener Prompt-Fallback wird angewendet.

<!-- AC:END -->
