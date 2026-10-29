# Datenfluss zur KI (Q10)

TASK-21 · entschieden am 25.10.2026 · Verantwortlicher: Matthias Meister

## Entscheidung

**Option A: Platzhalter für erkannte Textdaten.** Erkannte E-Mail-Adressen,
Telefonnummern und IBANs in Text werden vor dem Versand Richtung Requesty ersetzt;
nur diese drei Textformen deckt das Verfahren ab (Namen und Postadressen nicht, siehe unten). `server/prowin/redact.ts`
ersetzt sie vor jedem Request. Zwei Betriebsarten:

- **Einweg** (`redactPii`): Freitexte, Kommentare, Guidelines, Distiller. Treffer
  werden durch `[E-Mail entfernt]`, `[Telefon entfernt]` oder
  `[IBAN entfernt]` ersetzt; einen Rückweg gibt es nicht.
- **Reversibel** (`createRedactionSession`): Frame-HTML an das Modell. Pro
  Agent-Lauf vergibt die Session stabile Tokens `[[PII-1]]`, `[[PII-2]]`, … je
  unterschiedlichem Original. Schreib-Tools setzen die Originale zurück.
  Unbekannte `[[PII-n]]`-Tokens bleiben unangetastet, damit Nutzer-HTML mit
  eigenen Tokens nicht umgeschrieben wird.

Der UI-Hinweis bleibt trotzdem nötig, weil Designs, Screenshots und Freitexte
weiterhin an ein Modell gehen (Art. 13 DSGVO). Er erscheint einmalig im
Onboarding (`src/components/Onboarding.tsx`, LocalStorage `doop:onboarding`).
Bei einem Referenzentwurf erscheint zusätzlich im Composer ein wiederholter
Hinweis, auch wenn das Onboarding bereits geschlossen wurde.

## Datenfluss je Kategorie

| Kategorie                              | Weg                                                                                                      | Redaktion                                                                                               | Gespeichert        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------ |
| Frame-HTML (Agent liest)               | `get_frame_html`, `inspect_frame`, `get_reference`                                                       | redigierte Kopie, Tokens `[[PII-n]]`; `inspect_frame` wird zusätzlich als JSON nachredigiert            | Original im Frame  |
| Screenshot zur Selbstprüfung           | `screenshot_frame`, `frameImageBlocks` (Vision, Requesty EU)                                             | Bild wird aus der redigierten HTML-Kopie gerendert                                                      | Original im Frame  |
| Freitext und Kickoff                   | Feedback, Karten-Prompts, Kommentare samt Anker-Snippet, Frame-Namen, Guideline-Markdown, Referenz-Titel | Einweg-Platzhalter (`redactPii` bzw. Session-`redact` für HTML-nahe Teile)                              | Original im Store  |
| Distiller                              | Decision-Texte, Guideline-Titel und -Zusammenfassungen, frühere Vorschläge                               | Einweg-Platzhalter; die Log-Zeile nennt keinen Rohtext mehr                                             | Original im Store  |
| Bildprompt (Magnific, noch nicht live) | Adapter in `imageGen.ts` ist noch nicht gebaut (TASK-39/40)                                              | geplant: nur auf ausdrücklichen Klick, Prompt ohne Kontaktdaten (Filter im Adapter, § 11 der Umsetzung) | —                  |
| Bildinhalte (hochgeladene Fotos)       | als `<img>` im Frame, Teil des Screenshots                                                               | **keine** Redaktion: Pixel lassen sich nicht per Regex prüfen                                           | Original als Asset |

**Gespeicherte Frames behalten immer die Originale.** Redigiert wird nur die
Kopie Richtung Modell. Zurücksetzen passiert in `create_frame`,
`set_frame_html`, `edit_frame_html` (auf `find` **und** `replace`) und
`commit_frame_rewrite` (beim Commit des Drafts). Schreibt der Agent Tokens, die
er nicht von uns hat, bleiben sie unverändert.

## Auftragsbezogene visuelle Referenzen

Bilder auf der Arbeitsfläche werden als normale HTML-Frames mit einem Bildasset
importiert. Erst „Auswahl als Referenz“ oder „Als Referenz verwenden“ ordnet
bestehende Frames dem nächsten Auftrag zu. Bis zu vier Referenzen sind möglich,
bestehende Frames und neue Dateianhänge gemeinsam. Der Entwurf bleibt pro Canvas
nur im Client-Speicher erhalten, auch beim Panel- oder Tabwechsel; er wird weder
in LocalStorage noch in Datenbank oder WebSocket gespeichert.

