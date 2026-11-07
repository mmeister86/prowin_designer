# M4-Abnahmematrix (TASK-37)

Stand: 07.11.2026. **Keine Milestone-Freigabe**: manuelle Nutzerabnahme und echtes
Teilen auf den Zielplattformen stehen aus. TASK-37 bleibt In Progress.
Grundlage: [Umsetzung §§ 9, 10, 14](doop-fork-umsetzung.md).

## AC und Belege

Die Kriterien sind wörtlich aus `backlog task 37 --plain` übernommen.
Testpfade beziehen sich auf das Repository-Wurzelverzeichnis.

| AC  | Wortlaut                                                                                                         | Präzise automatisierte Belege                                                                                                                                                                                                                                                                                                                        | Abnahmestatus                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Creator erstellt eine Vorlage mit Sperren und Constraints; Beraterin kann ausschließlich erlaubte Felder ändern. | `tests/m4Acceptance.test.ts`: echte Creator-/Member-Identitäten und DB, offener Text Hallo → Hallo Welt, Blau → Orange; gesperrtes Logo, Constraint-Entfernung, 25 Zeichen und Rot über REST/MCP abgelehnt; vollständiger Frame-/Versionsvergleich.                                                                                                  | Ergebnis siehe frische Prüfung unten; manuelle UI-Checkliste offen.                                    |
| 2   | Preset, Safe Zones, Speicherung, Exportmaße und Teilen funktionieren zusammen.                                   | `tests/m4Acceptance.test.ts`: echter Neustart mit derselben DB, ig-story, Override oben 210/rechts 20/unten 260/links 20, PNG/JPG-Downloads 1080 × 1920. `tests/presetExportReal.test.ts`: alle fünf Formate. `tests/safeZoneExportReal.test.ts`: Overlay-Isolation. `tests/frameShare.test.ts`, `tests/frameShareActions.test.tsx`: Share-Handling. | **Offen**: echte Share-Ziele und native Plattformen fehlen; simulierte APIs beweisen keine Zustellung. |
| 3   | Direkte und Agent-Edits können keine Sperren umgehen; Typecheck und relevante Tests bestehen.                    | `tests/m4Acceptance.test.ts`: authentifiziertes Member-MCP trotz agent_name Creator, positive Kontrolle, unveränderte Daten bei Ablehnung, Creator-Selbstregistrierung gibt Workspace-Member keine Rechte, Schutz nach Neustart. Weitere Pfade unten.                                                                                                | Ergebnis siehe frische Prüfung unten.                                                                  |

### Ergänzende Szenarien

- `tests/templateWrites.test.ts`: Member-Restore entfernt keine Sperre (403, keine Writes), quellengestützte Kopie erhält Schutz.
- `tests/templateTransports.test.ts`: MCP und Resident verweigern gesperrte Member-Edits; gültige Creator-Edits und quellengestützte Member-Kopien sind erlaubt.
- `tests/templateCopyProvenance.test.ts`: Clipboard/Duplizieren/Redo übergeben die Quellen-ID.
- `tests/templateGuide.test.ts`: identischer Guide in MCP und Resident; Serveridentität entscheidet.
- `tests/formatPresetTransports.test.ts`, `tests/formatPresetPersistence.test.ts`, `tests/safeZonePersistence.test.ts`: Restore-/Transportgrenzen und Persistenz.
- `tests/presetExportReal.test.ts`: PNG und JPG in ig-post 1080 × 1080, ig-story und wa-status 1080 × 1920, fb-post 1200 × 630, a4 2481 × 3509; echte Chromium-Pixel und gespeicherte Sondermaße.
- `tests/presetExportStrictReal.test.ts`: echte Fonts, Fehler/Timeout und Erholung des Renderers.
- `tests/safeZoneExportReal.test.ts`: PNG pixelidentisch bei Override/Reset, JPG ohne Overlay-Tönung. Persistenz und Identität sind hier teilweise gemockt; der gemeinsame echte DB-Nachweis kommt aus Task 1.
- `tests/frameShare.test.ts`, `tests/frameShareActions.test.tsx`: vorbereitete Datei, MIME, ein Fetch, Abbruch, Retry, veraltete Vorbereitung und Download-Fallback mit simulierten Web-APIs.
- `tests/nativeFrameShare.test.ts`: Quelltext-/Wiring-Prüfung; kein nativer Lauf und keine Share-Sheet-Abnahme.

