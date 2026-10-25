---
id: TASK-15
title: Requesty-Policies und EU-Modellkette prüfen (Q2, Q9)
status: Done
assignee: []
created_date: '2026-10-23T09:50:00Z'
updated_date: '2026-10-24T19:29:00Z'
labels:
  - prowin
  - decision
  - ai
milestone: m-2
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Policy-Namen und Modellketten der Draft-Spec sind vor produktiver Nutzung gegen die aktuelle API zu prüfen. Der Agent braucht Tool-Calling und Vision.

Quellen: Umsetzung §§ 7.2, 17 (Q2, Q9); Referenz R4.3
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Policy-Syntax, EU-Routing und verfügbare Modelle sind anhand aktueller Dokumentation und eines Testaufrufs belegt.
- [ ] #2 Zehn Agent-Briefs messen Tool-Call-Fehler, Latenz und Kosten pro fertigem Design; zwanzig deutsche Textprompts vergleichen Qualität und Constraint-Treue.
- [ ] #3 Ausgewählte Policies und Fallbacks sowie Requesty-Budget und Kosten-Alerts sind dokumentiert; keine unbestätigten Modellnamen gelten als freigegeben.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Aktuelle Requesty-Dokumentation, Policy-Syntax und EU-Routing prüfen.
2. Vorhandene Konfiguration und Voraussetzungen für authentifizierte Modell-/Policy-Tests feststellen.
3. Benchmark mit 10 Agent-Briefs und 20 deutschen Textprompts vorbereiten und soweit möglich ausführen.
4. Evidenz, Freigabestatus, Fallbacks, Budget und Alerts dokumentieren; offene Voraussetzungen festhalten.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

24.10.2026: Task gestartet. Bestehende Policies policy/prowin-text-gen und policy/prowin-layout-gen laut Nutzer-Screenshot und authentifiziertem GET /v1/models bestätigt. Beide Inferenz-Smokes über router.eu.requesty.ai liefern HTTP 200 und usage.cost. Text löst auf azure/gpt-5.4@germanywestcentral auf; Layout auf bedrock/claude-sonnet-5-5@eu-central-1. Direkter GPT-5.5-Aufruf liefert Provider-404 (Deployment existiert nicht). Management-API für Policy-/Budget-Lesezugriff liefert 403; vollständige Ketten, Retries, Budget und Alerts bleiben offen. Öffentlicher Katalog enthält keine der sieben alten Draft-IDs mit @eu. 20-Prompt-Vergleich gegen beide vorhandenen Policies läuft; 10 Agent-Briefs vorbereitet. Vollständiger Resident-Benchmark benötigt Requesty-Integration aus TASK-16; diese Abhängigkeit ist praktisch zirkulär und muss bei der Abnahme berücksichtigt werden. Details/Evidenz unter docs/prowin/requesty-pruefung.md und docs/prowin/evidence/. Keine Akzeptanzkriterien als erfüllt markiert.

24.10.2026, API-Benchmark abgeschlossen: 20 identische deutsche Textprompts je Policy (40 Antworten). Automatische Prüfungen: Text/GPT-5.4 15/20, Layout/Sonnet 5.5 18/20; sämtliche sieben Fehler sind Zeichenüberschreitungen. Median 1116,5 ms vs 4606,5 ms; Textkosten 0,0251185 USD vs 0,1322838 USD. Beide Tool-/Vision-Rundläufe über den bestehenden Chat-Completions-Transport bestanden. 44 Benchmark-Requests kosten ausgewiesen 0,1621653 USD, mit zwei erfolgreichen Smokes 0,16253545 USD. Blindbewertung aller 40 Texte: Sprachqualität 3,30 vs 4,00 / 5, inhaltliche Brief-Treue 4,55 vs 4,85 / 5; modellgestützt, keine manuelle Freigabe. Prompt-Limitation (fiktiv-Metadaten im Kundentext) dokumentiert. Evidenz und Korpus versionierbar unter docs/prowin/evidence/; Prüfprotokoll docs/prowin/requesty-pruefung.md. Dokumentationsprüfung, JSON-/Messwert-/Linkprüfung und git diff --check erfolgreich; doc-lint meldet eine bestehende Freshness-Warnung zu tests/workspaces.test.ts. Vollständige Fallback-/EU-/Budget-/Alert-Bestätigung sowie zehn echte Resident-Designläufe bleiben offen. Status bleibt In Progress, keine AC voreilig abgehakt.

24.10.2026, Betreiberbestätigung: Auf die Frage nach monatlichem Key-Budget und Kosten-Alerts wurde mit „ja alles eingerichtet“ geantwortet. Einrichtung beider Kostenkontrollen ist damit vom Betreiber bestätigt. Keine konkreten Beträge, Schwellen, Empfänger oder bestätigte Testzustellung genannt; solche Werte werden nicht angenommen. Prüfprotokoll aktualisiert. Requesty-Browser steht weiterhin auf der Anmeldeseite; vollständige Modell-IDs, Reihenfolge und Retries sind weiterhin nicht eingesehen. Task bleibt In Progress.

24.10.2026, ausdrückliche Abnahme durch den Nutzer: „aus meiner sicht ist task 15 done“. TASK-15 wird auf dieser Grundlage mit dem dokumentierten Prüfstand geschlossen. Technische Restprüfungen bleiben im Prüfprotokoll sichtbar; nicht vollständig belegte ursprüngliche Akzeptanzkriterien werden nicht als technisch erfüllt abgehakt. Der administrative Abschluss ist keine pauschale Produktionsfreigabe.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Vom Nutzer am 24.10.2026 ausdrücklich abgenommen. Bestehende Requesty-Policies authentifiziert über den EU-Endpunkt geprüft; 40 deutsche Textantworten verglichen, zwei Tool-/Vision-Rundläufe bestanden, Kosten und modellgestützte Blindbewertung dokumentiert. Budget und Alerts vom Betreiber bestätigt. Prüfprotokoll: docs/prowin/requesty-pruefung.md; Evidenz: docs/prowin/evidence/. Dokumentierte Restpunkte: vollständige Fallback-/EU-Konfiguration, konkrete Budget-/Alert-Nachweise und zehn Resident-Designläufe nach Requesty-Integration. Abschluss auf Nutzerfreigabe, ohne unvollständige Nachweise als erfüllt auszuweisen.
<!-- SECTION:FINAL_SUMMARY:END -->
