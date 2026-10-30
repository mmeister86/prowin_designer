# proWIN Reference Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Native lokale Ausführung wurde am 29.10.2026 vom Nutzer gewählt.

**Goal:** Richte die acht gestalterisch bestätigten Originalmotive als Memory-Referenzen ein und dokumentiere den gemeinsamen Brand-/Memory-/Font-/CSP-Nachweis an einer echten Layoutgenerierung mit PNG-Export.

**Architecture:** Verwende ausschließlich vorhandene HTTP-Upload-, Bildframe-, Guideline-, Memory-, Resident- und Exportpfade. Die Referenzen bleiben unveränderte Seitenbilder in einer eigenen Canvas; kein Nachzeichnen, kein PDF-Importer und keine globale Bibliothek. Dieser Plan ist ein Betriebs-/Kurationsauftrag, keine neue Produktfunktion.

**Tech Stack:** Bestehende Express-API mit Benutzer-Session, vorhandene PDF-Rasterwerkzeuge, Chromium, Requesty-EU-Resident; keine neue Abhängigkeit.

**Spec:** [Bestätigte Motivauswahl](../../../reports/proWIN%20Kataloge%20und%20Werbung%202026.md), [Umsetzung §8.2 und M3](../../prowin/doop-fork-umsetzung.md), TASK-28 mit drei unveränderten Acceptance Criteria, `DESIGN-prowin.md`.

## Global Constraints

- Genau acht Originalreferenzen aus der bestätigten Auswahl; keine eigenen Layouts als Ersatz für diese Motive.
- Die Bestätigung betrifft die gestalterische Auswahl, nicht Nutzungsrechte, Zugang, Modellkosten oder M3-Abnahme.
- **Vor Zieländerungen klären:** Zielinstanz, Eigentümer/Workspace und berechtigter Session-Zugang. Geheimnisse ausschließlich über den verfügbaren Secret-Kanal beziehen, nie im Chat oder Bericht.
- **Vor Upload und Modellaufruf klären:** Zulässiger Nutzungsumfang einschließlich Server-Upload, ohne Anmeldung abrufbarer `/a/`-/`/i/`-URLs und Referenzpixel-Übermittlung an das EU-Modell. Eine private Canvas schützt diese URLs bei Kenntnis des Links nicht.
- Globaler Brand-Leitfaden hat Vorrang. Originale einschließlich Logos, Quellenhinweisen und Angebotsbedingungen nicht nachbauen, umfärben oder beschneiden; unbekannte Rechte nicht als geklärt ausgeben.
- Keine bestehende Canvas, Referenz oder Guideline überschreiben; keine DB-Direktänderung, kein Neustart der Nutzerinstanz ohne Zustimmung.
- Kein Produktcode, keine dauerhaften Importskripte, keine Migration, keine automatische Verteilung an andere Canvases. Fehler außerhalb des Auftrags separat dokumentieren.
- Keine Live-Generierung ohne ausdrückliche Freigabe von Modellkosten und Referenzübermittlung; Regressionstests sind kein Live-Modellnachweis.
- Kein Commit/Push/PR ohne Auftrag; TASK-28 nur nach ausdrücklicher abschließender Nutzerabnahme auf Done setzen.

## Review Focus

1. **Falsche Seite, Beschnitt oder veraltetes Original:** Seitenzahl, vollständige Bedingungen, Seitenverhältnis und Quellzuordnung vor Upload visuell prüfen; geänderte Motive nicht still ersetzen.
2. **Falsches Konto oder überraschende Veröffentlichung:** Session-Identität und Ziel prüfen; öffentliche Asset-URLs vor dem ersten Upload ausdrücklich benennen, keine Freigabe aus dem Canvasnamen ableiten.
3. **Teilfehlgeschlagener Aufbau oder Wiederholung:** Erfolgreiche Asset-/Frame-/Pin-IDs sofort protokollieren; per GET abgleichen und nur fehlende Schritte fortsetzen, nichts pauschal löschen.
4. **Snapshot-/Canvasverwechslung:** Acht unterschiedliche Pins derselben Canvas müssen die finalen Frame-HTML-/Größenstände enthalten; keine auf vier limitierten Auftragsanhänge als Ersatz verwenden.
5. **Scheinbarer Font-/Memory-/Generierungsnachweis:** Echte Textknoten, beobachtetes Lesen einer passenden Memory-Referenz und tatsächlichen PNG-Download prüfen; JPEG-Schrift oder ein gemockter Resident genügt nicht.