## Schutzgrenzen

- `Frame.locked` ist eine Bedienungssperre. Inhaltsschutz und Constraints entstehen durch `data-od-*` und serverseitige Prüfung von `manageLocks`.
- Aktuelle Admin-Ausnahme: Creator-Identität plus Admin und Canvas-Zugriff darf Vorlagen verwalten; sonst erfordert ein Workspace owner/creator, ein persönlicher Canvas Eigentum. Kontostatus Creator allein genügt einem Workspace-Member nicht.
- Persönliche Creator-Kopien können eigene Vorlagenrechte besitzen. Dies ist keine unveränderbare Rechteverwaltung für alle späteren Kopien.
- Öffentliche aktuelle Bild-URLs sind keine privaten Momentaufnahmen. Datenschutz-Follow-up: **TASK-82 – Prüfe öffentliche Live-Bild-URLs** (To Do); nach Suche nach public/Datenschutz/Bild/Live ohne spezifischen vorhandenen Task angelegt. Keine Umsetzung hier.
- TASK-36 entscheidet Datei/Export für private Momentaufnahmen und Galerie für veröffentlichte Vorlagen statt privatem Ansichtslink. Keine neuen Viewer-Links.
- TASK-77/78 bleiben separate Folgearbeit; keine Produktions-, Berechtigungs- oder Dependency-Änderungen.

## Frische Prüfung

Geprüfter Produkt-/Teststand: `7f7d288136d06d3bb02d8b52a48cb01bfe493c7c`.
Der zweite Pflichtlauf prüfte `487e27b02550e0cb0111aec4ad739e06aba6d93c` ohne
parallele Dateiänderungen; gegenüber `7f7d288` unterscheiden sich nur Dokumentation
und Backlog, keine Produkt- oder Testdateien.
Datum: 07.11.2026. Linux, Bun **1.4.4**, packageManager-Pin **1.3.10**;
keine Dependencies aktualisiert. `CHROME_PATH=/usr/bin/chromium` für beide Testgruppen.
Rohlogs: `.superpowers/sdd/2026-11-07-m4-acceptance/task-2-*.log` im Planworkspace.

| Befehl                                                                                                 | Ergebnis                                                                                           |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `bun run typecheck`                                                                                    | Exit 0                                                                                             |
| `bun run lint`                                                                                         | Exit 0                                                                                             |
| `CHROME_PATH=/usr/bin/chromium bun run test --maxWorkers=4 --exclude tests/claudeExtension.test.ts`    | Exit 1: 235 Dateien / 2145 Tests bestanden, 4 Dateien / 15 Tests fehlgeschlagen, 0 Skips; 175,47 s |
| `CHROME_PATH=/usr/bin/chromium bun run test tests/claudeExtension.test.ts --maxWorkers=1`              | Exit 0: 1 Datei / 4 Tests bestanden, 0 Skips; 9,65 s                                               |
| Serieller Diagnoselauf der vier fehlgeschlagenen Browser-Suites (`--maxWorkers=1`)                     | Exit 0: 4 Dateien / 112 Tests bestanden, 0 Skips; 105,82 s                                         |
| Erneuter vollständiger Pflichtlauf ohne Extension, gleiche Argumente, keine parallelen Dateiänderungen | Exit 0: 239 Dateien / 2160 Tests bestanden, 0 Skips; 165,04 s                                      |
| Erneute separate Extension-Gruppe, gleiche Argumente                                                   | Exit 0: 1 Datei / 4 Tests bestanden, 0 Skips; 9,67 s                                               |
| `bunx prettier --check` auf den fünf geänderten Dokumentations-/Backlog-Dateien                        | Exit 0, alle fünf Dateien formatiert                                                               |
| `bun run doc-lint`                                                                                     | Exit 0, 0 Warnungen                                                                                |

Beide Pflichtgruppen wurden zunächst jeweils einmal ausgeführt und nach der
Diagnose auf unverändertem Produkt-/Teststand vollständig wiederholt. Alle 2160 Tests der ersten
Gruppe liefen ohne Skip, darunter Task 1 (2 Tests) und die echten Renderer-Suites
`presetExportReal`, `presetExportStrictReal`, `safeZoneExportReal`. Damit liegt
Exportevidenz vor; der abschließende Pflichtlauf ist mit **2164 bestandenen Tests,
0 Fehlern und 0 Skips** insgesamt grün. Der vorherige Fehlschlag bleibt als
Stabilitätsbeobachtung dokumentiert.

