---
id: TASK-36
title: Ansichts-Link gegenüber Mitbearbeitungs-Link entscheiden (Q11)
status: Done
assignee: []
created_date: '2026-10-23T09:52:00Z'
updated_date: '2026-11-05T19:08:00Z'
labels:
  - prowin
  - decision
milestone: m-4
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doops Link-Sharing erteilt Bearbeitungsrechte. Es darf gegenüber Nutzerinnen nicht als reine Ansicht dargestellt werden.

Quellen: Umsetzung § 17 (Q11); Referenz R1.2, R5.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Es ist entschieden und dokumentiert, ob zunächst nur Gallery/Dateiexport oder ein neuer Read-only-Link angeboten wird.
- [x] #2 UI und Onboarding benennen bestehende Mitbearbeitungsrechte korrekt.
- [x] #3 Falls Read-only gewählt wird, liegt ein abgegrenzter Umsetzungstask mit serverseitiger REST/WS/MCP-Rechteprüfung vor; bis dahin wird keine Read-only-Funktion behauptet.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Council-Entscheidung dokumentieren: Dateiexport zum privaten Zeigen, Galerie für veröffentlichte Vorlagen; kein Read-only-Link.
2. ShareModal und Onboarding mit DeepSeek V4.1 Flash 1017 präzisieren, fokussierte Regressionstests ergänzen.
3. Mit GPT-6.1 Terra prüfen, Tests und Qualitätssicherung ausführen; Nutzerabnahme abwarten.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Council (Claude Opus 5.5, GPT-6.1 Sol, Muse Wonder) empfiehlt einstimmig keinen neuen Read-only-Link. Implementierung isoliert im Worktree task-36-sharing-decision. Nutzer akzeptiert empfohlene Entscheidungen vorab. AC3: Bedingung Read-only gewählt trifft nicht zu; kein Enforcement-Folgetask erforderlich.

Q11 umgesetzt: private Weitergabe als Datei/Momentaufnahme, Galerie nur für veröffentlichte und kopierbare Vorlagen; kein privater Read-only-Link. AC3 ist bedingt und hier nicht anwendbar, kein Enforcement-Folgetask erforderlich.
DeepSeek V4.1 Flash 1017 implementiert; GPT-6.1 Terra prüft Task und gesamten Branch. Zwei kleine Review-Korrekturen: dauerhaft klares Freigabe-Label und ausdrücklicher Warntext für offene eigentümerlose Alt-Canvases; Backend bleibt unverändert. Abschließendes scoped Terra-Review: 9/10, keine offenen Findings.
Verifikation finaler Code: 68/68 fokussierte Tests, Typecheck, Lint und Prettier bestanden. Ursprünglicher Gesamtlauf: 2147 bestanden, 12 Timeouts in 5 Dateien; alle betroffenen Dateien isoliert mit einem Worker: 28/28 bestanden. Reduzierter Gesamtlauf gestartet vor letztem Legacy-Textfix; Ergebnis wird separat nachgetragen.
Status bleibt In Progress bis zur ausdrücklichen Nutzerabnahme. Kein Push, kein PR, kein Merge.

Gesamtlauf mit --maxWorkers=2 (vor letztem Legacy-UI-Fix): 239 Dateien, 2159/2159 Tests bestanden, 503.69s. Finaler Legacy-Fix separat mit 68/68 Tests und Terra 9/10 verifiziert. Zusätzlicher vollständiger Lauf auf finalem Code mit --maxWorkers=4 gestartet; keine weiteren Codeänderungen währenddessen.

Finaler isolierter Gesamtlauf auf c105d90 (keine weiteren Codeänderungen): bun run test --maxWorkers=2 — 239 Dateien, 2162/2162 Tests bestanden, 513.38s. Typecheck, Lint, gezielter Prettier-Check und finaler Production-Build ebenfalls bestanden.
Vorheriger Vier-Worker-Lauf: 32 Browser-Fehler in 5 Dateien bei gleichzeitigem Build; mögliche Vite-Reload-Interferenz, genaue Ursache nicht bewiesen. Nicht als sauberer Nachweis verwendet.
Übergabedoku: docs/superpowers/reports/2026-11-04-sharing-decision.md. Branch task-36-sharing-decision bleibt lokal erhalten, kein Push/PR/Merge. Nutzerabnahme weiterhin offen.

Nutzerabnahme und ausdrückliche Done-Freigabe am 05.11.2026 erhalten. Merge von PR #13 verifiziert; lokales main per Fast-forward auf den Remote-Merge synchronisiert. Vorhandene lokale Änderungen an TASK-29, TASK-31, TASK-32 und TASK-79 bleiben unberührt.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Entscheide Q11 zugunsten von Dateiexport und Galerie, kennzeichne Mitbearbeitungslinks in UI und Onboarding eindeutig und warne vor offenem Zugriff eigentümerloser Altbestände. Dokumentiere die Entscheidung ohne neue Backend-Rechte. PR #13 wurde am 05.11.2026 gemergt (d4713980); Nutzer hat den Abschluss ausdrücklich bestätigt. Verifikation: 2162 Tests im finalen isolierten Gesamtlauf bestanden; CI des PR grün.
<!-- SECTION:FINAL_SUMMARY:END -->
