# TASK-36: Ansichts- und Mitbearbeitungslinks trennen

## Entscheidung und Ziel

Q11 wird am 04.11.2026 zugunsten bestehender Dateiexporte und der Galerie
entschieden. Es wird kein privater Read-only-Link implementiert oder angekündigt.
Dateien sind Momentaufnahmen ohne Zugriff auf das Original und nicht widerrufbar.
Die Galerie dient bewusst veröffentlichten, kopierbaren Vorlagen für angemeldete
Nutzerinnen, nicht dem privaten Teilen von Kundendesigns. Veröffentlichen bleibt
an bestehende Creator-/Eigentümerrechte gebunden.

## Ansätze

1. **Empfohlen: Export/Galerie und ehrliche Linktexte.** Keine neue Rechteebene,
   vorhandene Wege reichen für diesen Meilenstein. Nachteil: kein privater,
   aktualisierbarer und widerrufbarer Ansichts-Link.
2. **Privaten Read-only-Link ergänzen.** Würde getrennte serverseitige Lese-/
   Schreibprüfung in REST, WebSocket und MCP einschließlich Widerruf benötigen.
   Für TASK-36 unnötig groß; nicht gewählt, deshalb kein bedingter AC3-Folgetask.

Claude Opus 5.5, GPT-6.1 Sol und Muse Wonder empfehlen Ansatz 1 einstimmig.
Der Nutzer hat empfohlenen Entscheidungen vorab zugestimmt. Meine zusätzliche
Entscheidung: ein kurzer Onboarding-Absatz erfüllt AC2 ausdrücklich; Muse hält
den ShareModal-Hinweis allein für ausreichend. Kein neuer Onboarding-Schritt.

## Umfang

- ShareModal: bestehende Bearbeitungsoption als solche benennen, Anmeldung
  präzisieren, sichtbarer Hinweis bei aktivem Link für Owner und Nicht-Owner.
- Copy-Button bei aktivem Link: „Bearbeitungslink kopieren“, sonst „Link kopieren“.
  Kopieren ändert keine Rechte. Inaktiver Link: Zugriff für Eigentümer,
  eingeladene Personen und gegebenenfalls Workspace-Mitglieder korrekt erklären.
- Historische Arbeitsflächen ohne Eigentümer ausdrücklich als offen kennzeichnen:
  `server/access.ts` erlaubt dort Zugriff unabhängig von `linkAccess`. Keine
  Datenschutz-Zusage oder Rechteänderung für diesen Altbestand.
- Dateiexport als Alternative zum reinen Zeigen nennen. Galerie nur im bereits
  berechtigten Veröffentlichungsbereich bewerben. Dort keine pauschale Zusage
  „bleibt privat“, da ein unabhängiger Bearbeitungslink aktiv sein kann.
- Onboarding: kurzer Teilen-Hinweis im gemeinsamen Checklist-Inhalt, vor
  Agentenverbindung auf Desktop und Mobil sichtbar; Fortschritt, Zwei-Schritte-
  Zähler und KI-Hinweis bleiben unverändert.
- Q11, R5.2 und Canvas-Grenzen der Rollen-Doku konsistent aktualisieren; dort
  falsche Aussage über unangemeldeten Galerie-Zugriff korrigieren.
- Kleine Render-/Interaktionstests für Links, Workspace-Zugriff, Galerie und
  Onboarding; vorhandene Zugriffs-/Galerie-/Exporttests weiter ausführen.

## Verbindliche Grenzen

- Keine Backend-, Datenbank-, REST-, WebSocket-, MCP- oder Rollenänderung.
- `linkAccess` bleibt ausschließlich `'edit' | 'none'`; Kopieren aktiviert nichts.
- Keine neuen Dependencies, Abstraktionen, Onboarding-Schritte oder Speicherfelder.
- Deutsche sichtbare Texte; vorhandene UI-Komponenten und Textstufen verwenden.
- Kein Ansichtsmodus behaupten; Galerie niemals als private Freigabe bewerben.
- TASK-36 bleibt bis zur ausdrücklichen Nutzerabnahme In Progress.
- Vorhandene Nutzeränderungen im Hauptcheckout nicht verändern.

## Abnahme und Risiken

AC1: Entscheidung in Q11 und Referenzen dokumentiert. AC2: UI/Onboarding korrekt
und getestet. AC3 ist bedingt und hier nicht anwendbar; das im Task begründen.
Bestehende Bearbeitungslinks bleiben riskant bei unbedachter Weitergabe; diese
Aufgabe ändert ihre Rechte nicht. Manuelle Geräteabnahme bleibt beim Nutzer.
