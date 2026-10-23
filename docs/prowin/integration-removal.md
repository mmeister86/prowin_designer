# Entfernte Integrationen

Die folgenden Migrationen laufen beim nächsten Serverstart. Vor einem Upgrade eine Datenbanksicherung erstellen; ein Code-Revert stellt gelöschte Verbindungsdaten nicht wieder her.

## Linear (TASK-3)

Linear-Verbindungen, OAuth-Zwischenstände, Installations-Tokens und Agent-Sessions werden entfernt. Bereits erzeugte Canvases und Frames bleiben erhalten. Externe App-Installationen werden nicht automatisch beim Anbieter deinstalliert.

Historische Migrationen und ursprüngliche Planungsdokumente bleiben zur Nachvollziehbarkeit erhalten.
