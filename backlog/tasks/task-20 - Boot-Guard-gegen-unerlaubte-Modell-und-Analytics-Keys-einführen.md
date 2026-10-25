---
id: TASK-20
title: Boot-Guard gegen unerlaubte Modell- und Analytics-Keys einführen
status: Done
assignee: []
created_date: '2026-10-23T09:50:00Z'
updated_date: '2026-10-25T09:37:00Z'
labels:
  - prowin
  - implementation
milestone: m-2
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Ein falsch gesetzter Key darf keine unerwünschten direkten Datenabflüsse reaktivieren. Der Guard muss vor Provider-Initialisierung greifen.

Quellen: Umsetzung § 7.6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Gesetzte ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, ARK_API_KEY, POSTHOG_KEY oder VITE_POSTHOG_KEY verhindern den Serverstart.
- [x] #2 Fehlermeldungen nennen Variablennamen, aber keine Geheimnisse; erlaubte Konfiguration startet normal.
- [x] #3 Tests decken jeden verbotenen Key und den erlaubten Startfall ab; weitere aktive Providerpfade werden beim Egress-Test berücksichtigt.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Boot-Guard gemäß Umsetzung §7.6 als ersten Import ergänzen; nichtleere Werte blockieren, nur Namen ausgeben.
2. Tests für alle sechs Keys, mehrere Keys, Importreihenfolge und erlaubten echten Serverstart schreiben und RED/GREEN prüfen.
3. Konfiguration dokumentieren, verbleibende Providerpfade für TASK-22 festhalten, Suite/Typecheck/Build und unabhängiges Review durchführen.
4. Task bis expliziter manueller Nutzerabnahme In Progress lassen.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Guard als erster Seiteneffektimport ergänzt, ohne NODE_ENV-Testausnahme. Nichtleere Werte inklusive Leerzeichen/0 blockiert; nur Namen im Fehler.
RED: neun negative Prozessstarttests scheitern erwartungsgemäß ohne Guard. GREEN: Boot-Guard- und Env-Tests 18/18 erfolgreich, erlaubter Requesty-Serverstart über Healthcheck bestätigt.
Spock hat Start-/Providerpfade geprüft; Übergabe an TASK-22 in docs/prowin/boot-guard.md dokumentiert (Azure, Bildsuche und weitere externe Pfade). Leia-Abschlussreview: PASS, keine Befunde.
Typecheck und Build erfolgreich. Gesamtsuite und CodeRabbit-Review laufen. Standard-Lint enthält weiterhin 14 vorbestehende no-undef-Befunde in data/requesty-evaluation/run-checks.mjs; gezielte Prüfung folgt.

Abschlussreview Leia: PASS. CodeRabbit hat server/prowin/guard.ts geprüft und einen konditionalen major-Hinweis zur VITE_POSTHOG_KEY-Nutzung beim Clientbuild geliefert. Verifiziert: src/shared/Vite-Konfiguration und package.json konsumieren den Key nicht, Analytics ist serverseitig No-op; daher kein anwendbarer Befund und keine Build-Sperre ergänzt.
Gesamtlint mit ausschließlich data/requesty-evaluation/run-checks.mjs ausgenommen erfolgreich; Guard-Rohzugriff vor env.ts ist mit einer lokalen, begründeten ESLint-Ausnahme dokumentiert.

Gesamtlauf (Extension-Test separat) abgeschlossen: 137 Dateien, 993 Tests erfolgreich, ein 20s-Timeout im bestehenden tests/pageControlsBrowser.test.ts (drags pages, double-clicks to rename, and restores a deleted page and frame with Cmd+Z). Isolierte Nachprüfung ohne parallele Last läuft; keine Testtimeouts oder Produktlogik geändert.
Alle drei TASK-20-Akzeptanzkriterien anhand der Prozessstarttests und der Egress-Übergabe erfüllt. Status bleibt bis ausdrücklicher Nutzerabnahme In Progress.

Separater Extension-Test erfolgreich: 1 Datei, 4/4 Tests. Nachprüfung pageControlsBrowser.test.ts einzeln: reproduziert fehlenden Selektor [role="treeitem"][aria-selected="true"] an Zeile 126. Baseline-Abgleich gegen HEAD ohne TASK-20 läuft in temporärer Quellkopie; keine Änderungen am betroffenen Browserproduktcode oder Test vorgenommen.

Baseline-Vergleich abgeschlossen: pageControlsBrowser.test.ts scheitert auch ohne TASK-20 auf HEAD 1c8b978 mit 20s-Timeout (temporäre git-archive-Quellkopie). Damit vorbestehender Fehler; bestehender Test und Browserlogik unverändert.
Finaler Prüfstand: 997 erfolgreiche Tests insgesamt (993 im Gesamtlauf plus 4 Extension-Tests), 1 vorbestehender Browserfehler. Alle 10 neuen Boottests grün. Typecheck, Build, Format und Doc-Lint erfolgreich; Lint mit Ausnahme der einzigen vorbestehend fehlerhaften Datei grün. Prüfnachweise in docs/superpowers/plans/2026-10-25-backlog-20.md.
Implementierung zur manuellen Abnahme bereit; keine Commits/Pushes, Status weiterhin In Progress.

Nutzer hat am 25.10.2026 ausdrücklich Done und Commit aller Änderungen bestätigt. Erneuter Typecheck und Build erfolgreich. ESLint ignoriert jetzt wie Git den lokalen Laufzeitdatenordner data/, sodass generierte Evaluationsskripte nicht als Projektquellen gelintet werden; keine Produktquellen von Prüfungen ausgenommen.

Abschlussprüfung 25.10.2026: bun run lint nach Ausrichtung der ESLint-Ignoreliste auf Git erfolgreich; bun run typecheck und bun run build erfolgreich. Build nur mit bekanntem Chunkgrößenhinweis. Commit aller aktuellen Änderungen wird gemäß Nutzerauftrag erstellt.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Boot-Guard als ersten Serverimport eingeführt; alle sechs verbotenen Modell-/Analytics-Keys blockieren ohne Geheimnisausgabe. Tests und Egress-Übergabe dokumentiert, ausdrücklich vom Nutzer abgenommen. Erneuter Standard-Lint, Typecheck und Produktionsbuild erfolgreich. ESLint ignoriert wie Git den lokalen Laufzeitdatenordner data/. Bekannter Browser-Testfehler ist auch auf unverändertem HEAD reproduziert und bleibt separat dokumentiert.
<!-- SECTION:FINAL_SUMMARY:END -->
