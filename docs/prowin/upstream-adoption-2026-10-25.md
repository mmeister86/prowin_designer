# Geprüfte Upstream-Übernahme vom 25. Oktober 2026

## Stand und Rückkehrpunkt

- Ausgangsstand von `main` vor der Integration: `2272d9d3056588c92af5c1a28974bdb04d90fe5c`.
- Arbeitsbranch: `integrate/upstream-2026-10-25`.
- Upstream-Prüfstand: `aa04e959bb9dfef75e0abfb6145bb491f817807a`.
- Backup-Branch: `backup/pre-upstream-2026-10-25-2272d9d`.
- Externes Git-Bundle: `/home/matthias/code/prowin_designer-backups/pre-upstream-2026-10-25-2272d9d.bundle` (Dateimodus 600).
- `git bundle verify` erfolgreich. Zusätzlich in ein separates Bare-Repository geklont, `git fsck --full` erfolgreich und exakt den Ausgangs-HEAD wiederhergestellt.
- Das Backup sichert die Git-Historie einschließlich aller Referenzen, nicht ignorierte `.env`-Dateien, Live-Datenbanken oder andere Laufzeitdaten. Diese Daten wurden nicht verändert.
- Während der isolierten Übernahme kein Push, kein Merge nach `main`, keine Migration gegen Nutzerdaten und keine Veröffentlichung. Die nachfolgende Integration wurde gesondert freigegeben (siehe unten).

Eine Wiederherstellung kann in einem **neuen** Verzeichnis aus dem Bundle erfolgen. Nicht den laufenden Checkout zurücksetzen:

```bash
git clone --branch backup/pre-upstream-2026-10-25-2272d9d \
  /home/matthias/code/prowin_designer-backups/pre-upstream-2026-10-25-2272d9d.bundle \
  /pfad/zu/einem/neuen/wiederherstellungsverzeichnis
```

## Lokal integrierter Stand

Der Benutzer hat anschließend ausdrücklich „Lokal nach Main mergen, dann pushen“ freigegeben. Der geprüfte Branch wurde ohne Konflikte per Fast-forward bis `c4c65d5` nach lokalem `main` übernommen. Direkt auf diesem gemergten Stand bestanden erneut 147 Dateien / 1161 Tests, Typecheck, vollständiger Lint, Build und Doc-Lint. Der Push ist für `origin/main` vorgesehen, ohne Force-Push.

Der zusätzliche repo-weite Formatcheck zeigte ausschließlich Backlog-CLI-Markerabstände und einen Fixture-Zeilenumbruch. Da Aufgaben nur über die Backlog-CLI geändert werden dürfen, sind die CLI-eigenen `backlog/tasks/`-Dateien nun wie `backlog/config.yml` von Prettier ausgenommen. Die Fixture-Änderung ist reine Formatierung. Backup-Branch und externes Bundle bleiben erhalten; Aufgaben werden dadurch nicht automatisch geschlossen.

## Einzelne Originalcommits

Jeder Originalcommit wurde einzeln übernommen, mit Herkunfts-Trailer versehen und vor dem nächsten Commit gezielt getestet. Zusammenhängende Panel- und Resize-Commits hatten gemeinsame unabhängige Review-Gates; sie wurden nicht zusammengefasst.

| Upstream  | Lokal     | Nutzen                                                 |
| --------- | --------- | ------------------------------------------------------ |
| `7f509bd` | `3d8ec21` | Sperren/Sichtbarkeit in Seitenkopien persistieren      |
| `1df6c0b` | `bfc8034` | Sichtbarkeit während Textbearbeitung bewahren          |
| `d1f9752` | `fd1e9ab` | Erledigte Kommentarantworten lesbar machen             |
| `4e3e8b6` | `87241e6` | Schriftauswahl und Textausrichtung                     |
| `1a3373f` | `b4a0734` | Ziehen numerischer Felder und lokale Edit-Sicherheit   |
| `8ef7396` | `3fabf52` | Seitenverhältnis koppeln                               |
| `d98df37` | `5851cc2` | Geometrie-, Layout- und Darstellungssteuerung          |
| `81fb23a` | `91b90d5` | Links auf einzelne Frame-Elemente                      |
| `2caad52` | `4ebbe6b` | Konfliktsichere Zeichnungstransfers                    |
| `3edf6e8` | `da2197a` | Zielseitenauswahl für ausgewählte Frames               |
| `f897395` | `8912ce8` | Resize-Griffe für Elemente                             |
| `cb176aa` | `eefce65` | Schnelle Resize-Gesten korrekt abschließen             |
| `91e8bad` | `84f85fa` | Ungeeignete Transformationen vom Resize ausschließen   |
| `0ab9cf0` | `0c6a54e` | Flex-Fill-Elemente korrekt skalieren                   |
| `0531b70` | `a1a9049` | Hover-Beschriftung über Auswahlkontur                  |
| `06169b4` | `34d925b` | Frames als PNG kopieren                                |
| `aa04e95` | `d082519` | Scharfer Zoom, stabile Cursor und Frame-Beschriftungen |

