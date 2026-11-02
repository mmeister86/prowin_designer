# TASK-32: Persistente Format-Presets

Status: Vom Nutzer am 02.11.2026 freigegeben; Umsetzung im isolierten Worktree.

## Ziel

Fünf reproduzierbare Kernformate im Editor auswählen, dauerhaft speichern und
für Nicht-Creator gegen Größenänderungen schützen. Grundlage sind TASK-32,
Umsetzung §§ 10.1–10.2 und Referenz R1.6.

## Ansätze

- Bestehende Editor-Bedienelemente um eine Formatwahl erweitern: weniger UI,
  aber kein eigenständiger Schritt zur Formatwahl.
- Separaten Preset-Dialog verwenden: zusätzlicher Dialog, dafür eine explizite
  Auswahl vor dem Erstellen. Vom Nutzer am 02.11.2026 ausgewählt.

## Umfang und Verhalten

- Die bestehenden manuellen Einstiege „Neue Zeichenfläche“ öffnen denselben
  separaten Dialog. Er bietet Instagram Post (1080 × 1080), Instagram Story
  (1080 × 1920), WhatsApp Status (1080 × 1920), Facebook Post (1200 × 630)
  und A4 Hochformat (794 × 1123 CSS-px).
- Eine Option ohne Preset bewahrt die bisherige freie Zeichenfläche (640 × 480).
  Abbrechen erstellt nichts; Erstellen nutzt die bestehende Platzierung und
  Undo-Verwaltung. Bestehende Dialog-Komponenten und Tastaturbedienung verwenden.
- Ein gemeinsamer Katalog in `shared/prowin/formats.ts` definiert IDs und Maße
  entsprechend § 10.1. Die dort festgelegten Safe-Zone- und Export-Metadaten
  werden nur als Daten übernommen, nicht als neue Funktionen aktiviert.
- `Frame.preset?: FormatPresetId`, nullable Datenbankspalte und Drizzle-Migration
  erhalten die Auswahl. Kein Backfill anhand von Maßen: Story und Status haben
  dieselbe Größe, sind aber verschiedene Formate.
- Speichern, Laden, Serialisierung, Duplikate, Zwischenablage, Canvas-/Seitenkopien
  und Undo/Redo bewahren die Formatzuordnung. Alte Frames ohne Preset bleiben
  kompatibel und behalten ihre bisherige freie Größenänderung.
- REST und Agent-Werkzeuge akzeptieren ausschließlich bekannte Preset-IDs.
  Neue Preset-Frames erhalten die Katalogmaße. Vertrauenswürdig geprüfte Kopien
  bewahren die tatsächlichen Maße ihrer Quelle.
- Nicht-Creator dürfen bestehende Preset-Frames weder skalieren noch durch
  Entfernen oder Wechseln des Presets den Schutz umgehen. Alle maßändernden
  Schreibpfade einschließlich Wiederherstellung und Live-Resize berücksichtigen
  denselben serverseitigen Schutz. Reines Verschieben bleibt erlaubt, sofern
  vorhandene Template-Sperren dies zulassen.
- Creator-Ausnahmen verwenden die bestehenden Canvas-Capabilities, nicht bloß
  einen Creator-Kontostatus. UI und Server folgen derselben Berechtigung.
- Vorschlag des Implementierers: Creator dürfen die tatsächlichen Maße bewusst
  überschreiben; die Preset-ID bleibt dabei die Formatzuordnung. Nicht-Creator
  dürfen auch solche Frames nicht nachträglich skalieren.

## Nicht-Ziele

Kein Safe-Zone-Overlay oder neuer Agent-Safe-Zone-Kontext (TASK-33), keine
Änderung der Exportauflösung (TASK-34), kein PDF-/Share-Flow und keine weiteren
Formate. Keine neue Abhängigkeit und keine Änderung produktiver Benutzerrechte.

## Prüfung und Umsetzung

Subagent-Driven Development mit kleinen sequenziellen Implementierungstasks,
jeweils eigenständigem Spec-/Qualitätsreview und abschließendem Branch-Review.
Tests decken die fünf Formate, Dialogbedienung, Persistenz nach erneutem Laden,
Legacy-Frames, Kopien sowie erlaubte und verweigerte Größenänderungen ab.
Typecheck, Lint und Build ergänzen die automatisierten Tests.

TASK-32 bleibt bis zur ausdrücklichen manuellen Abnahme durch den Nutzer offen.
