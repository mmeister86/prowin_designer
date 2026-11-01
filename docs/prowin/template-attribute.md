# Template-Attribute (`data-od-*`)

Creator markieren Elemente einer Vorlage mit stabilen, semantischen `data-od-*`-Feldern,
damit Beraterinnen sie später sicher personalisieren können.
Vertrag: `shared/prowin/templateAttributes.ts` (Extraktion, Validierung, Vergleich, Minting).

## Attribute

| Attribut                 | Werte                                                                                | Bedeutung                                                   |
| ------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `data-od-id`             | `^[A-Za-z][A-Za-z0-9_-]{0,63}$`, pro Frame eindeutig                                 | Stabile Feld-Identität, Pflicht für jedes markierte Element |
| `data-od-role`           | `headline` \| `body` \| `image` \| `cta` \| `logo` \| `contact` \| `date` \| `decor` | Semantik, für UI-Labels und KI-Patches                      |
| `data-od-label`          | Freitext, getrimmt, max. 120 Zeichen                                                 | Anzeigename im Formular/Panel                               |
| `data-od-locked`         | Präsenz zählt, Wert egal (`<h1 data-od-locked>` ≡ `data-od-locked="true"`)           | Gesperrt — nur Creator mit `manageLocks` dürfen ändern      |
| `data-od-max-length`     | Ganze Zahl ≥ 1, leer = ungesetzt                                                     | Max. Zeichen für Text                                       |
| `data-od-allowed-colors` | Token-Namen ohne `--`, komma-getrennt, z. B. `prowin-ci-blau,prowin-ci-orange`       | Erlaubte Farben (nur Tokens aus `BRAND_TOKENS`)             |

## Markieren / Entmarkieren

- Die `data-od-id` wird erst gemintet (`feld-<8 Zeichen>`), wenn ein Creator ein Element
  als Template-Feld markiert — nicht bei Auswahl, nicht für alle Elemente.
- Entmarkieren entfernt alle sechs Attribute.
- Ungültige Werte werden sichtbar abgelehnt, nie still entfernt.

## ID-Rename

- `data-od-id` ist nur explizit umbenennbar, mit Formatprüfung
  (`isValidTemplateId`) und Eindeutigkeitsprüfung pro Frame.
- Implizit ändert sich eine ID nie.

## Duplikat-Regeln

- Eindeutigkeit gilt pro Frame.
- Frame-/Page-/Canvas-Kopien behalten IDs.
- Element-Duplikat und konfliktbehafteter Drawing-Transfer in einen anderen Frame
  vergeben im geklonten Teilbaum neue IDs (`mintTemplateId`).

## Tokenformat

- Einzige Quelle ist `BRAND_TOKENS` (`shared/prowin/brandTokens.ts`).
- Gespeichert werden Namen ohne `--`; Hexwerte sind ungültig.

## Berechtigung

- Nur Rollen mit `manageLocks` ändern Sperren und Constraints (`data-od-locked`,
  `data-od-max-length`, `data-od-allowed-colors`) — im Client gegated,
  auf allen Frame-Schreibpfaden serverseitig geprüft.

## Durchsetzung

- TASK-30 ist umgesetzt (`server/prowin/templateGuard.ts`, Parser: `parse5`):
  Gespeichertes HTML ist die vertraute Constraint-Basis; `manageLocks` kommt aus
  dem vertrauten Server-Permission-Kontext, nie aus Actor-Namen oder Request-Flags.
- Ungültige/doppelte Template-Metadaten → 400 für alle; unbefugte Änderungen → 403.
- Update, Append-Commit, Restore, Create/Import und Frame-Delete sind geprüft;
  Größenänderung und Löschen eines Template-Frames sind für Nicht-Creator 403.
- Append-Streams puffern alle Rollen bis `done=true`; erst der finale Commit wird
  geprüft und gespeichert (409 bei konkurrierender Änderung, Berechtigung erneut geprüft).
- Kopien mit `sourceFrameId` (Zwischenablage, Duplizieren, MCP-/Resident-`create_frame`
  mit `source_frame_id`) validieren gegen die gespeicherte Quelle; frische
  Template-Erstellung ohne Quelle ist für Nicht-Creator 403, fehlende/unzugängliche
  Quellen scheitern geschlossen (404/403) — nie mit still entferntem Schutz.
