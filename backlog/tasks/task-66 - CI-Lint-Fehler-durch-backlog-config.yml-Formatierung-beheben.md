---
id: TASK-66
title: CI-Lint-Fehler durch backlog/config.yml-Formatierung beheben
status: Done
assignee: []
created_date: '2026-10-25T11:19:00Z'
updated_date: '2026-10-27T10:59:00Z'
labels: []
dependencies: []
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI-Job lint in PR #7: bun run lint besteht, bun run format:check scheitert nur an backlog/config.yml (Backlog-CLI schreibt YAML mit Doppel-Anfuehrungszeichen, Prettier verlangt Einfach-Anfuehrungszeichen laut .prettierrc). Dauerhafte Loesung gegen erneutes Ueberschreiben durch die Backlog-CLI waehlen, nicht nur einmalig formatieren.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 bun run format:check laeuft lokal gruen durch
- [x] #2 Fix ueberlebt ein Neuschreiben der config.yml durch die Backlog-CLI (oder Formatierung wird von der CLI stabil so erzeugt)
- [x] #3 bun run lint und Typecheck bleiben gruen

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. format:check rot verifizieren
2. backlog/config.yml in .prettierignore ausnehmen
3. gruen + Negativnachweis (tasks/*.md weiter geprueft) verifizieren
4. Commit; Done erst nach Nutzerabnahme
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnose 25.10.2026: CI-Job lint (PR #7) - bun run lint gruen, format:check scheitert nur an backlog/config.yml (CLI-YAML Doppel-Quotes vs Prettier singleQuote). Fix 96216d9: exakter Eintrag backlog/config.yml in .prettierignore (CLI besitzt die Datei, Umformatieren wuerde beim naechsten CLI-Schreiben erneut brechen). backlog/tasks/*.md bleiben geprueft (Negativnachweis). Reviews: Task + Whole-Branch (Muse Spark 1.3) beide PASS. Done erst nach Nutzerabnahme.

27.10.2026: Ausdrückliche Nutzerfreigabe zum Abschluss: "ok, task auf done bitte. ebenso task 21, sowie Task 66ff - 69 (nice)." Die Freigabe umfasst die zugehörigen Untertasks. Dokumentierte Prüfgrenzen bleiben bestehen; dieser Abschluss behauptet keine zusätzlichen Live- oder nativen Tests. Keine weiteren Produktänderungen für den Abschluss erforderlich.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Backlog-CLI-eigene config.yml gezielt von Prettier ausgenommen; dauerhafte Formatstabilität, Lint und Typecheck dokumentiert geprüft. Fix ist in main enthalten und vom Nutzer ausdrücklich abgenommen.
<!-- SECTION:FINAL_SUMMARY:END -->