Die tatsächliche maximale Zoomstufe des letzten Commits ist **1600 %** (`MAX_ZOOM = FOLLOW_MAX_ZOOM = 16`), obwohl sein Titel noch 800 % nennt.

Der iOS-only-Commit `bf3ebac` wurde bewusst nicht übernommen: In dieser Linux-Umgebung fehlt ein belastbarer iOS-Build-/Gerätetest. Die Web-/Server-Serie hängt nicht von ihm ab.

## Minimale Fork-Anpassungen

- Der Seitenkopie-Test registriert seinen Besitzer als Creator, bevor er einen gesperrten Frame erzeugt; die Berechtigungsprüfung wird nicht aufgeweicht.
- Der Sichtbarkeitstest verwendet die bestehende `frameRuntime.html` statt der entfernten Replay-Fixture; keine PostHog-Abhängigkeit wird zurückgebracht.
- README/TECHSTACK-Ergänzungen stehen neben den bestehenden Fork-Dokumenten.
- Das Zoom-Label-Portal enthält keine entfernten GitHub-/Live-Sync-Blöcke; `FlowOverlay` bleibt entfernt. Alle `raster`-Aufrufer einschließlich der Panel-Fixture wurden auf `layoutZoom` migriert.
- Für die kleine Hover-Korrektur wurde ein echter Browser-Regressionstest ergänzt: Hover-Z-Index muss über der Auswahlkontur liegen.

## Während der Tests gefundene Browser-Rennen

Zusätzliche, getrennte Korrekturcommits bleiben nachvollziehbar:

- `071955b`: Zwei Drawing-Tests warten vor einer Geste auf eine echte Runtime-Roundtrip-Antwort. Bloße Frame-Erzeugung im Store bedeutete noch nicht, dass die iframe-Runtime bereits registriert war. Grips-Waits beobachten DOM-Mutationen bei unverändertem Timeout und unveränderten Assertions.
- `c89dc5a`: Ein erster Identitäts-Ansatz gegen wiederkehrende Auswahl wurde später vom unabhängigen Reviewer als unzureichend reproduziert; er wurde nicht als abgeschlossene Lösung akzeptiert.
- `a0eae1e`: Ersetzt diesen Ansatz durch die Gültigkeit der ursprünglichen Auswahl-Epoche. Ein dauerhafter Regressionstest reiht eine Rect-Refresh-Antwort vor dem Abwählen ein, prüft, dass Auswahl und Griffe wegbleiben, und dass eine bewusste Neuauswahl desselben Elements funktioniert.
- `1ec5dc3`: Ergänzt die reale Probe-Abhängigkeit im Hook, schützt Transfer-Undo/Redo und Fallback-Kopien mit erwartetem Frame-Zustand/Version, leert ausstehende Text-Speichertimer vor Style-Vorschauen und entfernt zwei inerte PostHog-Testmocks. Elf weitere Regressionen prüfen Datenerhalt und Text-/Gesture-Undo.
- `e4d38b7`: Korrigiert den im Nachreview gefundenen optionalen Flag-Vergleich: Nur `hidden`/`locked` vergleichen gemäß ihrer Boolean-Semantik, alle Versionen und anderen Zustandsfelder bleiben streng geprüft. Zwei dauerhafte Regressionen prüfen eigenen Flag-Toggle, Toggle-Undo, Transfer-Undo und Redo ohne falschen Konflikt oder unerwünschte Kopie.

Die erste Vermutung eines reinen Polling-/Lastproblems war unvollständig. Die spätere Diagnose zeigte eine reale Wiederbelebung abgewählter Elemente durch eine zurückgestellte React-State-Aktualisierung. Die korrigierte Fassung erhielt ein eigenes Spec-/Qualitätsreview.

## Verifikation und Grenzen