Nach erfolgreichem Queueing wird der Entwurf geleert. Die Karte behält die
Referenz-IDs in `attachments`; nachfolgende Aufträge erben sie nicht. Die Quellen
bleiben auf der Arbeitsfläche. Entfernen einer Zuordnung löscht keinen Frame.
Referenzen sind Live-Verweise, keine eingefrorenen Kopien und keine dauerhaften
Canvas-Referenzen oder Memory-Pins.

Quelle und Bearbeitungsziel bleiben getrennt: Ein Referenzframe wird nicht
zugleich zum Bearbeitungsziel desselben Auftrags. Ein anderes ausgewähltes Ziel
kann weiterhin bearbeitet werden; ohne anderes Ziel soll ein separates Design
entstehen. Die Agent-Anweisung verlangt unveränderte Quellen, schafft aber keine
neue technische Schreibsperre.

Der Server-Agent liest Referenzframes über die vorhandenen Tools und sendet ihre
Screenshots über den bestehenden Vision-Pfad an Requesty (EU). **Bildpixel bleiben
unverändert.** Gedruckte Telefonnummern, E-Mail-Adressen oder andere
personenbezogene Angaben können deshalb im Screenshot beim Modell ankommen.
HTML-Redaktion und EU-Region entfernen diese Angaben nicht. Es gibt keine OCR
oder automatische Unkenntlichmachung. Nur Bilder verwenden, die für diesen Zweck
freigegeben sind; die Modellleistung ist keine Zusage pixelgenauer Rekonstruktion.

Der Composer zeigt bei vorhandenen Referenzen:

> Referenzbilder werden vom KI-Agenten visuell ausgewertet; beim Server-Agenten über Requesty (EU). Kontaktdaten im Bild werden nicht automatisch entfernt. Lade nur Bilder hoch, die Du dafür verwenden darfst.

## Ausnahme: MCP und Local Agent

Die Redaktion sitzt ausschließlich an den Server-Requesty-Pfaden
(`server/resident.ts`, `server/distill.ts`). **MCP und der Local Agent bleiben
unverändert:** Dort arbeitet der eigene Agent der Nutzerin mit ihrem eigenen
Konto und ihrem eigenen Vertrag — das ist kein Requesty-Pfad, den dieser Fork
verantwortet. Entscheidung vom 25.10.2026; eine Redaktion dort würde das
Verhalten der externen Clients ändern, ohne den Datenfluss dieses Servers zu
beeinflussen.

## Grenzen der Regex

| Erkannt                                                                                     | Nicht erkannt                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| E-Mail (`name@example.de`)                                                                  | Namen (auch in Ansprechpartner-Zeilen)                                    |
| IBAN, DE und international, mit oder ohne Leerzeichen (15–34 Zeichen)                       | Freie Postanschriften                                                     |
| Telefon mit `+`, `00` oder führender `0`, Trennzeichen Leerzeichen `/` `-`, mind. 6 Ziffern | Kontaktdaten in Bildern, Scans oder als Grafik                            |
| —                                                                                           | Kodierte oder verschleierte Angaben (z. B. in Attributen zusammengesetzt) |

Schutz vor False Positives: eine Ziffernfolge gilt nur als Telefon, wenn sie mit
`+`, `00` oder `0` beginnt und mindestens 6 Ziffern hat; eine IBAN nur bei
15–34 Zeichen. Designtexte wie `Artikel 123456`, `120 x 80 cm` oder
`ab 29,99 €` bleiben unverändert.

**Upgrade-Pfad:** Sobald Frames Kontaktblöcke mit `data-od-role="contact"`
markieren (TASK-29), kann die Redaktion diese Blöcke ganz ersetzen und damit
auch Namen und Adressen abdecken. Bis dahin ist die Lücke im UI-Hinweis benannt.

## Nachweis

- `tests/prowinRedact.test.ts`: Muster, Nicht-Treffer, Token-Stabilität, Restore,
  fremde Tokens.
- `tests/prowinRedactWiring.test.ts`: jeder Ausgang zum Modell (Frame-HTML,
  Vision-Screenshot, Kickoff, Distiller), Restore bei den Schreib-Tools,
  Originale im Store.

Nicht getestet und nicht behauptet: Redaktion in MCP-/Local-Agent-Ausgaben,
Redaktion von Bildinhalten, Erkennung von Namen und Adressen.
