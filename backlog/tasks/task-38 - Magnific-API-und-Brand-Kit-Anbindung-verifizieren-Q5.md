---
id: TASK-38
title: Magnific-API und Brand-Kit-Anbindung verifizieren (Q5)
status: In Progress
assignee: []
created_date: '2026-10-23T09:52:00Z'
updated_date: '2026-11-06T23:07:00Z'
labels:
  - prowin
  - decision
  - ai
milestone: m-5
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Endpunkte, Authentifizierung und asynchrone Task-Verarbeitung sind in den Projektquellen nicht spezifiziert und dürfen nicht geraten werden.

Quellen: Umsetzung §§ 11, 17 (Q5); Referenz R4.4, R4.6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Offizielle API-Dokumentation und ein kontrollierter Test belegen Auth, Endpunkte, Statusmodell, Limits und Fehlerfälle.
- [x] #2 Brand-Kit-Referenzierung ist belegt oder der Brand-Bildsprache-Prompt als Fallback festgehalten.
- [ ] #3 Kosten, Nutzungsrechte und relevante Verarbeitungsregionen sind dokumentiert; Stockfoto-Nutzung bleibt eine separate offene Entscheidung.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Offizielle Magnific-OpenAPI und Rechts-/Kostenquellen verifizieren
2. Isolierte Probe und Offline-Tests mit DeepSeek V4.1 Flash 1017 implementieren
3. GPT-6.1 Terra: Task- und Branch-Review
4. Kontrollierten Live-Test nur mit Secret und ausdrücklicher Kostenfreigabe ausführen; offene Evidenz sichtbar dokumentieren
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Council: Claude Opus 5.5 7/10, GPT-6.1 Sol 8/10, Muse Wonder 8/10 (Vorgehensreife). Empfehlung: reine API-Verifikation, keine TASK-39-Integration. TASK-37 bleibt unabgenommen.

Implementiert: docs/prowin/magnific-pruefung.md, isolierte kostenpflichtig gesperrte Probe und 38 Offline-Tests. DeepSeek V4.1 Flash 1017: 3d8f703. Terra-Taskreview 7/10; alle drei Befunde korrigiert in fc04cf7, Terra-Fixreview 9/10 freigegeben.
Verifikation: 240 Dateien / 2200 Tests bestanden; Typecheck, Lint, Doc-Lint (1 Freshness-Warning), gezielte Formatprüfung und Dry-Run bestanden.
AC2 belegt: Brand-Bildsprache aus DESIGN-prowin.md §7 als expliziter Fallback; keine globale Behauptung, Brand Kits seien überall unverfügbar.
Blocker AC1: kein autorisierter Live-Lauf/kein API-Key. Blocker AC3: Preis medium/1k passt nicht zur offiziellen Preistabelle; Account-Preis/Cap, API-Nutzungsrechte/Attribution, DPA, Subprozessoren, Regionen und Retention noch zu bestätigen. Kein API-Aufruf, kein Secret gelesen. TASK-37 bleibt unberührt/unabgenommen. Stock-Entscheidung bleibt separat offen.
Status bleibt In Progress: Projekt erlaubt kein Blocked; Blocker stehen daher in diesen Notizen.
<!-- SECTION:NOTES:END -->
