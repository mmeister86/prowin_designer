# M4 Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Belege TASK-37 mit echten Workspace-Rollen vom Creator-Template über Personalisierung und Neustart bis zum Bildexport, ohne neue Produktfunktionen.

**Architecture:** Ein Integrationstest verwendet den vorhandenen echten HTTP-/PGlite-Server und MCP per HTTP. Eine Abnahmematrix verbindet den neuen Kettentest mit bestehenden Einzeltests und trennt automatisierte Evidenz von offener Plattformabnahme.

**Tech Stack:** TypeScript, Vitest, vorhandenes `tests/harness.ts`, PGlite, Chromium, sharp; keine neuen Dependencies.

**Spec:** `docs/superpowers/specs/2026-11-07-m4-acceptance-design.md`

## Global Constraints

- Vorlagenschutz bedeutet `data-od-*`; `Frame.locked` bleibt eine Bedienungssperre. Bestehende Admin-Ausnahmen werden beschrieben, nicht geändert.
- Echte Konten, Workspace-Rollen und serverseitige Identitäten über vorhandenes `tests/harness.ts`; keine Berechtigungs-, Datenbank- oder Renderer-Mocks.
- Keine neuen Links, Viewer-Rollen, Share-Funktionen, Dependencies, Migrationen oder Refactorings. Vorhandene Export-/Overlay-/Share-Tests wiederverwenden.
- Browser-Skips sind kein Exportnachweis.
- Keine Pushes, PRs oder Merges ohne Auftrag. Fremde Änderungen an TASK-29/31/32/79 bleiben unangetastet.
- TASK-37 bleibt bis zur ausdrücklichen Nutzerbestätigung nach manueller Abnahme offen. Automatisierte Ergebnisse ersetzen keine native Share-Abnahme.

## Review Focus

1. Constraints müssen am offenen Feld liegen; erlaubte Text- und Farbänderung zuerst erfolgreich nachweisen (Task 1).
2. Workspace-Member darf trotz Creator-Selbstregistrierung und `agent_name: 'Creator'` nicht privilegiert werden (Task 1).
3. Abgelehnte Writes dürfen Snapshot oder Versionshistorie nicht verändern; vor Vergleich ausstehende legitime Versionen abwarten (Task 1).
4. Neustart darf nicht gegen den alten Prozess oder eine frische Datenbank testen; `await stop({ keepData: true })`, gleiche `dataDir`, erneute Anmeldung und erneute Ablehnung (Task 1).
5. Echter PNG-/JPG-Export und manuelles Share Sheet sind unterschiedliche Belege; fehlendes Chromium und nicht ausgeführte Plattformtests ausdrücklich offen führen (Tasks 1 und 2).

---

### Task 1: Ergänze den echten M4-Kettentest

**Files:**

- Create/Test: `tests/m4Acceptance.test.ts`
- Read: `tests/harness.ts`, `tests/prowinCapabilities.test.ts`, `tests/templateWrites.test.ts`, `tests/duplicatePersistence.test.ts`, `tests/presetExportHttp.test.ts`, `tests/presetExportReal.test.ts`

**Interfaces:**

- Consumes: `startServer(env?: Record<string, string>, reuseDir?: string): Promise<Server>`, `Client`, `Server.stop({ keepData: true })` aus `tests/harness.ts`.
- Consumes: bestehende REST-Routen, `/mcp` mit `Authorization: Bearer <member-agent-key>`, `/i/<frameId>.png|jpg?download`; `sharp(bytes).metadata()`.
- Produces: ausführbarer, isolierter Integrationstest; keine neue öffentliche Schnittstelle.

