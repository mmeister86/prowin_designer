# TASK-36: Sharing-Entscheidung und Nachweise

## Ergebnis

- Private Weitergabe: Dateiexport oder „Als Datei teilen“ als Momentaufnahme.
- Galerie: bewusst veröffentlichte Vorlagen für angemeldete Nutzerinnen, kopierbar;
  kein Ersatz für private Freigabe.
- Bestehende Links bleiben Mitbearbeitungslinks. Sichtbare Warnung, eindeutiges
  Checkbox-Label in beiden Zuständen und Onboarding-Hinweis ergänzen die UI.
- Eigentümerlose Alt-Arbeitsflächen erhalten einen ausdrücklichen Hinweis auf
  ihren bestehenden offenen Zugriff, unabhängig von der Link-Einstellung.
- Keine Backend-, Rollen-, Datenbank- oder Dependency-Änderung; kein Read-only-Link.
- Q11, R5.2 und Rollen-Doku aktualisiert. AC3 ist mangels Read-only-Entscheidung
  nicht anwendbar; kein bedingter Umsetzungstask nötig.

## Council-Beratung

Eine Planungsrunde, keine Codebewertung angefordert.

| Modell          | Empfehlung                              | Bewertung |
| --------------- | --------------------------------------- | --------- |
| Claude Opus 5.5 | Export/Galerie, klarer Bearbeitungslink | no score  |
| GPT-6.1 Sol     | Export/Galerie, klarer Bearbeitungslink | no score  |
| Muse Wonder     | Export/Galerie, klarer Bearbeitungslink | no score  |

## Umsetzung und Review

DeepSeek V4.1 Flash 1017 implementierte den zusammenhängenden Task im isolierten
Branch `task-36-sharing-decision`. Kleine Review-Korrekturen führte der Controller
gemäß Harness-Vorgabe lokal aus; jeweils Red/Green-Tests und frisches Terra-Review.

| GPT-6.1 Terra                    | Erstprüfung                                                     | Nachprüfung                                       |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| Task: Spezifikation und Qualität | 7/10: deaktiviertes Checkbox-Label missverständlich             | 9/10: korrigiert, keine offenen Findings          |
| Gesamter Branch                  | 7/10: falsche Datenschutz-Zusage für eigentümerlose Altbestände | 9/10: korrigiert, keine neuen Defekte im Fix-Diff |

## Tests und Qualität

| Prüfung                                            | Ergebnis                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Neue Regressionstests initial                      | RED: 11 erwartete Fehler, danach 14 bestanden                                           |
| Checkbox-Korrektur                                 | RED: 1 erwarteter Fehler; Eigentümer-Formulierung: 2 erwartete Fehler                   |
| Legacy-Korrektur                                   | RED: 3 erwartete Fehler; danach 17 neue Tests bestanden                                 |
| Finaler Code, Sharing/Zugriff/Galerie/Dateiexport  | **68/68 Tests**, 6 Dateien, bestanden                                                   |
| Typecheck, Lint, gezielter Prettier-Check          | Bestanden nach letztem Codefix                                                          |
| Production-Build                                   | Bestanden nach Legacy-Textfix; vorhandene Bundlegrößenwarnung                           |
| Doc-Lint                                           | Bestanden, 1 zeitstempelbasierte Stale-Docs-Warnung                                     |
| Erster vollständiger Testlauf                      | 2147 bestanden, 12 Timeouts in 5 Dateien                                                |
| Die 5 betroffenen Dateien einzeln mit einem Worker | **28/28 bestanden**                                                                     |
| Vollständiger Lauf mit 2 Workern                   | **2159/2159 bestanden**, 239 Dateien; vor Legacy-Fix, 503.69s                           |
| Vollständiger Lauf auf finalem Code mit 4 Workern  | 2130 bestanden, 32 Browser-Fehler in 5 Dateien; paralleler Build, nicht sauber isoliert |
| Finaler isolierter Gesamtlauf mit 2 Workern        | **2162/2162 bestanden**, 239 Dateien, 513.38s                                           |

Die ersten Full-Suite-Timeouts betrafen `bootGuard`, `germanUiReview`,
`legacyPagesMigration`, `prowinMigration` und `safeZoneBrowser`. Alle bestanden
beim kleineren Ein-Worker-Lauf; das belegt nicht die genaue Timeout-Ursache.
Bekannte Baseline-Ausgaben: Node-localStorage-Warnung und `ECONNREFUSED` auf
localhost:3000 in bestehenden UI-Tests. Nicht unterdrückt oder nebenbei repariert.

Beim Vier-Worker-Lauf liefen gleichzeitig Build-Schritte, die
`public/claude-extension/doop.mcpb` schrieben. Browser-Fixtures verwenden
Vite-Entwicklungsserver; der Fehlerverlauf enthielt verlorene DOM-Knoten und
danach fehlende Harness-Globals. Ein Reload ist eine plausible Erklärung,
aber keine abschließend bewiesene Ursache. Betroffen: `drawingBrowser`,
`elementPanelBrowser`, `elementResizeBrowser`, `framePresetBrowser`,
`safeZoneBrowser`. Der anschließende Gesamtlauf auf unverändertem finalem
Code ohne parallelen Build oder Dateiänderungen bestand vollständig.

Verifikationslogs und SDD-Artefakte: `/tmp/opencode/task-36-verification.tar.gz`.

## Entscheidungen im Auftrag des Nutzers

Der Nutzer akzeptierte Empfehlungen vorab.

1. **Export/Galerie statt privatem Live-Ansichtslink:** einstimmiger Council;
   Kosten bei falscher Wahl: später separate sicherheitsgeprüfte Funktion nötig.
2. **Kurzer Onboarding-Hinweis trotz Muse-Einwand:** AC2 ausdrücklich erfüllen;
   Kosten: ein zusätzlicher Absatz, keine neue Aufgabe oder Bestätigung.
3. **Controller-Session im Hauptcheckout belassen, ausschließlich im Worktree
   arbeiten:** Session-Wechsel entfernte T3-Delegationstools; absolute Pfade und
   explizites Arbeitsverzeichnis verhindern Eingriffe in vorhandene Nutzerarbeit.
   Risiko: Verzeichnisverwechslung, deshalb konsequent getrennte Pfade.
4. **Stabiles Freigabe-Label und separater Status:** Terra-Fund beheben;
   Kosten: zusätzliche Statuszeile, keine Änderung der Freigabehandlung.
5. **Altbestände ohne Eigentümer ausdrücklich als offen kennzeichnen:**
   `server/access.ts:28` muss sich korrekt in der UI widerspiegeln;
   Kosten: zusätzlicher Warntext, bestehende Zugriffspolitik unverändert.

## Übergabe

- TASK-36 bleibt **In Progress**, alle AC geprüft, Nutzerabnahme steht aus.
- Branch/Worktree bleiben erhalten; kein Push, PR oder Merge.
- Keine manuelle Desktop-/Mobilgeräteabnahme durchgeführt.
- Weitergegebene Dateien sind nicht widerrufbar; vorhandene Bearbeitungslinks
  und offene eigentümerlose Altbestände behalten ihre bisherigen Rechte.
