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
  auf dem regulären Frame-Write serverseitig geprüft (`actions.updateFrame`).

## Offen

- Font-/Size-Locks (`data-od-lock="font,size"` laut R1.4) sind offen.
- Inhalts-Guard auf allen Schreibpfaden (Locked-`outerHTML`, Längen-/Farb-Nutzung,
  Löschschutz, `appendFrameHtml`, Restore, `createFrame`) → TASK-30.
- Beraterinnen-Sichtbarkeit (Schloss-Badges, Auswahl-/Farb-/Text-Begrenzung,
  Agent-/MCP-Guide) → TASK-31.
