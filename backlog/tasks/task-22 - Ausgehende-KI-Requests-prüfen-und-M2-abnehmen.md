---
id: TASK-22
title: Ausgehende KI-Requests prüfen und M2 abnehmen
status: Done
assignee: []
created_date: '2026-10-23T09:50:00Z'
updated_date: '2026-10-27T11:11:00Z'
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
1. Echten Resident-Smoke um Host-Journal, Screenshot, save_decision und beide Distiller-Aufrufe ergaenzen; abgefangene Verstoesse separat nachweisen.
2. Explizite direkte Serverprovider im Boot-Guard sperren und regressionspruefen.
3. KI-/Analytics-Scope und Nachweisgrenzen dokumentieren; gezielte Tests, Gesamtsuite und Qualitaetspruefungen ausfuehren.
4. Unabhaengiges Review und manuelle Abnahme; Done nur nach Nutzerbestaetigung.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Arbeit begonnen. TASK-21 ist technisch umgesetzt (alle ACs abgehakt), aber noch In Progress bis zur Nutzerabnahme. Fremde Aenderungen an TASK-23 sowie DESIGN-prowin.md, reports/ und research_notes/ bleiben unangetastet.

Bestandsaufnahme: Die dokumentierte Egress-Allowlist (Umsetzung §7.6: Requesty, spaeter Magnific/Stripe) steht im Konflikt zu weiterhin aktiven Resident-Tools search_icons/search_logos (Iconify/DuckDuckGo, optional Brandfetch) sowie optionaler Pexels-Suche (§6 Behalten). Expliziter Azure-Serverprovider ist ebenfalls noch waehlbar. Vor Produktveraenderungen muss der Geltungsbereich der Allowlist geklaert werden; ein nur selektiver Agent-Smoke waere kein Nachweis fuer alle Agent-Tools. Noch keine Produktdateien veraendert und keine Tests ausgefuehrt.

Nutzerentscheidung: "nur ki und analytics erstmal". Externe Bild-/Icon-/Logosuche bleibt unveraendert und ausserhalb dieser Host-Beschraenkung. Magnific/Stripe werden nicht vorgezogen. Spock hat die Testbasis rein lesend untersucht: Resident-Harness und Router wiederverwenden, Distiller via save_decision ausloesen, Journal auch bei abgefangenen Fehlern pruefen; Chromium im M2-Smoke verpflichtend. Plan erstellt und selbst gegen Scope/ACs geprueft; Umsetzung wartet auf Plan-/Ausfuehrungsfreigabe. Kein Produktcode geaendert.

27.10.2026: Bestehenden Plan redaktionell an die aktualisierte AGENTS.md angepasst: Ergebnis/Ablauf zuerst, kurze Checklisten, hervorgehobene Grenzen und getrennte Begruendung. Leia hat die Kommunikationsvorgaben rein lesend geprueft. Technischer Umfang unveraendert (nur KI/Analytics); keine Umsetzung gestartet. Plan-/Ausfuehrungsfreigabe und manuelle Done-Abnahme bleiben erforderlich.

27.10.2026: Ausdrückliche Nutzerfreigabe zum Abschluss: "ok, task auf done bitte. ebenso task 21, sowie Task 66ff - 69 (nice)." Die Freigabe umfasst die zugehörigen Untertasks. Dokumentierte Prüfgrenzen bleiben bestehen; dieser Abschluss behauptet keine zusätzlichen Live- oder nativen Tests. Keine weiteren Produktänderungen für den Abschluss erforderlich.

Übernommene technische Evidenz aus dem isolierten Worktree (Stand vor lokaler Integration):
27.10.2026: Plan mit "danke. so umsetzen bitte" freigegeben. Nutzer hat isolierten Worktree bestätigt: /home/matthias/.local/share/opencode/worktree/9d3066/task-22-ai-egress. Nur KI/Analytics; keine Commits/Pushes. Ursprünglicher Checkout und fremde Änderungen bleiben unberührt.

