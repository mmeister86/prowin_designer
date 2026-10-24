# TASK-14: Creator und Workspace-Berechtigungen

## Ziel und bestätigte Entscheidungen

Matthias bleibt einziger echter Instanz-Admin. Jede Beraterin darf sich selbst als
Creator registrieren und einen eigenen Workspace gründen. Der Workspace-Owner
lädt andere Creator oder normale Beraterinnen ein und bestimmt ihre Rechte.
Creator-Registrierung verleiht weder Instanz-Administration noch Zugriff auf
fremde Workspaces. Das bisherige AC gegen Creator-Selbstbeförderung wird durch
diese ausdrücklich gewünschte Selbstregistrierung ersetzt.

## Ansätze

1. Creator nur als Workspace-Rolle: wenig zusätzliche Daten, bildet jedoch die
   eigenständige Creator-Registrierung nicht ab.
2. Creator als Kontostatus plus separate Workspace-Mitgliedschaft (Empfehlung):
   Registrierung und Zugriff bleiben unabhängig; ein Creator kann in einem
   anderen Workspace lediglich als Beraterin mitarbeiten.
3. Creator als Instanz-Adminrolle: verworfen, weil nur Matthias echter Admin bleibt.

Dieser Entwurf konkretisiert Ansatz 2. Die Freigabe steht noch aus.

## Rechte und Eigentumsgrenzen

- Instanz-Admin bleibt die bestehende Better-Auth-Rolle `admin`. Creator ist ein
  separat persistierter Kontostatus; Registrierung verändert niemals `user.role`.
  Die bestehenden Admin-Routen und der schreibgeschützte View-as-Modus bleiben.
  Kein pauschaler Zugriff auf private fremde Canvases durch neue Creator-Prüfungen.
- Ein authentifiziertes Konto beginnt als Beraterin und aktiviert Creator über
  eine explizite Aktion im Konto. Die API bestimmt das Zielkonto aus der Session.
- Ein Creator darf Workspaces anlegen und wird dort Owner. Bestehende Owner
  werden bei der Migration als Creator übernommen; normale Mitglieder nicht.
- Workspace-Rollen: `owner`, `creator`, `member`. `member` bedeutet Beraterin:
  mitarbeiten, erlaubte Inhalte bearbeiten, exportieren. `creator` darf zusätzlich
  Vorlagen veröffentlichen, Template-Sperren verwalten und Local Agent nutzen.
  Nur der Owner verwaltet Einladungen, Rollen, Workspace-Löschung und Abrechnung.
  Die bestehende Workspace-Rolle `admin` wird zu `creator` migriert; sie verleiht
  künftig keine Mitgliederverwaltung. Das ist eine bewusste Änderung des Modells.
- Der Owner darf `member` und `creator` einladen/vergeben. `creator` setzt den
  Creator-Kontostatus des Zielkontos voraus; unbekannte E-Mail-Adressen können
  zunächst als `member` eingeladen werden. Mitgliedschaft macht niemanden zum
  Creator. Niemand kann die eigene Workspace-Rolle verändern oder Owner werden.
- Creator-Kontostatus allein reicht in fremden Workspaces nicht: dort sind
  Mitgliedschaft und Rolle `creator` oder `owner` notwendig. Linkfreigaben und
  direkte Canvas-Einladungen verleihen keine Creator-Rechte.
- In persönlichen Canvases haben nur deren Creator-Eigentümer Creator-Rechte.
  Im Workspace gelten Creator-Rechte für dessen Vorlagen gemeinschaftlich.
  Veröffentlichungen bleiben zusätzlich dem jeweiligen Canvas-Eigentümer
  vorbehalten; Creator-Mitarbeit ersetzt keine Eigentumsübertragung.
- Viewer ist die nicht angemeldete Galerie-Besucherin. Keine neue private
  Viewer-Mitgliedschaft und kein neuer Ansichts-Link in TASK-14.

## Durchsetzung und Umfang

Neue Logik liegt unter `server/prowin`, `shared/prowin`, `src/prowin` mit dünnen
Einhängepunkten. Der Server ist für alle Rechte maßgeblich; UI erhält abgeleitete
Capabilities und blendet unzulässige Aktionen aus.

Creator-Prüfungen schützen Veröffentlichung und Sperränderungen sowie den Local
Agent einschließlich Polling, Run-Erstellung, Ausführung und kurzlebigem MCP-Token.
Ein Rechteentzug muss bei Folgezugriffen wirken, auch bei bereits laufenden Runs.
Local Agent darf ausschließlich für Canvases mit aktuellen Creator-Rechten laufen.
Alle Schreibkanäle (REST, MCP, Agent und relevante WS-Aktionen) berücksichtigen
Sperrberechtigungen, damit direkte Requests die UI nicht umgehen.

TASK-14 liefert das Berechtigungsfundament und Schutz vorhandener Sperrfunktionen.
Die vollständige feldweise Template-Personalisierung, weitere Template-Metadaten
und der spätere Template-Guard bleiben ihren eigenen Backlog-Aufgaben zugeordnet.
TASK-29 übernimmt die geschützte Bearbeitung der `data-od-*`-Attribute, TASK-30
den vollständigen HTML-Template-Guard und TASK-31 dessen Editor-Darstellung.
TASK-14 schützt vorhandene Frame-Sperränderungen und stellt die gemeinsamen
Capabilities für diese Folgeaufgaben bereit; eine vollständige sichere
Template-Personalisierung wird erst mit TASK-29 bis TASK-31 behauptet.

## Testgruppe und Einführung

Keine pauschale Creator-Freischaltung aller Konten. Mitglieder der Testgruppe
aktivieren Creator selbst; der Owner lädt sie mit der gewünschten Rolle ein.
Ein dokumentierter Ablauf einschließlich Prüfung der wirksamen Rechte gehört
zur Lieferung. Ohne benannte Konten werden keine realen Nutzerrechte verändert.

## Verifikation und offene Umsetzungsspielräume

Tests prüfen Selbstregistrierung ohne Admin-Eskalation, Owner-only Rollenvergabe,
Einladungen normaler Beraterinnen, Isolation zwischen Workspaces, Migration,
Publish/Sperren/Local-Agent-Zugriffe und Rechteentzug über alle Eintrittspunkte.
Typecheck, passende Tests, Lint und Build müssen bestehen. Schema, API-Namen,
UI-Platzierung und genaue Testaufteilung entscheidet die Implementierung.

Nach Freigabe: Implementierungsplan schreiben, Änderungen und Migrationen
umsetzen, prüfen, Q4 und TASK-14 mit Nachweisen aktualisieren. Dieser Entwurf
enthält noch keine erfolgte Implementierung oder Testgruppen-Freischaltung.

## Builder-Check

Ein unabhängiger Builder-Check fand keine wichtigen offenen Planungsfragen.
Die Abgrenzung zu TASK-29 bis TASK-31 wurde anschließend explizit ergänzt.
