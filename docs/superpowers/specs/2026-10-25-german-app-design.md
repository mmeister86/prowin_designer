# TASK-68: Vollständige deutsche App

## Auftrag und Abnahme

Der Nutzer hat nach dem Übersetzungs-Audit ausdrücklich beauftragt: „ja, bitte übersetze die komplette app auf deutsch“.
Web, Desktop und iOS einschließlich Live Activities gehören zum Auftrag, nicht nur die im Testdeploy sichtbaren Seiten.
Backlog: TASK-68 mit TASK-68.1 bis TASK-68.6. Abschluss erst nach ausdrücklicher manueller Nutzerabnahme.

## Umsetzungsvorschlag

Die folgenden Detailentscheidungen sind Vorschläge des implementierenden Agenten, keine bereits einzeln bestätigten Nutzerentscheidungen:

- Deutsch ist die feste App-Sprache, mit freundlicher Du-Ansprache. Kein Sprachumschalter, keine zusätzliche Abhängigkeit und kein neues Mehrsprachen-Framework.
- Bestehende Textdefinitionen und gemeinsame UI-Standards direkt übersetzen; vorhandene Formatierungshelfer wiederverwenden. Nur mehrfach benötigte fachliche Anzeigenamen zentralisieren.
- Glossar: Canvas → Arbeitsfläche, Frame → Zeichenfläche, Workspace → Arbeitsbereich, Layer → Ebene, Owner → Eigentümer, Member → Mitglied, Memory → Designwissen, Task → Aufgabe, Agent → Agent, AI → KI. Creator bleibt der eingeführte Rollenname; technische Werte bleiben englisch.
- Produkt-, Marken-, Modell- und Schriftfamiliennamen unverändert lassen. Community, Layout, HTML, CSS, PNG, JPG, MCP, API und Webhook dürfen als etablierte Fachbegriffe bleiben.

## Enthaltener Umfang

- Alle eigenen Web-Seiten, Navigation, Einstellungen, Admin, Editor, Suche, Freigaben, Kontoverwaltung, Export, Kommentare, Aufgaben und Designwissen.
- Onboarding, KI-/Datenschutzhinweise und Zustimmungsdialoge ohne inhaltliche Abschwächung; Accessibility, Tooltips, Tastaturhilfen, leere Zustände und Erfolgsmeldungen.
- Auch eigene Texte derzeit deaktivierter optionaler Funktionen übersetzen, ohne Funktionen zu aktivieren oder Daten zu löschen.
- Servermeldungen, die Nutzer sehen, E-Mail-Betreff und -Text, Willkommensdemo, neu erzeugte Standardnamen sowie geteilte Status-, Kategorien-, Rollen- und Tarifbeschreibungen.
- Bekannte externe Auth-Fehler anhand stabiler Codes deutsch anzeigen; unbekannte technische/providerseitige Fehler erhalten eine sichere, verständliche deutsche Ersatzmeldung. Bereits vorhandene Validierung und Wiederherstellungsmöglichkeiten bleiben erhalten.
- Neue app-eigene Beispielprompts und Vorlagen deutsch formulieren. Für neue Agentenantworten Deutsch als Standard nennen; ausdrückliche andere Sprachwünsche der Nutzer und technische Tool-Verträge bleiben maßgeblich.
- HTML-Sprachangabe, Titel und Metadaten; sichtbare Metadaten der gebündelten Claude-Erweiterung.
- Desktop: eigene Rust-/Tauri-Menüs und Dialoge, Installer-Sprache und tatsächliche DMG-Hintergrundgrafik, nicht nur deren HTML-Vorlage.
- iOS: eigene SwiftUI-Oberflächen, Fehler, VoiceOver, Standardnamen, Sprachdeklaration und Live-Activity-Extension. Eine feste deutsche Sprache braucht keinen parallelen englischen Übersetzungskatalog; Ressourcen müssen nur für tatsächlich verwendete Lokalisierungsaufrufe angelegt und dem richtigen Bundle zugeordnet werden.
- Relative Zeiten deutsch; Nutzeranzeigen für Datum, Uhrzeit und Zahlen verwenden `de-DE` beziehungsweise `de_DE`. Preisbeträge und Währung bleiben unverändert: USD werden nur deutsch formatiert, nicht in EUR umgerechnet.

## Grenzen und Schutz vor Regressionen

- Keine bestehenden Arbeitsflächen, Kommentare, Namen, Designs, HTML-Inhalte, Aufgaben oder gespeicherten Nutzervorlagen nachträglich übersetzen oder umbenennen.
- IDs, Rollenwerte, JSON-Schlüssel, Fehlermaschinencodes, URLs, Routen, CSS-Werte, Tastaturkürzel, Header und Modell-IDs bleiben unverändert. Technische numerische Werte müssen weiter maschinenlesbar sein.
- Keine pauschale Übersetzung aller String-Literale: Entwicklerlogs, Quelltextkommentare, API-/MCP-Schemas, überwiegend technische Agentenanweisungen, externe Abhängigkeiten/BlitzKit, Entwicklerdokumentation und Storybook-Beispielinhalte sind keine deutsche Endnutzeroberfläche.
- Keine Provider-, Berechtigungs-, Datenschutz-, Tarif-, Deployment- oder Produktidentitätsänderungen. Die bestehende Desktop-Serveradresse wird nicht nebenbei umgestellt.
- Serverantworten mit rein menschlichem Text dürfen deutsch werden; bisher als Codes ausgewertete Texte benötigen kompatible Erkennung statt blinder Ersetzung, insbesondere beim Signup-Redirect.

## Nachweise

Tests sichern neue Formatierungs-/Fehlerlogik und die deutschen Kerntexte; vorhandene Verhaltenstests werden mitgeführt, nicht abgeschwächt. Danach vollständige Tests, Typecheck, Lint, Formatierung und Web-Build. Unabhängige Prüfung sucht verbliebene app-eigene englische Texte und technische Vertragsänderungen.

Unter Linux sind erfolgreiche iOS-/macOS-Builds, VoiceOver und DMG-Installation nicht belegbar. Diese Prüfungen bleiben ausdrücklich offen; gleiches gilt für nicht ausgeführte echte OAuth-/SMTP-/Zahlungsabläufe und die manuelle Prüfung deutscher Layoutumbrüche. Der Quelltextbefund ersetzt diese Abnahme nicht.
