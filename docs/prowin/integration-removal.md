# Entfernte Integrationen

Die folgenden Migrationen laufen beim nächsten Serverstart. Vor einem Upgrade eine Datenbanksicherung erstellen; ein Code-Revert stellt gelöschte Verbindungsdaten nicht wieder her.

## Linear (TASK-3)

Linear-Verbindungen, OAuth-Zwischenstände, Installations-Tokens und Agent-Sessions werden entfernt. Bereits erzeugte Canvases und Frames bleiben erhalten. Externe App-Installationen werden nicht automatisch beim Anbieter deinstalliert.

Historische Migrationen und ursprüngliche Planungsdokumente bleiben zur Nachvollziehbarkeit erhalten.

## Slack (TASK-4)

Migration 0035 entfernt Slack-Installationen, Bot-Tokens, OAuth-Zwischenstände und Agent-Sessions. Canvases, Frames, allgemeine Webhooks und Workspaces bleiben erhalten. Die Slack-App muss bei Bedarf zusätzlich im Slack-Workspace deinstalliert werden.

## GitHub-App (TASK-5)

Migration 0036 löscht `github_connections` einschließlich gespeicherter Tokens und Installations-IDs. Bereits importierte Frames und Design-Memory bleiben erhalten. Offene Repository-Importaufträge werden abgeschlossen und aus der ausführbaren Kartenwarteschlange genommen; ihre Historie bleibt lesbar. Historische Kartentypen bleiben allein für diese gespeicherten Einträge erhalten. Externe GitHub-App-Installationen und PATs sind bei GitHub separat zu widerrufen.
