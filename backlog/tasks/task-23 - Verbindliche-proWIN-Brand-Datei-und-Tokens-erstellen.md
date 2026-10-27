---
id: TASK-23
title: Verbindliche proWIN-Brand-Datei und Tokens erstellen
status: Done
assignee: []
created_date: '2026-10-23T09:51:00Z'
updated_date: '2026-10-26T20:17:00Z'
labels:
  - prowin
  - implementation
milestone: m-3
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DESIGN-prowin.md wird die gemeinsame Quelle für Agent, Memory und Magnific. Konkrete Markenwerte und Nutzungsrechte müssen aus freigegebenen Unterlagen stammen.

Quellen: Umsetzung § 8.1; Referenz R4.2, R1.10
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Brand-Datei enthält Tonalität, Farben/Tokens, Typografie, Logo-Regeln, Bildsprache, Produktnamen, Disclaimer, Sprache und Pflicht-Rollen je Format.
- [x] #2 Token-Werte und Schriftfamilien sind belegt; fehlende Freigaben werden offen markiert statt erfunden.
- [x] #3 Markenauftritt formuliert für proWIN-Beraterinnen; Logo-Nutzung und Pflicht-Disclaimer sind geklärt.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehende Vorgaben und Quellenlage prüfen; Recherche auf Website, Werbemotive und Kataloge aufteilen.
2. Primärquellen und visuelle Belege parallel sammeln und auswerten; beobachtete Gestaltung von verbindlichen Freigaben trennen.
3. Erkenntnisse mit Quellen und offenen Freigaben in DESIGN-prowin.md verdichten; keine Runtime-Tokens oder Produktcode implementieren.
4. Quellen und Vollständigkeit prüfen, Recherche dokumentieren; Task bis zur ausdrücklichen Nutzerabnahme offen lassen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-26: Recherche auf ausdrücklichen Nutzerwunsch gestartet. Schwerpunkt offizielle Werbeanzeigen und Kataloge, parallele Webrecherche und visuelle Stilanalyse. Bestehende Nutzeränderung an Task 70 bleibt unangetastet.

2026-10-26: Rechercheentwurf erstellt: DESIGN-prowin.md (250 Zeilen); Kurzbericht reports/proWIN Design aus Werbemitteln.md. Drei parallele Recherchebereiche (Dana Scully: offizielle Website/CI/Rechte; Miranda Priestly: Kataloge; Don Draper: Werbung), Synthese Edna Mode, unabhängiger Quellencheck Hermione Granger. Detailnotizen und acht kleine interne Bildbelege unter research_notes/proWIN Design aus Werbemitteln/.
Belastbare Basis: offizieller CI-Guide Juli 2026 v2.8; sechs visuell betrachtete Seiten aus zwei aktuellen Magazinen; vier Werbemittel mit mehreren visuell betrachteten Motiven. Sofia Sans Print / Roboto Web belegt; Brush-Schriften zusätzlich nur als PDF-Befund. Aktueller Name new wellness und best-friends-Sortimentsumstellung berücksichtigt.
Prüfung: direkter CI-PDF-GET HTTP 200, 16 Seiten, 2303952 Bytes, SHA-256 a8343ec37422defb9f96b03390fbe09a14e4a7a915a2d669d9191c964481b120; Zahlenkonflikte und Logo-Regeln gegen Quellseiten geprüft. Zwei Präzisierungen aus Audit übernommen (Negativlogo nur bei Kontrastproblemen auf dunklem Grund; schwächere Herkunftskette des Testwochen-Flyers). 21 lokale Markdown-Links und Inhalts-/Statusmarker geprüft, acht Bilddateien vorhanden; git diff --check ohne Befund. Visuelle Übersicht mit html_preview geprüft.
Offen vor verbindlicher Umsetzung: CI-RGB/Hex- und SVG-Farbkonflikte samt Token-Zuordnung; Typografie für Exportgrafiken, konkrete Fontlizenzen; Originalasset-/Marken-/Template-/Personenrechte; verpflichtende Beraterinnen-Absenderformel; aktuelle Claim-/Angebotsfreigaben. Insbesondere AC3 noch nicht erfüllt. Keine Runtime-Tokens, Fontinstallation, Agent-Einspeisung oder Produktcodeänderungen; keine Produktionsfreigabe und keine Nutzerabnahme. Status bleibt In Progress; nicht als Done schließen.