---

## Dateien und vorhandene Schnittstellen

- **Nur temporär erstellen:** `/tmp/opencode/task28-reference-canvas/` für acht Seitenbilder, Originaldownloads und den Prüfexport. Keine vollständigen Kataloge oder geheimen Zugänge ins Repo übernehmen.
- **Dokumentation aktualisieren:** `reports/proWIN Kataloge und Werbung 2026.md`; dort Canvas-/Frame-/Pin-IDs, Quellen, Bildprüfsummen und Nachweise ohne Zugangsdaten ergänzen.
- **Backlog aktualisieren:** TASK-28 ausschließlich per CLI; ACs nur anhand des tatsächlich nachgewiesenen Stands abhaken.
- **Produktdateien nur lesen:** `server/index.ts`, `server/actions.ts`, `src/lib/frameClipboard.ts`, `server/resident.ts`, `server/prowin/frameBrand.ts`, `src/lib/framePolicy.ts`, `server/screenshot.ts`.

### Task 1: Baue den bestätigten Referenzsatz auf

**Interfaces:** HTTP-Benutzer-Session; `POST /api/canvases {name,workspaceId?}`; `POST /api/canvases/:id/assets` mit rohen Bildbytes; `POST /api/canvases/:id/frames {name,html,width,height,x,y}`; `PUT /api/canvases/:id/guidelines/prowin-referenzquellen {title,markdown}`; `POST /api/canvases/:id/references {frameId}`; `GET /api/canvases/:id`.

**Produces:** Eine zugängliche Canvas-ID, acht finale Frame-/Pin-Paare und die Quellen-Guideline; diese IDs sind Eingaben für Task 2. MCP-Agent-Keys ersetzen die Benutzer-Session nicht; MCP besitzt kein Pin-Schreibtool.