Fehler im Pflichtlauf: `elementResizeBrowser.test.ts` (11), `drawingBrowser.test.ts`
(1), `elementPanelBrowser.test.ts` (2), `safeZoneBrowser.test.ts` (1). Exakte Namen
und Stacktraces stehen in `task-2-suite.log` und `task-2-report.md`. Kontextverlust
(undefined Harness/DOM-Kontext) und Timing-/Speicher-Assertions in bestehenden
Vite-Browserfixtures; alle vier Suites bestanden danach seriell. Dies spricht für
einen Parallel-/Fixture-Umgebungseffekt; Ursache nicht abschließend bewiesen.
Auch Dokumentations-/Backlog-Dateien wurden während des ersten Laufs geschrieben;
ein Einfluss durch Vite-Watching ist nicht ausgeschlossen. Keine Produktdatei
weicht vom geprüften Basiscommit ab; keine unbezogenen Fixes oder Runneränderungen.
Der anschließende vollständige Lauf ohne parallele Dateiänderungen bestand; das
ist kein Beweis für die vermutete Ursache und kein behobener Produktfehler.
Zusätzliche Rohlogs: `/tmp/opencode/task37-frozen-suite.log` und
`/tmp/opencode/task37-frozen-extension.log` (lokal).
**AC1 und AC3 automatisiert belegt; AC2 und die manuelle Nutzerabnahme bleiben offen.**

Bekannte Ausgangslage: Node meldet `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.`
ESLint deckt Testdateien in der bestehenden Konfiguration nicht ab; Task 1 hat scoped oxlint und Typecheck bestanden.
Keine Runner-Konfiguration geändert. Ein Browser-Skip wäre kein Exportbeleg.

## Offene manuelle Nutzercheckliste

**Alle Zeilen sind unausgeführt.** Für Browser und Desktop jede Zeile pro Plattform
separat ausfüllen; Ergebnis muss konkretes Verhalten und ggf. Dateimaße nennen.
Automatisierte Chromium-Läufe ersetzen diese Prüfungen nicht.

| Plattform       | Prüfung                                                                                                    | Gerät/OS | Browser/App-Version | Datum | Ergebnis/Beleg |
| --------------- | ---------------------------------------------------------------------------------------------------------- | -------- | ------------------- | ----- | -------------- |
| Browser/Desktop | Erlaubtes Feld personalisieren; Schlossauswahl, Layers und Tastatur gegen gesperrtes Logo prüfen           | offen    | offen               | offen | offen          |
| Browser/Desktop | Nur erlaubte Farbe, Textlänge, Paste und IME prüfen; Ablehnung sichtbar und gespeicherter Wert unverändert | offen    | offen               | offen | offen          |
| Browser/Desktop | Reload: Text, Farbe, Preset und Safe Zone bleiben erhalten                                                 | offen    | offen               | offen | offen          |
| Browser/Desktop | Safe-Zone-Overlay sichtbar, im Export ohne Overlay; PNG/JPG auf 1080 × 1920 prüfen                         | offen    | offen               | offen | offen          |
| Browser/Desktop | Tatsächliches Web Share bzw. Desktop-Dateispeichern und Download; Zieldatei öffnen                         | offen    | offen               | offen | offen          |
| Browser/Desktop | Abbruch und Wiederholung, Offline und langsames Rendern prüfen                                             | offen    | offen               | offen | offen          |
| iOS             | Unzulässige Eingabe im HTML-Formular ablehnen; persistierten Wert prüfen                                   | offen    | offen               | offen | offen          |
| iOS             | PNG und JPG per Share Sheet nach Dateien und Fotos speichern, öffnen und Maße prüfen                       | offen    | offen               | offen | offen          |
| iOS             | Share Sheet abbrechen und erneut teilen                                                                    | offen    | offen               | offen | offen          |

Nutzerbestätigung zur M4-Abnahme: **offen**. Unabhängige Task-2-Review und finaler
Council sind Arbeit des Controllers und hier noch nicht als erfolgt dokumentiert.
