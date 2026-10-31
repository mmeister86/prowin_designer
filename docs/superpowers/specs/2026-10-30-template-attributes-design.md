# Template-Attribute und Creator-Bearbeitung — Design (TASK-29)

**Intent:** Creator markieren Elemente einer Vorlage mit stabilen, semantischen
`data-od-*`-Feldern, damit Task 30 dieselben Felder serverseitig schützen und
Beraterinnen sie später sicher personalisieren können (Umsetzung §9.1/§9.3,
R1.3–R1.4).

**Council:** 30.10.2026, Claude Opus / GPT-6.1 Sol / Muse Wonder (alle high):
`agree-with-changes` — Zuschnitt bestätigt, aber AC3 braucht eine schmale
Server-Metadatenprüfung schon in 29.

## Goals

- Attributmodell dokumentiert und vom Creator im ElementPanel bearbeitbar:
  `data-od-id`, `data-od-role`, `data-od-label`, `data-od-locked`,
  `data-od-max-length`, `data-od-allowed-colors`.
- `data-od-id` pro Frame eindeutig, bei Bearbeitung stabil, beim Duplizieren
  innerhalb eines Frames konfliktfrei neu vergeben.
- Nur Rollen mit `manageLocks` ändern Sperren und Constraints — im Client
  gegated und auf dem regulären Frame-Write serverseitig geprüft.

## Non-Goals (bleiben eigene Tasks)

- **TASK-30:** Inhalts-Guard auf allen Schreibpfaden (Locked-`outerHTML`,
  Längen-/Farb-Nutzung, Löschschutz, `appendFrameHtml`, Restore, `createFrame`).
- **TASK-31:** Beraterinnen-Sichtbarkeit (Schloss-Badges, Auswahl-/Farb-/
  Text-Begrenzung, Agent-/MCP-Guide).
- Font-/Size-Locks (`data-od-lock="font,size"` ist laut R1.4 offen).
- Selector-Identität durch `data-od-id` ersetzen; `data-doop-locked`
  zusammenlegen; Bestands-Frames migrieren.

## Approaches

- **A (gewählt):** Shared Attributmodell + Creator-UI + schmale
  Server-Metadatenprüfung nur in `actions.updateFrame`.
  AC3 ehrlich erfüllt, ohne Task 30 vorwegzunehmen.
- **B (verworfen):** Nur Client-Gating. Per HTML-Tab/REST/MCP umgehbar —
  AC3 wäre falsch abgehakt.
- **C (verworfen):** Voller `templateGuard` aus §9.2 schon in 29.
  Scope-Creep in Task 30, inklusive neuer Parser-Abhängigkeit.

## Entscheidungen (Controller-Rulings)

- **Markieren:** ID wird erst gemintet, wenn ein Creator ein Element als
  Template-Feld markiert — nicht bei Auswahl, nicht für alle Elemente.
  Entmarkieren entfernt alle sechs Attribute.
- **ID-Bearbeitung:** `data-od-id` ist nur explizit umbenennbar (AC1),
  mit Format `^[A-Za-z][A-Za-z0-9_-]{0,63}$` und Eindeutigkeitsprüfung.
  Implizit ändert sich eine ID nie.
- **Kopien:** Frame-/Page-/Canvas-Kopien behalten IDs (Eindeutigkeit gilt
  pro Frame). Element-Duplikat und konfliktbehafteter Drawing-Transfer in
  einen anderen Frame vergeben im geklonten Teilbaum neu.
- **Tokenformat:** `data-od-allowed-colors` speichert Token-Namen ohne
  `--`, komma-getrennt, z. B. `prowin-ci-blau,prowin-ci-orange`. Einzige
  Quelle ist `BRAND_TOKENS`; Hexwerte sind ungültig. Das Doku-Beispiel
  `primary,cream` wird korrigiert.
- **Validierung:** Rolle = geschlossenes Enum der acht Werte aus §9.1.
  `max-length` = Ganzzahl ≥ 1, leer = ungesetzt. `label` = getrimmter
  Freitext, max. 120 Zeichen. `locked` = Präsenz zählt, Wert egal.
  Ungültige Werte werden sichtbar abgelehnt, nie still entfernt.
- **Serverprüfung (schmal):** In `updateFrame` nach
  `repairEscapedHtml`/`normalizeFrameHtml`, semantisch auf geparsten
  Attributen (nie Rohtext-Vergleich): doppelte IDs und ungültige Werte
  → 400 für alle Rollen; geänderte/hinzugefügte/entfernte Template-
  Metadaten ohne `manageLocks` → `CreatorPermissionError` (403).
  Inhaltsänderungen an Feldern bleiben bis Task 30 ungeprüft.
- **Live-Sync:** Template-Änderungen werden wie `data-doop-locked` per
  Runtime-Message ins Live-Dokument gespiegelt, damit ein späterer
  Text-Edit-Save sie nicht verliert. Fehlgeschlagene Saves rollen den
  Client-Zustand zurück und zeigen einen Hinweis.

## Parts

1. `shared/prowin/templateAttributes.ts` — Vertrag, Extraktion aus
   Frame-HTML, Validierung, kanonischer Vergleich, Minting.
   `BRAND_TOKENS` wandert nach `shared/prowin/brandTokens.ts`, der Server
   re-exportiert.
2. Client — Feld-Lesen/Schreiben in `layers.ts`, Save mit Rollback in
   `layerEdits.ts`, Creator-Sektion im ElementPanel, Live-Mirror
   `doop:template` in `frameRuntime.ts`, Remint bei Element-Duplikat und
   Drawing-Transfer-Konflikt.
3. Server — `server/prowin/templateMeta.ts` plus ein Hook in
   `actions.updateFrame`; Doku der Restlücken bis Task 30.