- [x] **Step 1: Prüfe die Ausführungsvoraussetzungen.** Bestätige Ziel, angemeldete Identität und dokumentierte Uploadfreigabe aus den Global Constraints. Ohne sie bei der Vorbereitung bleiben; kein Testkonto in der Nutzerinstanz anlegen. **Nachweis:** Lokale eingebettete PGlite-Instanz; bestehendes Konto über regulären Login und `/api/me` bestätigt. Private Passwortübergabe erfolgreich, kein Ersatzkonto angelegt.
- [x] **Step 2: Bereite genau acht vollständige Seitenbilder vor.** SR S.1; SR S.14–15 als zusammenhängende Doppelseite; nw S.24–25 als Doppelseite; Weihnachtsshopping S.1, S.4 und S.14 jeweils separat; I-DROP S.1; YOURDAY S.6. Quellen aus dem Auswahlbericht beziehen. JPG/PNG mit höchstens 5 MiB pro Datei, korrektem Seitenverhältnis und lesbaren Bedingungen erzeugen. Seitenbild, Seite und Prüfsumme je Motiv dokumentieren; Abweichungen zum bestätigten Motiv stoppen die betreffende Aufnahme. S.4 bleibt als Ausschnitt einer Doppelseite gekennzeichnet, wird aber selbst nicht weiter beschnitten. **Nachweis 29.10.2026:** Acht Bilder unter `/tmp/opencode/task28-reference-canvas/images/`, alle geöffnet und visuell geprüft; Größen/Seiten/Prüfsummen in `manifest.json`, jeweils unter 5 MiB. Kein Upload.
- [x] **Step 3: Erstelle eine eigene Canvas `proWIN Referenzen`.** `workspaceId` nur bei bestätigtem Ziel setzen; `linkAccess` nicht aktivieren. Die automatisch gesetzte `prowin-brand`-Guideline behalten. Canvas-ID vor weiteren Schreibaufrufen protokollieren. **Nachweis:** Canvas `hDlVVo_PCg`, im persönlichen Bereich des bestätigten Kontos, Link-Sharing aus.
- [x] **Step 4: Lade die acht Bilder hoch und erstelle pro Bild einen Frame.** Vorhandenes Bildframe-Muster aus `src/lib/frameClipboard.ts:131–144` mit absoluter Asset-URL und `object-fit:contain` verwenden. Darstellung wie beim bestehenden Import auf höchstens 900 px längste Kante skalieren, Originalbildauflösung behalten. Frames fortlaufend `01` bis `08` nach Quelle/Seite benennen und mit 40 px Abstand nebeneinander platzieren. Jeden erfolgreichen Rückgabewert sofort festhalten; bei Teilfehlern IDs per GET abgleichen, nicht komplett neu importieren. **Nachweis:** Acht Frames; alle acht öffentlich gelieferten Asset-Bytes stimmen per SHA-256 mit den vorbereiteten JPEGs überein.
- [x] **Step 5: Ergänze `prowin-referenzquellen`, Titel `proWIN Referenzquellen`.** Ordne alle acht Frames ihren URLs, Seiten, Laufzeiten und Aufgaben zu. Regeln: Referenzbilder unverändert lassen; Layout, nicht ungeprüfte Preise/Claims übernehmen; globale Brand-Regeln haben Vorrang; bestehende Rechteannahmen nicht erweitern. Status assetspezifisch dokumentieren, fehlende Klärung nicht verschleiern. **Nachweis:** Quellen-Guideline vollständig gespeichert; normalisierte Form entspricht dem Entwurf, Historie hat nach Fortsetzung genau eine Version. `prowin-brand` entspricht unverändert dem vorhandenen `createBrandGuideline`-Helper einschließlich Vorranghinweis.
- [x] **Step 6: Pinne die acht finalen Frames einzeln.** Jeweils `POST .../references {frameId}`. Erst nach finaler Bild-/HTML-Prüfung pinnen, da Memory Snapshots speichert. Es gibt zwölf verfügbare Memory-Slots, nicht nur vier; keine acht `attachments` anlegen. **Nachweis:** Acht unterschiedliche Memory-Pins mit exakt passenden Frame-IDs, finalem HTML und Abmessungen.
- [x] **Step 7: Prüfe den echten Serverzustand erneut.** `GET /api/canvases/:id` muss acht Quellenframes, acht unterschiedliche Referenz-IDs mit passenden Frame-IDs, HTML und Abmessungen sowie beide Guidelines liefern. Absolute Bild-URLs tatsächlich laden und Darstellung ansehen. Eine zweite Anmeldung/Abfrage darf nichts duplizieren; Neustartpersistenz nicht durch ungefragten Nutzerinstanz-Neustart testen. **Nachweis:** Frische wiederholte GETs und Fortsetzung des Importers bestätigen acht Frames, acht Pins und eine Quellen-Guideline-Version ohne Duplikate. PNG-Vorschau von Frame `2TQCmRnYdA` mit 637×900 Pixeln heruntergeladen und visuell geprüft; dies ist kein KI-generierter Prüfexport.

### Task 2: Prüfe Generierung und Export gemeinsam

**Interfaces:** Canvas-/Frame-/Pin-IDs aus Task 1; `POST /api/canvases/:id/cards {title}` ohne `attachments`; vorhandener Resident liest Guidelines und `get_reference`; `GET /i/:frameId.png?scale=1&download` liefert tatsächliche Bildbytes.

**Produces:** Ein separater generierter Testframe, heruntergeladener Prüfexport und dokumentierte Nachweise/Grenzen. Die acht Quellenframes und Pins bleiben unverändert.

- [x] **Step 1: Führe den vorhandenen Regressionstest-Schnitt aus.** Keine neue Testsuite ohne Produktänderung. Chromium muss verfügbar sein; Skips sind keine erfüllte Font-/CSP-Prüfung. Fehlgeschlagene Suites und Warnungen unverändert dokumentieren. **Nachweis 29.10.2026:** Sieben Dateien / 30 Tests bestanden, keine Skips, 77,20 s. Bestehende Node-localStorage-Warnungen erhalten; Requesty-Antworten stammen im Test aus dem Fixture-Router, nicht von einem Live-Modell.

