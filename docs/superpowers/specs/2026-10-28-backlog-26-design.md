# TASK-26: Brand-Styles an Frame-Schreibgrenzen

Status: Umsetzung durch Nutzer am 28.10.2026 mit „Kannst du dann fortfahren“ autorisiert. Lokale Implementierung und gezielte technische Prüfung vorhanden; manuelle Abnahme offen. Zwei zusätzliche Schriftarten aus TASK-25 fehlen weiterhin.

## Ziel und Grenzen

Gespeichertes Frame-HTML enthält genau einen kanonischen `style[data-od-brand]`-Block mit den 13 freigegebenen CI-Farbtoken aus `DESIGN-prowin.md` und den selbst gehosteten Fontfaces aus TASK-25. Wiederholte Normalisierung ergibt exakt denselben String. Gestaltung, Texte, Scripts und sonstiges HTML bleiben außerhalb gezielter Brand-/Font-Ersetzungen erhalten.

TASK-26 beschafft keine Schriftdateien und behauptet keine eigene Renderer-Parität. Der zunächst geprüfte Stand auf `main` enthält TASK-25 noch nicht. Im separaten Worktree `/home/matthias/.local/share/opencode/worktree/9d3066/task-25-brand-fonts` sind die Kernfonts und deren Auslieferung bereits implementiert. Der Nutzer hat bestätigt, dass inhaltlich nur die beiden letzten Schriftarten fehlen. Die TASK-25-Notizen nennen diese als LumiosBrush-Regular und LTKai-Regular. Keine erfundenen Dateipfade, Ersatzschriften oder leeren Fontfaces für diese Ergänzungen verwenden. TASK-25 nicht erneut implementieren oder automatisch schließen.

Vorhandener Font-Vertrag aus TASK-25: Sofia Sans 300/500, Sofia Sans Condensed 700 und Roboto 300/500/900, jeweils statisch, normal, Latin und Latin-Ext. Die zwölf WOFF2-Dateien liegen unter `public/fonts` mit Fontsource-Dateinamen und werden unter `/fonts/<Dateiname>` mit CORS ausgeliefert. Die Renderer-Referenz verwendet absolute URLs derselben Instanz; diesen bestehenden Vertrag übernehmen. TASK-25 dokumentiert bestandene Browser-/Chromium- und hostseitige Blitz-Prüfungen. Diese Ergebnisse wurden hier gelesen, nicht erneut ausgeführt.

## Bestand

- `server/prowin/brand.ts`: globale Markdown-Quelle und lokale Brand-Guideline; kein Runtime-CSS.
- `server/store.ts`: `createFrame`, `updateFrame`, `duplicateCanvas` und `duplicatePage` übernehmen HTML. REST, MCP, Resident, Seed und Demo bauen darauf auf.
- `server/actions.ts`: Versionswiederherstellung, Änderungsvergleich, Reveal und `appendFrameHtml`. Streaming hängt aktuell an `before.html` an.
- `server/db/persist.ts`: persistiert Store-Zustand und Kopien. Normalisierung nur hier würde DB, Speicher und Broadcasts auseinanderlaufen lassen.
- `server/index.ts`: DB-Initialisierung und Hydration bieten eine Grenze für die Bestandsmigration.

## Ansätze

1. **Empfehlung: zentrale Normalisierung vor Übernahme in den Store.** Eine gemeinsame Funktion für vollständige Writes, Kopien, Restore und Migration. Streaming erhält einen separaten Rohdatenpuffer. Vollständige normalisierte Inhalte gehen konsistent an Store, Persistenz und Clients.
2. **Nur Persistenz normalisieren:** kleinflächiger Eingriff, aber unterschiedliche Inhalte in Datenbank, Speicher und Broadcasts. Erfüllt die gemeinsame HTML-Wahrheit nicht.
3. **Jeden API-Endpunkt separat behandeln:** lässt Kopien, Restore oder neue interne Pfade leicht aus. Erhöht Wartungsaufwand und das Risiko unterschiedlicher Ergebnisse.

Ansatz 1 wird umgesetzt; die Nutzerfreigabe zur Fortsetzung liegt vor.

## Normalisierungsvertrag