- [ ] **Step 1: Prüfe isolierte Ausgangslage.** Im isolierten Worktree vorhandene Testmuster und relevante Routen lesen. `CHROME_PATH`/Chromium-Verfügbarkeit prüfen; keine Secrets lesen und keine externen Provider ansprechen. SMTP/Registrierung für den lokalen Testserver explizit neutralisieren, soweit die vorhandene Konfiguration dies erfordert. Baseline: `bun run typecheck`.
- [ ] **Step 2: Schreibe den Kernfall.** Echten Creator und echte Beraterin anlegen, Creator registrieren, Workspace erstellen, Beraterin als `member` aufnehmen; jede Setup-Antwort auf Erfolg prüfen. Vollständiges HTML mit gesperrtem Logo und offener Überschrift (`data-od-max-length="24"`, `data-od-allowed-colors="prowin-ci-blau,prowin-ci-orange"`, anfänglich `color:var(--prowin-ci-blau)`) erstellen. Preset `ig-story`, Safe-Zone-Override `{ top: 210, right: 20, bottom: 260, left: 20 }`. Beraterin ändert `Hallo` in `Hallo Welt` und Blau in Orange; jeweils HTTP 200 und gespeicherten Wert prüfen.
- [ ] **Step 3: Prüfe REST und authentifiziertes MCP.** Vom zuletzt gespeicherten HTML aus jeweils Logo-Inhalt ändern, `data-od-locked` entfernen, Maximallänge entfernen, 25 Zeichen setzen und Farbe `red` setzen. Jede Mutation tatsächlich vom Ausgangswert unterscheiden. REST erwartet 403, MCP `result.isError === true`, jeweils vollständiger Frame und Versionsliste unverändert. Mindestens einen erlaubten MCP-Textedit ausführen, damit ein kaputter Agent-Key keine falschen positiven Ablehnungsbelege liefert. `agent_name: 'Creator'` darf keinen Unterschied machen. Echte MCP-Toolnamen/-Argumente aus vorhandenen Tests/Handlern übernehmen.
- [ ] **Step 4: Prüfe Format-/Rollen-Grenzen.** Member-Änderungen an Breite, Preset und Safe-Zone-Override sowie Delete ergeben 403 ohne Datenänderung. Beraterin registriert sich anschließend selbst als Creator: Workspace-Rolle bleibt member, Sperren-/Constraint-Änderung bleibt 403. Bestehende Kopier-/Restore-/Resident-Tests nicht vollständig duplizieren; diese werden in Task 2 verknüpft.
- [ ] **Step 5: Prüfe dauerhafte Zusammensetzung.** `await server.stop({ keepData: true })`, Neustart mit derselben `dataDir`, Beraterin neu anmelden. Personalisierung, Template-Attribute, 1080 × 1920, `ig-story` und Override erneut aus REST lesen. Gesperrte Änderung nochmals mit 403 abweisen und Snapshot unverändert prüfen. `finally` räumt den jeweils laufenden Server auf.
- [ ] **Step 6: Prüfe echte Downloads.** Nach Neustart PNG und JPG über den Beraterinnen-Client abrufen: HTTP 200, `image/png` beziehungsweise `image/jpeg`, Attachment und mit sharp gelesene Pixelmaße exakt 1080 × 1920. Die Kernrechte-/Persistenzprüfung läuft auch ohne Chromium; nur Renderer-abhängige Assertions dürfen ausdrücklich als solche ausfallen/übersprungen werden. Einen Skip niemals als bestandenen Export protokollieren. Kein neuer Share-Mocktest.
- [ ] **Step 7: Führe den neuen Test aus.** `bun run test tests/m4Acceptance.test.ts --maxWorkers=1`. Bei einem reinen Nachweistest ist ein sofortiger grüner Lauf zulässig: keinen Produktfehler erfinden, um RED zu erzeugen. Bei einer echten fehlgeschlagenen Produktannahme Befund reproduzieren und nur innerhalb der freigegebenen Grenzen beheben. Danach `bun run typecheck` und Format-/Lintprüfung des neuen Tests. Echte Ausgaben, Skips, Commit und Bedenken im Implementer-Report festhalten.
- [ ] **Step 8: Committe ausschließlich den Kettentest.** Commit-Titel `test: Add M4 acceptance chain`. Danach unabhängige Task-Review (Spec und Qualität).

### Task 2: Dokumentiere und verifiziere die M4-Abnahme

**Files:**