```bash
TMPDIR=/tmp/opencode bun run test \
  tests/memoryAcceptance.test.ts tests/duplicatePersistence.test.ts \
  tests/brandInjection.test.ts tests/prowinBrandWrites.test.ts \
  tests/prowinFontsBrowser.test.ts tests/frameCspBrowser.test.ts \
  tests/requestyResident.test.ts \
  --maxWorkers=1 --testTimeout=30000
```

- [x] **Step 2: Prüfe vor Live-Auftrag Provider, Vision-Unterstützung und Freigabe.** Requesty EU und eine bildfähige Layout-Policy müssen eingerichtet sein; Ausführungsmethode und Kosten-/Übermittlungsfreigabe müssen vorliegen. Kein eigenes Alternativmodell, kein aktiviertes Kontingent und kein erneuter bezahlter Versuch ohne Auftrag. Vor einer Aktivierung prüfen, dass ein Server-Neustart keine fremden wartenden Karten kostenpflichtig aufgreift; andernfalls nicht global aktivieren. **Nachweis:** Nutzerfreigabe bis 20, konservativ als insgesamt 20 ausgehende Requesty-Requests durch getesteten temporären Guard begrenzt; nur markierter M3-Auftrag zulässig. Keine fremde Karte beim Neustart aufgegriffen. Vorhandene EU-Layout-/Textpolicy, Prozesskontingent für genau einen neuen Auftrag auf 4 gesetzt; anschließend Key wieder leer und Kontingent 0, `.env` unverändert.
- [x] **Step 3: Sende genau einen Layoutauftrag im selben Canvas.** Verlange genau einen neuen editierbaren 1080×1080-Testframe für eine Produktvorführung, eine tatsächlich gelesene passende Memory-Referenz und Beachtung beider Guidelines. Termin, Ort und Kontakt ausdrücklich als Platzhalter; keine aktuellen Preis-/Gesundheitsbehauptungen, kein generiertes Logo und keine nachgebaute Verpackung. Echter Text mit `Sofia Sans Condensed` 700 und `Sofia Sans` 500 sowie sichtbarem `body`-Hinweis exakt `Mit Unterstützung von KI erstellt`. Diese Typografiebemusterung ist ein Test, keine neue universelle Markenregel. **Nachweis:** Karte `_e5rEM-J` abgeschlossen, nur Frame `EAszpOKuIh` erstellt; 4 erfolgreiche Requesty-Layoutanfragen, keine Fehler-/Distillerrequests und keine Wiederholung.
- [x] **Step 4: Prüfe Kontext und Quellschutz.** Vorhandenen Task-/Toolverlauf auf tatsächlich erfolgtes `get_reference` prüfen, nicht allein die Modellbehauptung übernehmen. Guidelines-/Brand-Priorität und Normalisierungsblock im Ergebnis nachvollziehen. Vorher-/Nachhervergleich der acht Quellenframes und Pins muss Gleichheit ergeben; neuer Frame wird nicht automatisch zur Referenz gepinnt. **Nachweis:** Tatsächliches `get_reference` vor Erstellung; übertragener Referenz-PNG-Hash entspricht dem realen Quellenrender. Alle Requests mit globalem/lokalem Brand- und Quellenkontext; ein normalisierter Brandblock im generierten HTML. Unveränderliche Baseline bestätigt alle acht Quellenframes, acht Pins und beide Guidelines unverändert auch nach Neustart; Ergebnis nicht gepinnt.
- [x] **Step 5: Prüfe Browser-Font-/CSP-Verhalten am generierten HTML.** Im vorhandenen isolierten Chromium-/srcdoc-Prüfmuster echtes Testframe-HTML rendern, opaque Origin, tatsächliche lokale Fontabrufe und erfolgreiche Fontladung nachweisen. Keine externen Fonts oder unerlaubten Ressourcen; keine neue CSP-Ausnahme für Recherchehoster. Technische Headless-Prüfung und reale Nutzeroberfläche im Bericht unterscheiden. **Nachweis:** Chrome 156, Origin null, tatsächliche lokale Sofia-500-/Condensed-700-WOFF2-Antworten bytegleich mit gebündelten Dateien, CORS *, FontFaces loaded. Initiale CSP bleibt nach Morph aktiv und blockiert Fremd-Bild/Font/fetch; generierter Inhalt ohne CSP-Verletzung. Exakter KI-Hinweis als sichtbarer body-Text mit 28 px, schwarz auf weiß. Headless-/UI-Grenze dokumentiert.
- [x] **Step 6: Lade den PNG-Export herunter und betrachte ihn.** `GET /i/:frameId.png?scale=1&download` muss HTTP 200, PNG-Bytes und 1080×1080 Pixel liefern. Lesbarkeit von Headline, Platzhaltern und KI-Hinweis prüfen; reine Export-URL oder im JPEG bereits enthaltene Schrift genügen nicht. Ergebnis und fehlende Nachweise protokollieren. **Nachweis:** 1080×1080-PNG mit 87.380 Bytes, Attachment-Header und SHA-256 `7cd1137bcf38b53931dfe812789f6d1ff549fece45d37faa02dfef9497f9ef86`; bytegleich mit Modell-Prüfscreenshot und unabhängigem Runtime-Screenshot. Export geöffnet, alle geforderten Texte lesbar; keine weiteren Produkt-/Logoelemente.
- [x] **Step 7: Aktualisiere Bericht und TASK-28.** AC1 erst mit acht bestätigten echten Pins; AC2 erst mit dokumentierter gemeinsamer Live-Generierungs-/Exportprüfung; AC3 erst nach belegter Material-/Logo-Rechteklärung. Fehlende Freigabe als offen belassen, nicht durch technische Tests ersetzen. Verifiziere Markdownformatierung und `git diff --check`; keine Produktcode-Tests als neue Featureimplementierung ausgeben. Abschließende Nutzerabnahme bleibt ein eigener Schritt. **Nachweis 29.10.2026:** Bericht mit echtem Request-/Memory-/Font-/CSP-/PNG-Nachweis ergänzt, AC2 per CLI abgehakt; TASK-28 bis zur Nutzerabnahme In Progress belassen. Prettier-Check und Backlog-Diff-Check bestanden. Doc-Lint bestanden mit bestehender Stale-docs-Warnung zu `tests/composerReferences.test.ts`. **Abnahme 30.10.2026:** Nutzer bestätigt Done mit Feinschliff-Vorbehalt; Status entsprechend per CLI schließen, ohne professionelle Werbemittelqualität oder getestete KI-Bildgenerierung zu behaupten.

