# Rollen und Berechtigungen (Q4)

Entscheidung zu TASK-14, vom Nutzer am 24.10.2026 freigegeben.

## Konto und Workspace

Matthias bleibt einziger Instanz-Admin. Die bestehende Better-Auth-Rolle `admin`
bleibt allein für Instanzverwaltung, Moderation und schreibgeschütztes „View as“
zuständig. Creator-Registrierung verändert diese Rolle niemals.

Jede angemeldete Beraterin kann unter **Settings → Account → Creator werden**
ihren Creator-Status selbst aktivieren. Neue Konten starten ohne diesen Status.
Die Registrierung ist dauerhaft und wiederholbar; der Server bestimmt das
Zielkonto aus der Session, unabhängig von mitgesendeten Benutzer-IDs oder Rollen.
Ein Creator darf eigene Workspaces gründen und wird dort Owner.

Workspace-Mitgliedschaft und Creator-Kontostatus sind getrennt:

| Workspace-Rolle    | Mitarbeit                      | Vorlagenrechte                          | Einladungen, Rollen, Abrechnung, Löschung |
| ------------------ | ------------------------------ | --------------------------------------- | ----------------------------------------- |
| Owner              | Ja                             | Ja                                      | Ja                                        |
| Creator            | Ja                             | Ja, mit aktiviertem Creator-Kontostatus | Nein                                      |
| Member (Beraterin) | Ja, ohne Creator-Registrierung | Nein                                    | Nein                                      |

Nur der Owner vergibt `member` oder `creator`. Für `creator` muss das Zielkonto
bereits als Creator registriert sein. Unbekannte E-Mail-Adressen können zunächst
als Member eingeladen werden; sie treten nach Registrierung und gegebenenfalls
E-Mail-Verifizierung bei. Der Owner kann sie später zu Creator-Mitarbeitenden
machen. Ein eingeladenes Mitglied kann sich selbst als Creator registrieren,
erhält dadurch aber keine höhere Rolle im einladenden Workspace.

Owner-Rechte werden nicht über Einladungen übertragen. Mitglieder dürfen selbst
austreten. Ein Workspace-Creator hat keine Mitgliederverwaltung und keine
Instanz-Adminrechte. Der Owner kann Mitglieder entfernen oder ihre Rolle ändern.

## Canvas-Grenzen

- In persönlichen Canvases hat nur deren Creator-Eigentümer Vorlagenrechte.
- In Workspace-Canvases benötigen auch deren Eigentümer die aktuelle
  Workspace-Mitgliedschaft als Owner oder Creator sowie den Creator-Kontostatus.
  Ein ehemaliges Mitglied kann sein eigenes Canvas weiter öffnen, hat darin aber
  keine Workspace-Vorlagenrechte mehr.
- Direktes Canvas-Einladen und ein Bearbeitungslink verleihen keine Vorlagenrechte.
- Veröffentlichung und Zurückziehen einer Veröffentlichung benötigen zusätzlich
  Canvas-Eigentum. Workspace-Creator dürfen gemeinsam Sperren verwalten, aber
  fremde Canvases nicht veröffentlichen oder in eigene Workspaces verschieben.
- Instanz-Admins erhalten durch dieses Modell keinen pauschalen Zugriff auf
  private fremde Canvases. Privilegierte Aktionen benötigen vorhandenen Zugriff;
  „View as“ bleibt schreibgeschützt.
- Viewer bezeichnet nicht angemeldete Galerie-Besucherinnen. Die Galerie erlaubt
  Vorschauen; zum Kopieren braucht es Anmeldung. Ein Ansichts-Link für private
  Canvases und eine zusätzliche Viewer-Mitgliedschaft sind nicht enthalten.

## Serverseitige Prüfung

`server/prowin/accounts.ts` liest Creator-Status und Instanzrolle aus der Datenbank.
`server/prowin/permissions.ts` verbindet sie mit aktuellen Workspace-Rollen.
REST, MCP und Resident-Agent erhalten ausschließlich eine vertrauenswürdige
serverseitige Identität; Anzeigenamen und Request-Actor-Felder verleihen keine Rechte.
Die UI liest `/api/me` und `/api/canvases/:id/capabilities` und aktualisiert
Canvas-Capabilities bei Fokuswechsel und regelmäßig während einer geöffneten Seite.
Die Berechtigungsprüfung auf dem Server bleibt bei jedem Schreiben maßgeblich.

Veröffentlichung sowie Setzen/Entfernen des vorhandenen `Frame.locked`-Flags
werden serverseitig geprüft. HTML-Element-Sperren und feldweise Personalisierung
sind noch keine vollständige Schutzmaßnahme: TASK-29 stellt die Template-Attribute
bereit, TASK-30 schützt alle HTML-Schreibpfade, TASK-31 ergänzt deren UI. Die
bestehende allgemeine Bearbeitungsberechtigung wird durch TASK-14 nicht zu einem
bereits fertigen Template-Guard erklärt.

Local Agent ist nur für Creator/Instanz-Admins sichtbar und erreichbar. Ein Run
benötigt zusätzlich Creator-Rechte im konkreten Canvas. Sie werden bei
Run-Erstellung, Job-Abruf, MCP-Zugriff, jeder serialisierten Tool-Ausführung und
Ergebnisannahme erneut geprüft. Ein altes Run-Token behält nach Rollenentzug keine
Schreibberechtigung. Verbotene lokale Ausführung fällt nicht auf den Server zurück.
Das eigene Claude-Konto bleibt der separate Local-Agent-Pfad.

## Migration und Testgruppe

Migration `0038_prowin_creator_permissions` aktiviert Creator für bestehende
Workspace-Owner und Workspace-Admins. Letztere werden im Workspace zu `creator`
und verlieren die Mitgliederverwaltung. Alte noch nicht angenommene Admin-
Einladungen werden zu Member-Einladungen. Normale Mitglieder werden nicht pauschal
freigeschaltet. Instanzrollen werden nicht verändert.

Ablauf für die Testgruppe:

1. Konto anlegen, gegebenenfalls E-Mail bestätigen und anmelden.
2. Unter **Settings → Account** ausdrücklich „Als Creator registrieren“ wählen.
3. Der Gruppen-Owner gründet einen Workspace und lädt registrierte Creator mit
   Rolle **Creator** ein; normale Beraterinnen erhalten Rolle **Member**.
4. Im Workspace ein Canvas erstellen. Der Creator-Eigentümer veröffentlicht eine
   Vorlage und prüft Frame-Sperren. Ein Member prüft Mitarbeit und Export sowie
   das Fehlen der Vorlagenrechte und des Local Agent.
5. In einem fremden Workspace als Member gegenprüfen: Der eigene Creator-Status
   verleiht dort weder Sperr- noch Local-Agent-Rechte.

Ohne benannte Konten wurden keine produktiven Testgruppenrechte verändert. Der
Ablauf ist bereit; Durchführung mit realen Teilnehmerinnen gehört zu TASK-51/52.
