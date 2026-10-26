---
id: TASK-68
title: Übersetze die gesamte App ins Deutsche
status: In Progress
assignee: []
created_date: '2026-10-25T19:50:00Z'
updated_date: '2026-10-25T19:54:00Z'
labels: []
dependencies: []
priority: high
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vollständige deutsche Nutzeroberfläche für Web, Desktop und iOS auf Grundlage des Übersetzungs-Audits im Chat. Einschließlich Dialogen, Accessibility, Onboarding, Fehlermeldungen, Transaktionsmails, Standardinhalten, Sprachmetadaten und Formaten. Technische Verträge und bestehende Nutzerinhalte bleiben unverändert. Umsetzung wartet auf Freigabe des konkreten Plans.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Alle app-eigenen Nutzertexte der Web-Oberfläche einschließlich gemeinsamer Komponenten, Admin und deaktivierter optionaler Funktionen sind deutsch und verwenden ein einheitliches Glossar.
- [ ] #2 Serverseitig angezeigte Meldungen, Transaktionsmails, Willkommensdemo und neue Standardnamen sind deutsch; technische Fehlercodes, API-Werte und gespeicherte Nutzerinhalte bleiben kompatibel.
- [ ] #3 iOS inklusive Live Activities sowie native Desktop-Menüs, Dialoge und Installer-Texte sind deutsch; Apple-Build- und Laufzeitgrenzen sind explizit dokumentiert.
- [ ] #4 Sprachmetadaten, relative Zeiten, Datum und Zahlen sind konsistent deutsch formatiert; Währungen, Preise und technische numerische Eingaben ändern ihre Bedeutung nicht.
- [ ] #5 Passende Regressionstests, vollständige Typechecks, Lint, Formatierung und Web-Build sind geprüft; verbleibende englische Nutzermeldungen und manuelle Testgrenzen sind dokumentiert.
- [ ] #6 Die manuelle Abnahme durch den Nutzer ist erfolgt; erst nach ausdrücklicher Freigabe werden Haupttask und Untertasks auf Done gesetzt.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Konkreten Entwurf und Plan vom Nutzer freigeben lassen: docs/superpowers/specs/2026-10-25-german-app-design.md und docs/superpowers/plans/2026-10-25-german-app.md.
2. TASK-68.3: gemeinsame Anzeigenamen, Servertexte, Fehler und deutsche Formatierung absichern.
3. TASK-68.1/2: Web-Seiten, UI-Standards, Editor und clientseitige Meldungen übersetzen.
4. TASK-68.4/5: Desktop und iOS einschließlich nativer Ressourcen übersetzen.
5. TASK-68.6: Regressionstests, Resttext-Audit, unabhängiger Review und verfügbare Laufzeitprüfungen.
6. Nutzer um manuelle Abnahme bitten; erst auf ausdrückliche Freigabe Done setzen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
25.10.2026: Vollständiger Quelltext-Audit liegt im Chat vor. Sechs Untertasks angelegt. Entwurf mit Glossar, Grenzen und vollständigem Client-/Serverumfang sowie testbarem Implementierungsplan geschrieben. Unabhängiger Builder-Check durch Gandalf/Codex: nothing important left. Es wurden noch keine App-Dateien geändert; konkrete Planfreigabe steht aus.
<!-- SECTION:NOTES:END -->
