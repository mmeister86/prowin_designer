# TASK-37: M4-Abnahmenachweis

## Freigabe und Ziel

Der Nutzer hat am 07.11.2026 den empfohlenen Umfang aus Council-Runde 1
freigegeben: den bestehenden M4-Pfad nachweisen, keine neuen Produktfunktionen
entwickeln. Methode: Subagent-Driven Development mit anschließendem Council.

Die maßgeblichen Akzeptanzkriterien bleiben die von TASK-37 sowie
`docs/prowin/doop-fork-umsetzung.md` §§ 9, 10 und 14.

## Ansätze

- **Freigegeben:** Bestehenden Schutz durch einen echten Integrationstest und
  eine Abnahmematrix belegen. Kleinster Umfang, keine Verhaltensänderung.
- **Nicht gewählt:** `Frame.locked` zum serverseitigen Inhalts-/Löschschutz
  ausbauen. Das würde bestehendes Agent-Verhalten ändern und gehört nicht zu
  dieser Abnahme.

## Umfang

- Echte Konten, Workspace-Rollen und serverseitige Identitäten über vorhandenes
  `tests/harness.ts`; keine Berechtigungs-, Datenbank- oder Renderer-Mocks.
- Creator erstellt eine Vorlage mit gesperrtem Logo, offenem Textfeld mit
  Maximallänge und erlaubten Tokenfarben, `ig-story` und Safe-Zone-Override.
- Member personalisiert erlaubten Text und erlaubte Farbe. REST und
  authentifiziertes MCP dürfen Sperren, Constraints und geschützte
  Formatmetadaten nicht umgehen; abgelehnte Writes verändern keine Daten.
- Creator-Kontostatus allein verleiht einem Workspace-Member keine
  Vorlagenrechte.
- Nach echtem Serverneustart bleiben Personalisierung, Sperren, Preset,
  Safe Zone und Durchsetzung erhalten. PNG/JPG haben 1080 × 1920 Pixel.
- `docs/prowin/m4-abnahme.md` ordnet die drei ACs konkreten Belegen zu und
  enthält die weiterhin offene manuelle Browser-/Desktop-/iOS-Checkliste.
- Frische Typecheck-/Test-/Lint-Ergebnisse werden nachvollziehbar festgehalten;
  Browser-Skips sind kein Exportnachweis.

## Schutzgrenzen und Nichtziele

- Vorlagenschutz bedeutet `data-od-*`; `Frame.locked` bleibt eine
  Bedienungssperre. Bestehende Admin-Ausnahmen werden beschrieben, nicht geändert.
- Selbstregistrierte Creator können auf persönlichen Kopien Vorlagenrechte
  besitzen. Der Test belegt ausdrücklich den Workspace-Member-Kontext.
- Öffentliche, aktuelle Bild-URLs sind keine privaten Momentaufnahmen. Das
  Datenschutzrisiko wird separat als Follow-up geführt, nicht hier behoben.
- Keine neuen Links, Viewer-Rollen, Share-Funktionen, Dependencies, Migrationen
  oder Refactorings. Vorhandene Export-/Overlay-/Share-Tests wiederverwenden.
- Produktcode nur bei einem reproduzierten Fehler innerhalb des freigegebenen
  M4-Umfangs ändern; Sicherheits-/Verhaltensänderungen benötigen eigene Freigabe.
- Keine Pushes, PRs oder Merges ohne Auftrag. Fremde Änderungen an
  TASK-29/31/32/79 bleiben unangetastet.
- TASK-37 bleibt bis zur ausdrücklichen Nutzerbestätigung nach manueller
  Abnahme offen. Automatisierte Ergebnisse ersetzen keine native Share-Abnahme.
