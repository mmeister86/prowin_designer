# Zeige Template-Sperren im Editor — TASK-31

## Intent

Beraterinnen erkennen im bestehenden Editor, welche Teile einer Vorlage sie
personalisieren dürfen. Nicht erlaubte Eingaben werden möglichst vor dem Save
verhindert; der Server-Guard aus TASK-30 bleibt die verbindliche Absicherung.
Creator behalten den vollständigen Editor und die Metadatenbearbeitung.

## Approaches

- **Gewählt (Nutzerfreigabe 01.11.2026):** Bestehenden Editor gezielt erweitern.
  Vorhandene Komponenten, Capability-Abfragen und Save-/Rollback-Pfade nutzen.
- **Verworfen:** Separates Beraterinnen-Formular. Größerer Navigations- und
  Datenflussumbau ohne Anforderung in TASK-31.
- **Verworfen:** Nur Schloss-Badges und Serverfehler. Verhindert weder falsche
  Auswahl noch unnötig abgelehnte Farb-/Texteingaben.

## Global Constraints

- Rollen über die bestehende Canvas-Capability `manageLocks` bestimmen, nicht
  über Workspace-Adminstatus oder ein neues Creator-Flag. Bis zum Laden gilt
  die bestehende fail-closed Voreinstellung.
- `data-od-locked` sperrt für Nicht-Creator den gesamten Teilbaum. Präsenz zählt,
  auch bei leerem Attributwert. Creator dürfen Template-Sperren bearbeiten.
- Bestehende `data-doop-locked`- und Frame-Sperren behalten ihre bisherige
  Bedeutung; keine Migration oder Zusammenlegung der Sperrmodelle.
- In templatehaltigen Frames friert TASK-30 Inhalte außerhalb editierbarer
  Felder ein. UI und Agent dürfen diese nicht als frei bearbeitbar anbieten.
  Frames ohne Template-Felder behalten das bisherige Verhalten.
- Farblisten enthalten komma-getrennte Namen aus `BRAND_TOKENS` ohne `--`.
  Änderungen schreiben `var(--<token>)`, niemals Hex-/RGB-Ersatzwerte.
  Verschachtelte Feldgrenzen gelten gemeinsam, nicht nur das nächste Feld.
- Textlimits zählen wie der Server dekodierte Unicode-Codepoints des gesamten
  jeweiligen Felds, einschließlich Nachfahren. Auch Vorfahrenlimits beachten.
  Unveränderte überlange Bestandsinhalte bleiben resavable; keine stille Kürzung.
- Servervalidierung, Metadatenvertrag und Rollenmodell nicht abschwächen.
  Abgelehnte Saves zeigen verständliches deutsches Feedback und stellen den
  gespeicherten Zustand in Store und Live-Dokument wieder her.
- Keine neuen Dependencies, kein neues Formular, keine Arbeit an TASK-77/78,
  kein Push, PR oder Merge. TASK-31 bleibt bis Nutzerabnahme In Progress.

## Editor-Verhalten

**Builder-Check-Entscheidungen:** Nicht markierte/eingefrorene Elemente dürfen
zur Orientierung ausgewählt werden, bleiben für Nicht-Creator aber read-only.
Das strikte Auswahlverbot gilt für Template-Sperren und deren Nachfahren.
Agenten haben derzeit keine Capability-Abfrage: ohne ausdrücklichen Auftrag
zur Vorlagenerstellung gelten die Nicht-Creator-Regeln. Bei explizitem
Authoring-Auftrag dürfen sie Änderungen versuchen; nur die serverseitig
geprüfte Identität autorisiert sie. Ein 403 beendet den Versuch ohne Umgehung.

- **FrameView / Runtime:** Template-gesperrte Elemente und deren Nachfahren
  sind für Nicht-Creator weder auswählbar noch inline editierbar. Ein sichtbarer
  Schloss-Hinweis erklärt die Sperre. Direkte Layer-/Code-Auswahl und bereits
  aktive Auswahl nach Rollen-/HTML-Änderung dürfen das nicht umgehen.
- **LayersPanel:** Gesperrte Zeilen bleiben mit Schloss und zugänglichem Label
  sichtbar. Auswahl per Maus/Tastatur sowie Kontext-/Drag-/Delete-Aktionen
  beachten denselben Template-Schutz; Creator behalten die Bearbeitung.
- **ElementPanel:** Sperr-/Feldstatus anzeigen; eine veraltete oder direkte
  Auswahl kann keine gesperrten Änderungen auslösen. Bei eingeschränkten
  Farben nur erlaubte Token anbieten, einschließlich SVG-/Rahmen-/Füllfarben,
  soweit die bestehenden Controls sie bearbeiten. Keine Alpha-Umgehung.
  Nicht erlaubte Layout-/HTML-Änderungen im Template-Kontext nicht anbieten.
- **Texteingabe:** Tippen, Auswahlersetzung, Einfügen und IME/Composition
  berücksichtigen. Überschreitung verhindern oder die letzte gültige Eingabe
  wiederherstellen und erklären; keine bestehenden Texte abschneiden.
- **Fehler:** Bestehende Notices und Rollback verwenden; keine parallele
  Fehler-Infrastruktur. Ein Server-403 ist kein erfolgreicher lokaler Save.

## Agent und MCP

Die gemeinsam verwendete Anleitung erklärt Rollen und alle sechs Attribute,
stabile IDs, eingefrorene Teilbäume und Struktur, Tokenfarben, Textlimits und
den Umgang mit Ablehnungen. Agenten dürfen ihre Rolle nicht selbst erhöhen
oder Constraints entfernen. Tests weisen nach, dass residenter Prompt und
MCP-Guide dieselben Regeln erhalten und reale Agent-/MCP-Edits weiterhin den
serverseitigen Guard durchlaufen.

## Umsetzung und Nachweis

1. Client-Policy an den bestehenden Layer-/Permission-Helfern aufbauen;
   Auswahl und Sperrhinweise in den drei Oberflächen und Runtime verbinden.
2. Tokenwahl, Inline-Textlimits und Save-Feedback mit Regressionstests ergänzen.
3. Gemeinsame Agent-/MCP-Anleitung und Integrationstests vervollständigen.

Muse Spark 1.3 implementiert sequenziell; Muse Wonder prüft jeden Schritt auf
Spec und Qualität und anschließend den gesamten Branch. Bestehende Tests
zuerst als Baseline, neue Tests vor Produktivcode; am Ende Gesamtsuite,
Typecheck, Lint, Build, Doku- und Diff-Prüfung. Browsernahe Automatisierung
nutzt vorhandene Test-Harnesses; manuelle Abnahme bleibt beim Nutzer.