- `max-length` zählt Unicode-Codepoints im dekodierten Text; Farben nur als
  `var(--token)` aus `allowed-colors`; sichere Typografie in offenen Feldern bleibt
  erlaubt. Manueller Browser-Test steht aus; eine happy-dom
  Serialisierungs-Regression liegt in `tests/templateTransports.test.ts`.
- Vorhandene CSS-Kurzformen wie `background`, `border` oder `outline` und andere
  nicht sicher auswertbare Deklarationen bleiben unter `allowed-colors` erhalten;
  nur reine Typografie-Deklarationen dürfen entfernt werden. Neue Kurzformen
  bleiben für Nicht-Creator verboten.
- `text-decoration` erlaubt unter `allowed-colors` nur Linien-/Stil-Schlüsselwörter
  wie `underline` oder `line-through dotted`, keine eingeschleusten Farbangaben.
- Unter `allowed-colors` können Nicht-Creator farb-/class-/id-tragende Wrapper
  (inkl. eigenem `style`-Farbwert) nicht entfernen, ersetzen oder auspacken, weil
  die Kaskade ohne CSS-Engine nicht beweisbar ist — Text leeren oder Creator
  verwenden; reine Text- und Typografie-Änderungen bleiben erlaubt.
- Bestehende `on*`-Werte sind eingefroren (unveränderte Legacy-Handler bleiben
  speicherbar, Entfernen bleibt erlaubt); Wertänderungen sind 403.
- Nicht editierbare Legacy-Teilbäume in offenen Feldern, insbesondere `script`
  und `style`, bleiben unverändert; auch Ersetzen und Entfernen ist 403. Als Feld
  markierte `script`-/`style`-Elemente sind ebenfalls keine offenen Code-Editoren.
- Geänderte Inline-Styles mit doppelten Eigenschaftsnamen werden abgelehnt
  (auch bei anderer Großschreibung), damit keine `!important`-Deklaration bei der
  Prüfung verschwindet. Unveränderte Legacy-Styles bleiben speicherbar.
- SVG-Attribute werden mit Namespace und Präfix verglichen: `href` und
  `xlink:href` sind unterschiedliche Attribute, auch auf gesperrten Elementen.
- Beim Speichern eines Bestandsfragments darf der Editor einmalig den üblichen
  `<!doctype html>` ergänzen. Vorhandene Doctypes samt Public-/System-ID sowie
  Dokumentattribute bleiben geschützt.

## Agent / MCP

- TASK-31 ist umgesetzt (`TEMPLATE_GUIDE` in `server/guide.ts`): eine gemeinsame
  Anleitung für Rollen und alle sechs Attribute, stabile IDs, eingefrorene
  Teilbäume und Struktur, Tokenfarben, Textlimits und den Umgang mit
  Ablehnungen. MCP-`get_guide` (`DOOP_GUIDE`) und Resident-Systemprompt
  (`server/resident.ts`) binden denselben Text wörtlich ein — kein Abdriften.
- Agenten kennen `manageLocks` nicht direkt: Ohne ausdrücklichen Auftrag zur
  Vorlagenerstellung gelten die Nicht-Creator-Regeln. Bei explizitem
  Authoring-Auftrag dürfen sie Änderungen versuchen; nur die serverseitig
  geprüfte Identität autorisiert sie. Ein 403 beendet den Versuch ohne
  Umgehung — keine Constraint-Entfernung, keine `agent_name`-Eskalation.
- Tests: `tests/templateGuide.test.ts` weist nach, dass beide Oberflächen
  dieselben Regeln erhalten und reale Agent-/MCP-Edits weiterhin den
  serverseitigen Guard durchlaufen (erlaubte Edits ok, gesperrte/Längen-Edits
  403 ohne Persistenzänderung, Creator-Authoring nur unter echter Berechtigung).

## Offen

- Font-/Size-Locks (`data-od-lock="font,size"` laut R1.4) sind offen.
- Beraterinnen-Sichtbarkeit (Schloss-Badges, Auswahl-/Farb-/Text-Begrenzung)
  → TASK-31, Tasks 1–2.
