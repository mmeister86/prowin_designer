---
id: TASK-68
title: Übersetze die gesamte App ins Deutsche
status: Done
assignee: []
created_date: '2026-10-25T19:50:00Z'
updated_date: '2026-10-27T10:59:00Z'
labels: []
dependencies: []
priority: high
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vollständige deutsche Endnutzeroberfläche für Web, Desktop und iOS einschließlich Accessibility, Fehlermeldungen, Transaktionsmails, Standardinhalten und Formaten umgesetzt und vorläufig vom Nutzer akzeptiert. Lokal unter TASK-70 nach main integriert, einschließlich separat gesicherter geretteter Datenbank. Native und echte externe Abläufe bleiben gemäß Prüfprotokoll ungeprüft. Keine Veröffentlichung oder Deployment; Statusabschluss erst nach ausdrücklicher Done-Freigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Alle app-eigenen Nutzertexte der Web-Oberfläche einschließlich gemeinsamer Komponenten, Admin und deaktivierter optionaler Funktionen sind deutsch und verwenden ein einheitliches Glossar.
- [x] #2 Serverseitig angezeigte Meldungen, Transaktionsmails, Willkommensdemo und neue Standardnamen sind deutsch; technische Fehlercodes, API-Werte und gespeicherte Nutzerinhalte bleiben kompatibel.
- [x] #3 iOS inklusive Live Activities sowie native Desktop-Menüs, Dialoge und Installer-Texte sind deutsch; Apple-Build- und Laufzeitgrenzen sind explizit dokumentiert.
- [x] #4 Sprachmetadaten, relative Zeiten, Datum und Zahlen sind konsistent deutsch formatiert; Währungen, Preise und technische numerische Eingaben ändern ihre Bedeutung nicht.
- [x] #5 Passende Regressionstests, vollständige Typechecks, Lint, Formatierung und Web-Build sind geprüft; verbleibende englische Nutzermeldungen und manuelle Testgrenzen sind dokumentiert.
- [x] #6 Die manuelle Abnahme durch den Nutzer ist erfolgt; erst nach ausdrücklicher Freigabe werden Haupttask und Untertasks auf Done gesetzt.
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

26.10.2026: Alle sechs Implementierungsgates sowie breite Prüfung aller248Dateien und scoped Nachprüfung der finalen16Dateien abgeschlossen. Sechs Important plus ein Minor aus Gesamt-Review behoben; keine offenen Reviewbefunde. Controller-Vollsuite165Dateien/1309Tests grün, Typecheck/Lint/Build grün. Finale globale Format-/Diffprüfung folgt nach dieser Backlogpflege; AC5 danach abhaken. Abnahmekriterium6 bleibt offen, bis der Nutzer manuell testet und das Schließen ausdrücklich freigibt. Prüfprotokoll docs/prowin/deutsche-uebersetzung.md; Branch feat/german-app, keine Commits/PRs/Deployments.

26.10.2026: Finale Controller-Verifikation vollständig abgeschlossen:165Dateien/1309Tests bestanden (maxWorkers2, unveränderte Timeouts), Typecheck, vollständiges Lint, globaler Formatcheck, Web-/Claude-Erweiterungsbuild und git diff --check grün.670Produkt-/Test-/Konfigurationsdateien bytegleich zum final unabhängig geprüften Snapshot. Alle technischen Akzeptanzkriterien1-5 nachgewiesen; AC6 ausdrücklich offen. Keine offenen Critical-/Important-Reviewbefunde. Änderungen weiterhin uncommittet auf feat/german-app; keine Zusammenführung, Veröffentlichung oder Deployment. Bitte erst nach ausdrücklicher manueller Nutzerabnahme auf Done setzen.

26.10.2026: Nutzer bestätigt im Chat, dass die Übersetzung erstmal passt, und autorisiert ausdrücklich die lokale Integration nach main inklusive geretteter Datenbank. Manuelle vorläufige Abnahme damit erfolgt. Kein Push/Deployment beauftragt. Aufgabenstatus bleibt mangels ausdrücklicher Freigabe zum Setzen auf Done unverändert; lokale Integration wird unter TASK-70 verfolgt.

26.10.2026: Vom Nutzer autorisierter lokaler Merge unter TASK-70 erfolgt: Feature a1ab4cc, Merge b08c265. Frische Vollsuite vor und nach Merge165Dateien/1309Tests grün, Typecheck/Lint/Format/Build ebenfalls. Aktueller geretteter Datenstand separat nach Hauptcheckout/data/pg übernommen und verifiziert. Kein Push/Deployment. Native/externe Prüfgrenzen bleiben bestehen, keine ausdrückliche Done-Freigabe angenommen.

27.10.2026: Ausdrückliche Nutzerfreigabe zum Abschluss: "ok, task auf done bitte. ebenso task 21, sowie Task 66ff - 69 (nice)." Die Freigabe umfasst die zugehörigen Untertasks. Dokumentierte Prüfgrenzen bleiben bestehen; dieser Abschluss behauptet keine zusätzlichen Live- oder nativen Tests. Keine weiteren Produktänderungen für den Abschluss erforderlich.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Deutsche App einschließlich Web, Server, Desktop-Ressourcen und iOS-Ressourcen umgesetzt, unabhängig geprüft, lokal nach main integriert und ausdrücklich zum Abschluss freigegeben. Native Builds und echte externe Abläufe bleiben gemäß Prüfprotokoll ungeprüft.
<!-- SECTION:FINAL_SUMMARY:END -->