- Create: `docs/prowin/m4-abnahme.md`
- Modify: `.context/TECHSTACK.md` (ein kurzer Verweis unter Testing Stack)
- Modify: `docs/prowin/template-attribute.md` (nur veralteten TASK-31-Offen-Verweis berichtigen)
- Track: TASK-37 ausschließlich per `backlog` CLI

**Interfaces:**

- Consumes: Task-1-Test und dessen tatsächliche Lauf-/Review-Evidenz; vorhandene Rollen-, Template-, Preset-, Safe-Zone- und Share-Tests.
- Produces: AC-zu-Beleg-Matrix samt aktuellen Prüfresultaten und manuell auszufüllender Plattformcheckliste.

- [ ] **Step 1: Erstelle die Abnahmematrix.** AC1–AC3 wörtlich aus `backlog task 37 --plain` übernehmen und auf präzise Tests/Szenarien verweisen. Task 1 als gemeinsamen Rollen-/Persistenz-/Exportnachweis, bestehende Tests für Restore/Copy/Resident, alle fünf Exportformate, Overlay-Isolation und Share-Handling verknüpfen. Keine behaupteten Ergebnisse aus früheren Reports übernehmen.
- [ ] **Step 2: Dokumentiere Schutzgrenzen und offene manuelle Prüfungen.** `Frame.locked` vs. `data-od-*`, aktuelle Admin-Ausnahme, persönliche Creator-Kopien, öffentliche aktuelle Bild-URLs und TASK-36 (Datei/Galerie statt privatem Ansichtslink) knapp erklären. Browser/Desktop: erlaubtes Feld, Schlossauswahl/Layers/Tastatur, Farbe/Länge/Paste/IME, Reload, Safe-Zone-Overlay, PNG/JPG-Maße, tatsächliches Web Share/Download, Abbruch/Wiederholung/Offline/langsames Rendern. iOS: Ablehnung im HTML-Formular, PNG/JPG nach Dateien/Fotos, Abbruch. Alle nicht ausgeführten manuellen Schritte offen lassen; Gerät/Browser/Datum/Ergebnis müssen eintragbar sein.
- [ ] **Step 3: Begrenze Folgearbeit.** Prüfe per `backlog search`, ob öffentliche Live-Bild-URLs bereits als Datenschutzaufgabe erfasst sind. Falls nicht, eigenen `To Do`-Task per CLI anlegen (keine Umsetzung), aus der Matrix verlinken. TASK-77/78 nicht hier beheben. TASK-31-Offen-Verweis sachlich aktualisieren, ohne manuelle Abnahme zu behaupten; TECHSTACK auf die neue Matrix verweisen.
- [ ] **Step 4: Verifiziere frisch.** `bun run typecheck`; `bun run lint`; `bun run test --maxWorkers=4 --exclude tests/claudeExtension.test.ts`; anschließend `bun run test tests/claudeExtension.test.ts --maxWorkers=1`. Formatprüfung auf geänderte Dateien und `bun run doc-lint`. Alle Ergebnisse, Datum, geprüften Commit und Skips in die Matrix aufnehmen; echte Renderer-Suites müssen für deren Exportbeleg gelaufen sein. Fehlschläge sauber als Baseline/Regression/Umgebungsblocker einordnen, keine unbezogenen Fixes.
- [ ] **Step 5: Aktualisiere TASK-37 per CLI.** Plan, frische Evidenz und offene manuelle Abnahme notieren; nur vollständig nachgewiesene ACs abhaken. Status niemals selbst auf `Done` setzen. Fremde Backlog-Dateien nicht stagen.
- [ ] **Step 6: Committe Abnahmeunterlagen und TASK-37-Tracking.** Commit-Titel `docs: Record M4 acceptance evidence`. Unabhängige Task-Review, anschließend Whole-Branch-Council mit den ursprünglichen drei Sitzen auf high, read-only, jeweils Score /10. Council-Runden und Befunde protokollieren; fehlende Erreichbarkeit melden, nicht ersetzen. Ergebnisse ohne PR im Abschluss berichten.