2026-10-26 Nutzerentscheidungen zur Weiterführung: (1) Die im CI-Handbuch abgedruckten Farben und die dokumentierten Token-Namen gelten für das Projekt; als digitale Referenz werden die wörtlichen CI-Hexwerte verwendet, Zahlenkonflikte bleiben als Quellenbefund erhalten. (2) Gestaltung und Typografie orientieren sich am CI-Handbuch. Laut Nutzerwissen aus erster Hand nutzt auch die Zentrale KI-Inhalte, die nicht zwingend CI-konform sind; dies ist Kontext, keine pauschale Ausnahme für den Projekt-Agenten. (3) Mindestens Inhalte aus CI-Handbuch und Pressekit sind vom Nutzer zur Nutzung im Projekt vorgesehen; keine unabhängig geprüfte Lizenzfreigabe behaupten. (4) Vorläufiger zusätzlicher Projekt-Pflichthinweis exakt: „Mit Unterstützung von KI erstellt“. Bestehende produkt-/angebotsbezogene Pflichtangaben bleiben erhalten.
Nächster Schritt: DESIGN-prowin.md und Rechercheübergabe konsistent auf diesen Entscheidungsstand aktualisieren, historische Recherche-Notizen erhalten, Wortlaut/Quellenlinks/Farbwerte prüfen. Keine Runtime-Implementierung und keine automatische Schließung von TASK-23.

2026-10-26: Nutzerentscheidungen durch Edna Mode in DESIGN-prowin.md und reports/proWIN Design aus Werbemitteln.md eingearbeitet und anschließend unabhängig gelesen/geprüft. Leitfaden führt jetzt Projektentscheidungen gesondert: CI-Hexwerte digital maßgeblich; CI als Gestaltungs-/Typobasis; mindestens CI-/Pressekit-Originalmaterial nach Nutzervorgabe als Materialbasis; zusätzlicher KI-Hinweis exakt „Mit Unterstützung von KI erstellt“, sichtbar und exportlesbar als body in sämtlichen KI-unterstützten Formaten einschließlich Story. Nutzerangabe zur KI-Praxis der Zentrale als solche dokumentiert, keine globale CI-Ausnahme. Zusätzliche allgemeine Beraterinnenformel wird nicht automatisch ergänzt; sachlicher Kontakt und produkt-/angebotsbezogene Pflichtangaben bleiben.
Verifikation: alle 13 CI-Token/Hex-Paare gegen bisherigen Bestand geprüft, 21 lokale Links vorhanden, Story-body-Pflicht und Abgrenzung zu unabhängiger Rechteprüfung geprüft; veraltete Farbblocker entfernt; git diff --check ohne Befund. Keine Runtime-Implementierung, neue Recherche oder Commits. Task bleibt In Progress; keine automatische Abschlussabnahme aus den vier Sachentscheidungen ableiten.

2026-10-26 Abschlussabnahme: Nutzer hat auf die ausdrückliche Frage, ob TASK-23 offiziell auf Done gesetzt werden soll, mit „ja“ geantwortet. AC1/2 anhand der vorhandenen Abschnitte, 13 dokumentierten CI-Farbtoken und belegten Schriftfamilien geprüft; 21 lokale Links vorhanden. AC3 projektseitig durch Nutzerentscheidungen zu CI-/Pressekit-Materialbasis und exaktem KI-Hinweis sowie ausdrückliche Abnahme bestätigt; dies ist keine unabhängige Lizenz-/Rechtsprüfung. Leitfaden und Recherchebericht enthalten nun den Abnahmestand statt des alten In-Progress-Vermerks. Vereinfachung geprüft: keine zusätzliche Konfiguration oder Produktcode nötig, zentrale Quelle bleibt DESIGN-prowin.md. Technische Integration, Fontbereitstellung und Exportprüfung bleiben separate Folgeaufgaben.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Quellengebundene DESIGN-prowin.md mit CI-Farben/Tokenreferenzen, Typografie, Logo-Regeln, Bildsprache, Produktnamen, Formatrollen und KI-Hinweis erstellt; offizielle CI, Kataloge und Werbemotive ausgewertet. Nutzerentscheidungen übernommen und Abschluss am 26.10.2026 ausdrücklich bestätigt. Recherchebericht, Detailnotizen und acht interne Bildbelege vorhanden. Technische Integration nicht umgesetzt; Nutzungsumfang projektseitig festgelegt, keine unabhängige Rechteprüfung.
<!-- SECTION:FINAL_SUMMARY:END -->
