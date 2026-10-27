---
id: TASK-21
title: Datenfluss für Frame-HTML und Vision klären und absichern (Q10)
status: Done
assignee: []
created_date: '2026-10-23T09:50:00Z'
updated_date: '2026-10-27T10:59:00Z'
labels:
  - prowin
  - decision
  - privacy
milestone: m-2
dependencies:
  - TASK-16
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Screenshots und HTML können reale Kontaktdaten enthalten. Die bisherige Zusage, es gingen keine personenbezogenen Daten an KI, darf nicht ungeprüft übernommen werden.

Quellen: Umsetzung §§ 7.6, 17 (Q10); Referenz R4.5–R4.6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Platzhalter-Verfahren einschließlich Screenshots ist auf Eignung geprüft; gewählte Lösung oder Rechtsgrundlage mit Verantwortlichen ist dokumentiert.
- [x] #2 Die beschlossene Schutzmaßnahme ist für alle Agent-Eingaben umgesetzt und mit Kontaktfeldern sowie Vision getestet.
- [x] #3 Einmaliger KI-Hinweis nennt HTML, Screenshots, Requesty und Magnific; Pitch-Checkliste beschreibt den tatsächlichen Datenfluss.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Entscheidung Q10 dokumentieren (Option A, Verantwortlicher Matthias)
2. Redaktionsmodul server/prowin/redact.ts + Unit-Tests
3. Resident/Distiller-Verdrahtung inkl. Vision-Screenshot aus redigiertem HTML + Restore bei Frame-Writes + Integrationstests
4. Einmaliger KI-Hinweis in UI + Pitch-Checkliste/Datenfluss-Doku
5. Reviews (SDD), Gesamtsuite, ACs abhaken - Done erst nach Nutzerabnahme
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Umsetzung 25.10.2026 (SDD, Plan docs/superpowers/plans/2026-10-25-backlog-21.md): Option A Platzhalter, Verantwortlicher Matthias. Commits 702578e (redact-Modul), d7d8041 (Resident/Distiller-Verdrahtung inkl. Vision aus redigiertem HTML, Restore bei Frame-Writes), 867bd21+bbb4a4c (KI-Hinweis + datenfluss-ki.md + Pitch-Checkliste). Geltungsbereich nur Server-Requesty; MCP/Local-Agent bewusst unveraendert (eigener Agent der Nutzerin). Grenzen: Namen/Postadressen per Regex nicht erkannt (transparent in UI-Hinweis + Doku, Upgrade TASK-29 data-od-role=contact). Tests: prowinRedact 17/17, Wiring 4/4, Regression 43/43; Gesamtsuite im Voll-Lauf 8 Timeout-Flakes in fremden Dateien, einzeln alle gruen (wie TASK-20-Baseline). Typecheck/Lint/Build/Doc-Lint ok. Whole-Branch-Review: ready. Done erst nach manueller Nutzerabnahme.

27.10.2026: Ausdrückliche Nutzerfreigabe zum Abschluss: "ok, task auf done bitte. ebenso task 21, sowie Task 66ff - 69 (nice)." Die Freigabe umfasst die zugehörigen Untertasks. Dokumentierte Prüfgrenzen bleiben bestehen; dieser Abschluss behauptet keine zusätzlichen Live- oder nativen Tests. Keine weiteren Produktänderungen für den Abschluss erforderlich.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PII-Platzhalter für Server-Requesty, redigiertes Vision-Rendering, Restore bei Frame-Schreibvorgängen und transparenter KI-Hinweis umgesetzt und ausdrücklich abgenommen. MCP/Local Agent unverändert; Grenzen zu Namen, Adressen und Bildinhalten bleiben dokumentiert.
<!-- SECTION:FINAL_SUMMARY:END -->