- Eine deterministische Funktion verarbeitet HTML-Fragmente und vollständige Dokumente. Sie ersetzt vorhandene echte Brand-Style-Blöcke durch genau einen kanonischen Block und fügt ihn andernfalls an einer stabilen Stelle ein.
- Kein vollständiges Parsen und Neu-Serialisieren des Dokuments: unveränderte Bereiche sollen bytegleich bleiben. Eine tagbewusste Verarbeitung muss Kommentare, Script-Strings, Attribute und Style-Inhalte berücksichtigen; reine globale Regex-Ersetzungen reichen dafür nicht.
- Externe Font-Stylesheet-Links entfernen; andere Stylesheets erhalten. Die Erkennung externer Fontanbieter und der Umgang mit CSS-`@import` müssen ausdrücklich getestet werden. Eine pauschale Entfernung externer Stylesheets wäre Inhaltsverlust.
- Das kanonische CSS nutzt exakt die freigegebenen Tokenwerte. Fontfamilien, Gewichte, Zeichensätze und reale URLs stammen aus dem vorhandenen TASK-25-Vertrag. LumiosBrush-Regular und LTKai-Regular werden erst mit realen, geprüften Assets ergänzt; ihr Fehlen blockiert die Normalisierungslogik und die Integration der Kernfonts nicht.
- Änderungsvergleiche und Versionsentscheidungen vergleichen normalisierte vollständige Inhalte, damit reine Normalisierungsunterschiede keine unnötigen Versionsbursts oder Reveals erzeugen.
- Leere Frames brauchen eine ausdrücklich getestete Behandlung: ein injizierter CSS-Block darf sie nicht als fertiges Design erscheinen lassen oder neue Agent-Reveals auslösen.

## Schreibpfade und Streaming

- Neue Frames, vollständige HTML-Updates, Versionswiederherstellung sowie Canvas-/Seitenkopien verwenden dieselbe Normalisierung.
- Streaming sammelt Roh-HTML getrennt vom normalisierten gespeicherten Frame. Weitere Chunks dürfen nie an bereits injiziertes Brand-CSS angehängt werden.
- Zwischenstände dürfen unvollständig bleiben. Abschluss, Timeout, Unterbrechung und Übernahme durch einen anderen Write benötigen eine einheitliche Finalisierung; diese darf weder nachträglich neuere Edits überschreiben noch halbe Tags verschlucken.
- Die vorhandenen Escape-/Repair-Regeln und `healPartialHtml` bleiben Teil der bisherigen Streaming-Semantik. Tests prüfen ihr Zusammenspiel mit Brand-Normalisierung.

## Wiederholbar sichere Bestandsmigration

- Migration nach Schema-Initialisierung und vor Hydration bzw. Freigabe von Requests ausführen. Keine konkurrierenden Live-Edits während dieser Migration.
- Dieselbe Normalisierungsfunktion auf aktuelle Frame-Zeilen anwenden. Nur tatsächlich unterschiedliche HTML-Werte schreiben; IDs, Geometrie, Autor und Zeitstempel erhalten.
- Große Bestände in begrenzten Batches verarbeiten; ein abgebrochener Lauf kann gefahrlos erneut starten. Fehler verhindern den regulären Start, statt teilweise migrierte Daten still als vollständig auszugeben.
- Historische Versionen bleiben als Original erhalten und werden beim Restore normalisiert. Gepinnte Referenzen sind eigenständige Snapshots; Änderungen daran gehören nicht stillschweigend in die Frame-Migration.
- Token-/Fontänderungen verwenden erneut diese Migration. Ein einmaliger SQL-Lauf mit fest kopiertem CSS wäre dafür ungeeignet.

## Verifikation und Abnahme

- Unit-Tests: kein/ein/mehrere Brand-Blöcke; Fragmente und Dokumente; wiederholtes Speichern; unveränderte Scripts/Kommentare/Texte; externe Fontlinks und CSS-Imports.
- Integrationstests: Erstellen, Update, REST/MCP, Restore, Canvas-/Seitenkopie und Streaming mit über Chunks geteilten Tags sowie Timeout/Unterbrechung.
- Migrationstest mit vorhandenen Frames, unveränderten Metadaten, zweitem Lauf ohne Änderungen und erneutem Lauf nach geändertem kanonischem CSS.
- Vorhandene HTML-, Versions-, Streaming- und Kopiertests ausführen; anschließend Typecheck und passende Lint-Prüfungen.
- AC1 und AC3 bleiben bis zur funktionierenden Fontintegration und bestandenen Tests offen. TASK-26 bleibt bis zur ausdrücklichen Nutzerabnahme In Progress.

## Integrationsstand

TASK-26 baut auf dem bestehenden Font-Vertrag von TASK-25 auf. Die unveränderten Kernfontdateien, Lizenzen, Paketpins, Express-/Vite-Auslieferung, Screenshot-Anpassungen und zugehörigen Fonttests wurden aus dessen Worktree als Voraussetzung übernommen. Der andere Worktree wurde dabei nicht verändert. Die iOS-/Blitz-Dateien und der Backlog-Eintrag von TASK-25 bleiben dort; es wurde keine erneute Font-Grundimplementierung durchgeführt. LumiosBrush-Regular und LTKai-Regular bleiben explizite Restarbeit von TASK-25.

Konkrete Implementierung:

