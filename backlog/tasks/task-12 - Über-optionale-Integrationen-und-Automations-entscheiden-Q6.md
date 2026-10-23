---
id: TASK-12
title: Über optionale Integrationen und Automations entscheiden (Q6)
status: Done
assignee: []
created_date: '2026-10-23T09:49:00Z'
labels:
  - prowin
  - decision
milestone: m-1
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Meta Ads, Refero und die Hintergrundbibliothek sind ausdrücklich nur Entfernungsvorschläge. Automations sollen vorerst ausgeblendet werden; die endgültige Produktentscheidung ist offen.

Quellen: Umsetzung §§ 6, 7.5, 17 (Q6)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Für Meta Ads, Refero, Hintergrundbibliothek und Automations ist Behalten, Entfernen oder Ausblenden mit Begründung entschieden.
- [x] #2 Beschlossene Bereinigungen umfassen UI, Server, Tools, Konfiguration und passende Tests.
- [x] #3 Eine behaltene Hintergrundbibliothek lädt keine doop.design-Assets und verwendet Requesty für Tagging; Automations sind bis zur Entscheidung ausgeblendet.

<!-- AC:END -->

## Entscheidung und Umsetzung

- Nutzerentscheidung vom 23.10.2026: Alle vier Funktionen vorerst deaktivieren, nicht entfernen. So bleibt eine spätere Produktentscheidung reversibel.
- `shared/prowin/features.ts` setzt Meta Ads, Refero, Hintergrundbibliothek und Automations zentral auf `false`. Bestehende Umgebungsvariablen/Schlüssel aktivieren sie nicht wieder.
- Navigation, direkte Seitenrouten, Home-Vorschlag, HTTP-Endpunkte, MCP-/Resident-Tools und Agent-Anweisungen berücksichtigen die Sperren. Scheduler und direkte Automation-Ausführung arbeiten im deaktivierten Zustand nicht.
- Implementierung, Tabellen, Verbindungen, Automation-Definitionen und gespeicherte Bilder bleiben erhalten. Lokale `/bg`-Assets bestehender Designs bleiben abrufbar.
- Zu AC #3: Die Bibliothek bleibt nur als inaktiver Code erhalten. Initialisierung, externe Thumbnails und Tagging sind gesperrt. Eigene Assets und Requesty-Tagging sind Voraussetzungen einer späteren Reaktivierung; die Migration ist bewusst vertagt. Bereits in Designs gespeicherte externe Bild-URLs werden nicht umgeschrieben.

## Verifikation

- Neue Sperrtests zuerst rot, nach Umsetzung grün; bestehende Featuretests bleiben mit expliziter Testfreischaltung erhalten.
- Gesamtsuite nach Review-Korrektur: 918 Tests in 126 Dateien bestanden.
- Typecheck, Lint, Produktionsbuild und Dokumentationsprüfung bestanden.
- Unabhängige Abschlussprüfung: ein P2-Fund im Hintergrund-Importer. `createBackground` weist Importe nun vor Bildverarbeitung und Speicherzugriff ab; Regressionstest zuerst rot, dann grün. Keine weiteren Befunde.
- Kein manueller Browser-/Deployment-Test in diesem Task; UI-Navigation und Home-Vorschlag sind automatisiert geprüft.
