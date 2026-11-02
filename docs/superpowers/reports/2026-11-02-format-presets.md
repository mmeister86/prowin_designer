# TASK-32: Fünf Kernformate persistent integrieren

## Umsetzung

- Separater Dialog für Instagram Post, Instagram Story, WhatsApp Status,
  Facebook Post und A4; zusätzlich freie Zeichenfläche wie bisher.
- Gemeinsamer Katalog mit exakt vorgegebenen CSS-px-Maßen, optionales
  `Frame.preset` und nullable Datenbankmigration `0041_frame_presets`.
- Persistenz und Formatzuordnung über Speichern, Neuladen, Canvas-/Seitenkopien,
  Zwischenablage, Duplizieren und Undo/Redo. Story und Status bleiben verschieden.
- Serverseitiger Schutz vor unerlaubtem Resize und Preset-Wechsel/-Entfernung
  über REST, MCP, Resident-Agent, Versions-Restore und Live-Drag.
- Creator-Ausnahmen verwenden die aktuelle Canvas-Berechtigung; ein Creator-Konto
  allein genügt nicht. Größenangepasste Creator-Presets behalten ihre Zuordnung.
- UI deaktiviert geschützte Größenfelder und Resize-Griffe. Fehler beim
  Wiederherstellen oder Einfügen werden angezeigt; Retry-Snapshots bleiben erhalten.
- Keine neuen Abhängigkeiten, Safe-Zone-Overlays, Exportänderungen oder Änderungen
  produktiver Rechte. TASK-33 und TASK-34 bleiben eigenständige Vorhaben.

## Vertrauensgrenzen

- Gewöhnliche neue Preset-Frames erhalten immer Katalogmaße.
- Quellkopien prüfen aktuellen Zugriff, Preset und tatsächliche Quellmaße.
  Seitenkopie-Redo erhält die Original-Provenienz auch für Member.
- `restoreDimensions` ist ein expliziter, nicht vertrauenswürdiger Restore-Intent.
  Ohne lebende Quelle dürfen nur aktuell berechtigte Canvas-Creator individuelle
  Maße wiederherstellen. Sonst erfolgt eine sichtbare Ablehnung vor Mutationen,
  keine stille Änderung des Layouts.
- Nach fehlender Quelle (404) dürfen Creator Plain-Preset-Inhalte ausdrücklich
  neu anlegen; 403, Template-Quellen und Nicht-Creator erhalten keinen solchen
  Fallback. Die neue Anfrage wird erneut serverseitig geprüft.
- Live-Drag prüft aktuelle Sitzung, Rechte und Frame-Version. Sequenzen verhindern
  verspätete Relays, ohne kontinuierliche Bewegungen auszuhungern.

## Prüfstand

- Test-first-Umsetzung mit nachgewiesenen RED/GREEN-Läufen für alle drei Schritte
  und die gefundenen Integrationsfehler.
- Unabhängige Spec-/Qualitätsreviews pro Schritt, Gesamtbranch-Review und
  abschließendes scoped Re-Review: keine offenen Critical-/Important-Befunde.
- CodeRabbit-Vollreview ausgeführt; ursprüngliche Major-/Minor-Findings behoben.
  Wiederholung bestätigt keine Major-/Critical-Findings, ein Minor-Follow-up
  bleibt als TASK-80 erfasst.
- Controller-Prüfung auf `abb51d9`: 209 Dateien / 1.855 Tests bestanden.
- Abschließende Fix-Regression auf `2f9eae2`: 13 Dateien / 208 Tests bestanden.
- Controller-Typecheck, vollständiges Lint, Build und Whitespace-Prüfung auf
  `2f9eae2` bestanden. Abschließende vollständige Suite: **210 Dateien / 1.875
  Tests bestanden**, keine übersprungen, 390,05 Sekunden (`--maxWorkers=2`).
- Vollsuite-Log: `/tmp/opencode/task-32-final-suite-2.log`; Build-Log:
  `/tmp/opencode/task-32-controller-final-build.log`. Docs-Lint ebenfalls bestanden.
- Reale HTTP-/MCP-/WebSocket-, Resident-Laufzeit-, PGlite-Persistenz- und
  Chromium-Tests enthalten; einschließlich Desktop-/Mobile-Dialog, Cancel,
  gesperrter Hintergrund-Tastaturaktionen, Rechteentzug und Kopier-/History-Fällen.

## Grenzen und Follow-ups

- TASK-80: Resident-Platzierung neben Kommentaren nutzt für preset-only Anfragen
  noch Defaultmaße zur Kollisionsprüfung. Gespeicherte Preset-Maße sind korrekt;
  die automatische Platzierung kann dennoch überlappen.
- Kein Lastprofil der zusätzlichen Session-/Rechteabfragen beim Live-Drag.
- Keine manuelle Geräteprüfung und kein externer PostgreSQL-Deploymenttest;
  automatische Integration verwendet PGlite und Chromium.
- Bekannte Node-localStorage-/localhost-Verbindungs-/happy-dom-Teardown-Ausgaben
  und der bestehende Vite-Chunk-Hinweis sind nicht als Testfehler verschwiegen
  oder durch Konfigurationsänderungen unterdrückt worden.
- Kein Push, Merge oder Deployment. TASK-32 bleibt bis zur ausdrücklichen
  manuellen Nutzerabnahme **In Progress**.

## Entscheidungen des Controllers

1. Native Standard-Subagents statt expliziter Modellwahl: Die Tool-Vorgaben
   erlauben keine unangefragte Modellwahl. Kosten: möglicherweise teurer als
   spezialisierte günstigere Modelle.
2. Zwei Testworker: Der unbeschränkte Baselinelauf erzeugte Überlast/Timeouts,
   kontrollierte Wiederholung war grün. Kosten: längere Gesamtlaufzeit.
3. Kleingeschriebene imperative Commit-Subjects gemäß Repository-Commitlint
   statt großgeschriebener Planbeispiele. Keine Produktverhaltensänderung.
4. Expliziter, servergeprüfter History-Restore-Intent statt stiller
   Maß-Kanonisierung oder neuer Speicherung gelöschter Daten. Kosten: Ohne
   aktuelle Creator-Rechte und lebende Quelle kann ein individuell skaliertes
   Preset nicht wiederhergestellt werden; die UI zeigt dies und erhält den Retry.
5. Den verbleibenden CodeRabbit-Minor zur Resident-Platzierung als TASK-80
   zurückstellen: Maße/Persistenz und Rechte sind korrekt, Platzierung ist
   getrennt korrigierbar. Kosten: automatisch platzierte Presets können bis
   dahin bestehende Frames überlappen.