## Self-Review und Ausführung

- AC1 ist Task 1 zugeordnet; AC2 Task 2; AC3 bleibt ein explizites Material-Gate statt einer erfundenen Recherchefreigabe.
- Die fünf Review-Fälle werden durch Task 1 Steps 1–7 und Task 2 Steps 2–6 geprüft. Es gibt keine neue Produktlogik, die einen zusätzlichen Unit-Test benötigt.
- **Empfehlung:** Native, sequenzielle Ausführung mit einem abschließenden unabhängigen Nachweischeck. Die Schritte teilen denselben authentifizierten Canvas-Zustand; parallele Schreibagenten bringen hier keinen Vorteil.
- **Ausführungsstand 30.10.2026:** Referenz-Aufbau und gemeinsame echte M3-Generierungs-/Exportprüfung technisch nachgewiesen. [Canvas öffnen](http://localhost:4300/c/hDlVVo_PCg): acht unveränderte Originalbildframes/Memory-Pins plus ein separater generierter Testframe. 4/20 ausgehende Requesty-Anfragen mit freigegebenen Referenzpixeln; Fonts, aktive CSP, editierbare Texte und tatsächliche PNG-Parität geprüft. Sieben Regressionstestdateien / 30 Tests bestanden, keine Skips; bestehende localStorage-Warnungen dokumentiert. Keine Produktcodeänderung, neuer Account oder Commit. Server-Key nach dem Test wieder leer und `RESIDENT_TASK_LIMIT=0`, `.env` unverändert. Dokumentationsprüfung bestanden; unabhängiger Abschlusscheck ohne Befund. Private Testsession regulär widerrufen (alte Session liefert 401) und Sessiondatei entfernt. TASK-28 nach ausdrücklicher Nutzerabnahme mit Feinschliff-Vorbehalt per CLI auf Done gesetzt. Komposition/Typografie bleiben auszuarbeiten; KI-Bildgenerierung wurde hier nicht geprüft. Kein weiterer Live-Auftrag oder Anwendungstest für die reine Statusänderung.
