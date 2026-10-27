---
id: TASK-22
title: Ausgehende KI-Requests prüfen und M2 abnehmen
status: Done
assignee: []
created_date: '2026-10-23T09:50:00Z'
updated_date: '2026-10-27T10:59:00Z'
labels:
  - prowin
  - implementation
milestone: m-2
dependencies:
  - TASK-16
  - TASK-17
  - TASK-20
  - TASK-18
  - TASK-21
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Die Provider-Auswahl allein beweist keine EU-Routen. Der Agent-Lauf benötigt einen Test für tatsächlich angesprochene Hosts; Magnific erweitert ihn später.

Quellen: Umsetzung §§ 7.6, 14 (M2)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ein repräsentativer Agent-Lauf mit Distiller protokolliert ausgehende Requests und scheitert bei unerlaubten Hosts.
- [x] #2 Requesty verwendet router.eu.requesty.ai; Magnific ist nur im freigegebenen Bildpfad zulässig und Stripe erst bei späterer Aktivierung.
- [x] #3 Direkte Modell- und PostHog-Aufrufe sind ausgeschlossen; Boot-Guard, Egress-Test und Agent-Smoke-Test bestehen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan: docs/superpowers/plans/2026-10-26-backlog-22.md
1. Agent-/Distiller-Egress testgetrieben nachweisen.
2. Direkte Serverprovider testgetrieben sperren.
3. Doku, Gesamtsuite und unabhängiges Review; Done erst nach Nutzerabnahme.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
27.10.2026: Plan mit "danke. so umsetzen bitte" freigegeben. Nutzer hat isolierten Worktree bestätigt: /home/matthias/.local/share/opencode/worktree/9d3066/task-22-ai-egress. Nur KI/Analytics; keine Commits/Pushes. Ursprünglicher Checkout und fremde Änderungen bleiben unberührt.

Umsetzung im isolierten Worktree: testseitiger Egress-Wrapper mit geheimnisfreiem JSONL-Journal; echter Resident-Lauf mit Screenshot, save_decision, Zusammenfassung und pending Regelvorschlag. Beide Distiller-Aufrufe laufen über dieselbe geprüfte EU-Grenze. Negative Host-/Redirect-Tests und abgefangene Fehler geprüft; temporäre OpenAI-Fehlinjektion ließ die Gesamtauswertung trotz catch scheitern (wieder entfernt). Boot-Guard sperrt jetzt explizites Azure/Anthropic; 101 gezielte Tests, Typecheck, Lint und Build bestanden. Gesamtsuite und unabhängiges Ripley-Review laufen. Noch keine manuelle Abnahme und kein Done/Commit/Push.

Abschlussprüfung 27.10.2026: 167 Dateien / 1341 Tests erfolgreich (161.98s); gezielte Abschlussprüfung 9 Dateien / 103 Tests. Erster Voll-Lauf hatte genau einen 5s-Timeout in legacyPagesMigration.test.ts (persists legacy membership before reordering, including after reopening the database); isolierte Nachprüfung und anschließende Gesamtsuite bestanden ohne Timeout-/Produktänderung. Typecheck, Lint, Build, Format und Doc-Lint bestanden; bekannte Chunkgrößen-, Node-localStorage- und Stale-Docs-Hinweise dokumentiert.
Unabhängiges Ripley-Review: kein Critical, Important I1 (fehlender Temp-Elternordner) bestätigt und mit RED/ENOENT -> GREEN-Regressionsfall behoben. Beide Testconsumer verwenden jetzt tmpdir()/opencode mit mkdirSync(recursive). Kleiner Planstatus-Hinweis bei der vorgesehenen Fortschrittsaktualisierung korrigiert.
Technische ACs für den vereinbarten KI-/Analytics-Umfang verifiziert. Evidenz und manuelle Prüfschritte: docs/prowin/egress-pruefung.md. Kein Live-/Regionsnachweis, keine globale Netzwerkfirewall, Nicht-KI-Suche und Local Agent/MCP unverändert. Status bleibt ausdrücklich In Progress bis manueller Nutzerabnahme. Kein Commit/Push/Merge; Änderungen verbleiben im isolierten Worktree.

27.10.2026: Ausdrückliche Nutzerfreigabe zum Abschluss: "ok, task auf done bitte. ebenso task 21, sowie Task 66ff - 69 (nice)." Die Freigabe umfasst die zugehörigen Untertasks. Dokumentierte Prüfgrenzen bleiben bestehen; dieser Abschluss behauptet keine zusätzlichen Live- oder nativen Tests. Keine weiteren Produktänderungen für den Abschluss erforderlich.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
KI-/Analytics-Egress mit geheimnisfreiem Zieljournal, echtem Agent-/Distiller-Smoke und Sperre direkter Azure-/Anthropic-Serverprovider umgesetzt. 167 Dateien/1341 Tests sowie Qualitätsprüfungen bestanden; Reviewbefund regressionsgeprüft behoben. Vom Nutzer ausdrücklich abgenommen. Implementierung liegt derzeit noch uncommittet im Worktree task-22-ai-egress; main-Integration ist gesondert zu entscheiden. Kein Live-/Regionsnachweis.
<!-- SECTION:FINAL_SUMMARY:END -->