- `server/prowin/brandTokens.ts`: 13 CI-Farbtoken und zwölf vorhandene statische Fontfaces mit originalen Unicode-Ranges aus Fontsource 5.3.0.
- `server/prowin/frameBrand.ts` und `shared/frameBrandHtml.ts`: tagbewusste Bearbeitung ohne Neu-Serialisierung, genau ein kanonischer Brand-Block, Entfernung bekannter externer Fontanbieter-Links/-Imports und externer Font-Preloads. Kommentare, Raw-Text-Elemente, Attribute, Deklarationen und SVG-CDATA bleiben als Inhalt erhalten. CSS-Kommentare zwischen Import-Tokens werden berücksichtigt. Allgemeine Netzwerksperren und das Auflösen beliebiger entfernter Stylesheets gehören zu TASK-27.
- `server/store.ts`: Normalisierung vor Persistenz in Create, Update und beiden Kopierpfaden.
- `server/actions.ts`: separater Streaming-Rohpuffer; gespeicherte Zwischenstände werden geheilt und normalisiert. Abschluss und Timeout brauchen keine nachträgliche Schreiboperation. Vollständige Writes verwerfen den Rohpuffer; dadurch kann keine späte Finalisierung neue Inhalte überschreiben. Die Ähnlichkeitsbewertung ignoriert generiertes Brand-CSS.
- `server/prowin/migrateFrameBrands.ts`: Schlüsselpagination in Batches von 100, inhaltsbedingte Updates, unveränderte Attribution/Zeitstempel. Boot führt sie nach möglichem Legacy-Import und vor Store-Hydration/Listening aus.
- `shared/frameContent.ts`: Brand-CSS allein bleibt für Editor-Platzhalter und MCP-Hinweise ein leerer Frame. Server und Client verwenden denselben tagbewussten Scanner, auch für serialisierte Attribute. `FrameView` berechnet diesen Zustand pro HTML-Änderung, nicht bei jeder Zeigerbewegung neu.

Die automatischen Prüfungen ersetzen keine manuelle Abnahme. Die beiden zusätzlichen Fonts sowie eine erneute iOS-Geräteprüfung werden nicht als erledigt behauptet.

## Verifikation am 28.10.2026

- Erweiterte Normalisierungs-/Write-/Migrations-/Zeichnungs-/Pfadtests: 5 Dateien, 84 Tests bestanden.
- Reale HTML-/Versions-/Kopierpfade und Font-/Runtime-Regressionen: 9 Dateien, 26 Tests bestanden.
- Browser-Nachlauf mit separaten Fonttest-Caches: 71 Tests bestanden; der darin durch einen zwischenzeitlichen Setup-Fehler übersprungene Font-Paritätsteil wurde korrigiert und separat mit 2 bestandenen Tests nachgeprüft. Zeichnungs- und Elementpanel-Browserfälle sind darin vollständig enthalten.
- Typecheck, Lint, Build und `git diff --check` bestanden. Build meldet die bestehende Chunkgrößenwarnung; doc-lint besteht mit dem Hinweis auf ältere CLAUDE-/Kontextdokumente.
- Zwei CodeRabbit-Läufe abgeschlossen. Echte Befunde (gemeinsame Empty-Erkennung, SVG-CDATA, CSS-Import-Kommentare) korrigiert und durch Regressionstests geprüft. Fragment-/Zeichnungs-/Pfadkompatibilität ebenfalls geprüft.
- Vollständiger Lauf mit `--maxWorkers=4 --testTimeout=30000`: 171 von 173 Dateien bestanden; 1 Browserfall fehlgeschlagen und 41 Browserfälle wegen Fixture-Start-Timeout übersprungen. Diese Fälle bestehen im gezielten Nachlauf. Der Gesamtlauf wird ausdrücklich nicht als grün behauptet. Die verbleibende Parallelitäts-/Startinstabilität ist als TASK-73 erfasst; die neuen Fonttests verwenden eigene Vite-Caches.
- Zum Zeitpunkt dieser Verifikation noch kein Commit, Push oder PR. Branch: `task/26-brand-normalization`. TASK-26 bleibt bis zur ausdrücklichen Nutzerabnahme In Progress.

## Integration nach main

Der Nutzer hat am 28.10.2026 ausdrücklich das Zusammenführen der Ergebnisse von TASK-25 und TASK-26 nach `main` beauftragt. Die Ausgangsstände sind als `00deb31` (TASK-25) und `c8d945b` (TASK-26) gesichert. Die zusätzlichen Blitz-/iOS-Prüfungen und Dokumente aus TASK-25 werden übernommen; bei den beiden Add/Add-Konflikten bleiben die neueren Fonttests aus TASK-26 mit ihren getrennten Vite-Caches erhalten. Beide Backlog-Aufgaben bleiben In Progress; der Merge ersetzt keine Abnahme und ergänzt die zwei fehlenden Schriftarten nicht.
