# Datenfluss zur KI (Q10)

TASK-21 · entschieden am 25.10.2026 · Verantwortlicher: Matthias Meister

## Entscheidung

**Option A: Platzhalter.** Kontaktdaten verlassen den Server nicht im Klartext
Richtung Requesty. `server/prowin/redact.ts` ersetzt vor jedem Request
E-Mail-Adressen, Telefonnummern und IBANs. Zwei Betriebsarten:

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