- Ausgangsstand: vollständige Suite mit 140 Dateien / 1019 Tests, Typecheck und Lint erfolgreich; separater Original-main-Vergleich ebenfalls 1019 erfolgreich.
- Jeder Originalcommit: gezieltes RED/GREEN und Typecheck dokumentiert. Bei neuen APIs/Fixtures war ein Teil der RED-Fehler fehlender Export/Fixture-Aufbau statt einer fachlichen Assertion; die Berichte unterscheiden das ausdrücklich.
- Letzter implementerseitiger Gesamtstand: 147 Dateien / 1148 Tests erfolgreich bei vier Workern. Ein initialer Boot-Guard-Test überschritt seine 5-Sekunden-Frist; isoliert 10/10 und der vollständige Wiederholungslauf bestanden. Das ist kein Beleg dafür, dass die Zeitüberschreitung grundsätzlich verschwunden ist.
- Controller-Gesamtlauf vor der letzten Fixrunde: 147 Dateien / 1148 Tests erfolgreich, geschützte Dateien/gelöschte Module geprüft, `main` unverändert. Das Gesamt-Review reproduzierte drei Pflichtbefunde (Hook-Abhängigkeit, verlustbehaftetes Transfer-Undo, Texttimer während Style-Vorschau).
- Nach `1ec5dc3`: fokussiert 19 Dateien / 269 Tests, vollständige Vier-Worker-Suite 147 Dateien / **1159 Tests**, Typecheck, vollständiger Lint, Build, Doc-Lint und Formatprüfung der Fixdateien erfolgreich. Das unabhängige Nachreview bestätigt die drei ursprünglichen Befunde als behoben.
- Im Nachreview blieb zunächst Important I4 offen: Transfer → eigener Lock/Hide-Toggle → Toggle-Undo → Transfer-Undo erzeugte einen falschen Konflikt wegen `undefined !== false`. Der Benutzer hat die begrenzte Folgekorrektur ausdrücklich freigegeben. `e4d38b7` behebt sie mit den beiden beschriebenen Regressionen; das unabhängige, eng begrenzte Nachreview bestätigt **Spec compliant, Quality PASS, I4 ADDRESSED, keine offenen Critical/Important-Befunde**. Keine neue breite Reviewwelle und kein weiterer Funktionsausbau.
- Abschließender Stand nach dieser Korrektur: fokussiert `drawingMove` **34/34**, gesamte Vier-Worker-Suite **147 Dateien / 1161 Tests** erfolgreich (ein vollständiger Lauf, 141,19 s). Typecheck, vollständiger Lint, Build, Doc-Lint und Formatprüfung der geänderten Quelldateien erfolgreich. RED vor der Korrektur: exakt beide neuen Flag-Fälle scheiterten mit falschem Konflikt (2 fehlgeschlagen / 32 bestanden). Controller hat Rohlogs, Versions-/anderen Feldschutz, alle 17 Herkunfts-Trailer, geschützte Dateien, entfernte Module und unverändertes `main` geprüft.
- Freigabestand vor der anschließend genehmigten Integration: zur manuellen Abnahme bereit, noch nicht automatisch integriert. Backlog-Abschluss nur nach ausdrücklicher Benutzerbestätigung; alle Aufgaben bleiben vorerst In Progress. Der letzte Stopp am Review-Limit wurde vom Benutzer beanstandet; die Folgearbeit blieb auf I4, Regression, gezieltes Review und eine abschließende Verifikation begrenzt.
- Nichtblockierender neuer Hinweis M2: Eine Rect-Aktualisierung kann ein bewusst geschlossenes Design-Panel wieder öffnen. Das Nachreview stuft dies als Minor ein; keine Auswahl-/Daten-/Rechteverluste.
- Reale WebKit-/Tauri-Darstellung und Zwischenablage sowie iOS-Laufzeit wurden nicht auf den Zielgeräten geprüft. Keine Live-Requesty-Anfragen für diese Übernahme nötig.
- Implementierungsplan: `docs/superpowers/plans/2026-10-25-upstream-adoption.md`. Detaillierte Berichte, Rohlogs und Review-Pakete liegen bis zur manuellen Abnahme im ignorierten `.superpowers/sdd/2026-10-25-upstream-adoption/` dieses Worktrees.
- Backlog: `TASK-67` und `TASK-67.1` bis `TASK-67.11` bleiben bis zur ausdrücklichen Benutzerbestätigung **In Progress**.