Umsetzung im isolierten Worktree: testseitiger Egress-Wrapper mit geheimnisfreiem JSONL-Journal; echter Resident-Lauf mit Screenshot, save_decision, Zusammenfassung und pending Regelvorschlag. Beide Distiller-Aufrufe laufen über dieselbe geprüfte EU-Grenze. Negative Host-/Redirect-Tests und abgefangene Fehler geprüft; temporäre OpenAI-Fehlinjektion ließ die Gesamtauswertung trotz catch scheitern (wieder entfernt). Boot-Guard sperrt jetzt explizites Azure/Anthropic; 101 gezielte Tests, Typecheck, Lint und Build bestanden. Gesamtsuite und unabhängiges Ripley-Review laufen. Noch keine manuelle Abnahme und kein Done/Commit/Push.

Abschlussprüfung 27.10.2026: 167 Dateien / 1341 Tests erfolgreich (161.98s); gezielte Abschlussprüfung 9 Dateien / 103 Tests. Erster Voll-Lauf hatte genau einen 5s-Timeout in legacyPagesMigration.test.ts (persists legacy membership before reordering, including after reopening the database); isolierte Nachprüfung und anschließende Gesamtsuite bestanden ohne Timeout-/Produktänderung. Typecheck, Lint, Build, Format und Doc-Lint bestanden; bekannte Chunkgrößen-, Node-localStorage- und Stale-Docs-Hinweise dokumentiert.
Unabhängiges Ripley-Review: kein Critical, Important I1 (fehlender Temp-Elternordner) bestätigt und mit RED/ENOENT -> GREEN-Regressionsfall behoben. Beide Testconsumer verwenden jetzt tmpdir()/opencode mit mkdirSync(recursive). Kleiner Planstatus-Hinweis bei der vorgesehenen Fortschrittsaktualisierung korrigiert.
Technische ACs für den vereinbarten KI-/Analytics-Umfang verifiziert. Evidenz und manuelle Prüfschritte: docs/prowin/egress-pruefung.md. Kein Live-/Regionsnachweis, keine globale Netzwerkfirewall, Nicht-KI-Suche und Local Agent/MCP unverändert. Status bleibt ausdrücklich In Progress bis manueller Nutzerabnahme. Kein Commit/Push/Merge; Änderungen verbleiben im isolierten Worktree.

27.10.2026: Ausdrückliche Nutzerfreigabe zum Abschluss: "ok, task auf done bitte. ebenso task 21, sowie Task 66ff - 69 (nice)." Die Freigabe umfasst die zugehörigen Untertasks. Dokumentierte Prüfgrenzen bleiben bestehen; dieser Abschluss behauptet keine zusätzlichen Live- oder nativen Tests. Keine weiteren Produktänderungen für den Abschluss erforderlich.

27.10.2026: Nutzer autorisiert nach Rückfrage ausdrücklich: "Alles in main übernehmen, entsprechende commits vornehmen". Technische Umsetzung als 7f5a599 committed und per Fast-forward nach main übernommen. Nutzerabnahme für TASK-21/22 und TASK-66 bis TASK-69 einschließlich Untertasks ausdrücklich erfolgt. Vor Bereinigung vollständige private Sicherung unter /home/matthias/code/prowin_designer-backups/cleanup-2026-10-27-qxbiwr13 erstellt; Daten-/Ausführungsarchive gegen Quellen verifiziert. Kein Push beauftragt.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
KI-/Analytics-Egress mit geheimnisfreiem Journal, echtem Agent-/Distiller-Smoke und frühem Ausschluss direkter Azure-/Anthropic-Serverprovider umgesetzt, geprüft und ausdrücklich abgenommen. 167 Dateien/1341 Tests sowie Qualitätsprüfungen bestanden; Reviewkorrektur regressionsgeprüft. Am 27.10.2026 lokal als 7f5a599 nach main übernommen. Bild-/Suchpfade und Local Agent/MCP unverändert. Kein Live-/Regionsnachweis und keine vollständige Netzwerkfirewall. Kein Push.
<!-- SECTION:FINAL_SUMMARY:END -->
