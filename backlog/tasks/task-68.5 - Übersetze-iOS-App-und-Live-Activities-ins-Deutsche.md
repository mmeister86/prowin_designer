---
id: TASK-68.5
title: Übersetze iOS-App und Live Activities ins Deutsche
status: In Progress
assignee: []
created_date: '2026-10-25T19:51:00Z'
updated_date: '2026-10-25T23:21:00Z'
labels: []
dependencies: []
parent_task_id: TASK-68
priority: medium
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SwiftUI-App, API-/Verbindungsfehler, Accessibility und Activity-Extension deutsch bereitstellen; Sprachressourcen explizit bündeln und gespeicherte Nutzertexte beibehalten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 App-eigene sichtbare Texte und VoiceOver-Beschriftungen einschließlich Löschfolgen und Live Activities sind deutsch.
- [x] #2 Sprachressourcen und Xcode-Zielzuordnung sind geprüft; native Build- und Laufzeitabnahme bleibt ohne macOS ausdrücklich offen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. SwiftUI-/API-/Activity-Texte und Sprachdeklarationen prüfen, rote Ressourcen-/Fehlerchecks.
2. Eigene iOS-App und Activity auf Deutsch umstellen, Maschinenwerte/Nutzerinhalte erhalten.
3. Verfügbare native und statische Checks, Vollsuite und unabhängiger Review; Apple-Runtime ehrlich abgrenzen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Eigene iOS-/Activity-Texte, VoiceOver, neue Standardnamen, feste Locale und getrennte Bundle-Sprachdeklarationen umgesetzt. Yoda-Review/Fixrunde: Domainbeschränkung im originalen HTTP-Payload sicher erkannt, Legacy-Englisch/Deutsch und unbekannte Diagnosen getrennt geprüft. Nachprüfung spec compliant/quality Approved. Statische Fokuschecks7/7 grün, vorheriger Vollsuite1269/1269; Fixrunde Bun-PATH-Setupfehler im gezielten4/4-Nachlauf behoben. Swift/Core/Xcode/Simulator/VoiceOver mangels Toolchain nicht ausgeführt; native Abnahme offen.

26.10.2026: Finale breite Prüfung plus gemeinsame Korrekturwelle und unabhängige scoped Nachprüfung abgeschlossen; keine offenen Critical-/Important-Befunde. Controller-Vollsuite165Dateien/1309Tests bestanden; Typecheck, Gesamt-Lint und Web-Build erneut grün. Produkt-/Teststand unverändert zum geprüften Snapshot. Native Builds und echte externe Dienste bleiben gemäß Prüfprotokoll offen. Keine Nutzerabnahme; Status bleibt In Progress.
<!-- SECTION:NOTES:END -->
