# Analytics nach TASK-13

PostHog ist aus Client, Server, Build und Abhängigkeiten entfernt. Der Client
sendet keine Analytics-Events; `server/analytics.ts` bietet die bestehenden
`capture`-/`captureThrottled`-Signaturen als bedingungslose No-ops an. Auch alte
Keys aktivieren keinen Versand. Der `/relay`-Proxy, Session-Replay einschließlich
Iframe-Recorder, automatische Erfassung von Fehlern/Web-Vitals und der
Conversations-Support-Chat sind entfernt.

## Grundlage für TASK-42 (Rybbit)

Die folgenden Tabellen dokumentieren die Aufrufstellen **vor der Entfernung**.
Sie sind ein Inventar, keine Freigabe zur erneuten Erfassung aller Eigenschaften.
Rybbit, dessen Instanz-Konfiguration und die endgültige Event-Zuordnung gehören
zu TASK-42. Identitäten, E-Mail-Adressen, Namen und Canvas-Inhalte werden nicht
automatisch übernommen.

### Client: Canvas, Frames und Agent-Aufträge

| Bisheriges Event             | Auslöser / Datei                                                                 | Bisherige Eigenschaften                              |
| ---------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `canvas_created`             | Canvas erfolgreich erstellt (`Home`, `DesktopTabs`)                              | `workspace` (nur Home)                               |
| `home_prompt_submitted`      | Auftrag auf neuem Canvas angelegt (`Home`)                                       | `drafts`, `workspace`                                |
| `canvas_duplicated`          | Canvas erfolgreich kopiert (`Home`)                                              | —                                                    |
| `canvas_deleted`             | Canvas erfolgreich gelöscht (`Home`)                                             | —                                                    |
| `canvas_moved`               | Canvas erfolgreich in/aus Workspace verschoben (`WorkspaceModals`, `ShareModal`) | `into`                                               |
| `canvas_link_shared`         | Canvas-Link in Zwischenablage kopiert (`ShareModal`)                             | —                                                    |
| `canvas_published`           | Bisher unveröffentlichten Canvas veröffentlicht (`ShareModal`)                   | —                                                    |
| `canvas_unpublished`         | Veröffentlichung aufgehoben (`ShareModal`)                                       | —                                                    |
| `community_viewed`           | Community-Seite eingeblendet (`Community`)                                       | —                                                    |
| `community_canvas_copied`    | Community-Vorlage erfolgreich kopiert (`Community`)                              | `source`, `category`                                 |
| `frame_created`              | Leeren Frame erfolgreich erstellt (`lib/framePlacement.ts`)                      | —                                                    |
| `frame_pasted`               | Mindestens einen Frame aus Zwischenablage erstellt (`lib/frameClipboard.ts`)     | `count`                                              |
| `image_pasted`               | Bilder hochgeladen und als Frames erstellt (`lib/frameClipboard.ts`)             | `count`                                              |
| `frame_duplicated`           | Frames dupliziert (`lib/frameClipboard.ts`) oder per Drag kopiert (`FrameView`)  | `count` bzw. `via: 'drag'`                           |
| `canvas_undo`, `canvas_redo` | Undo/Redo erfolgreich angewendet (`lib/history.ts`)                              | —                                                    |
| `prompt_bar_submitted`       | Auftrag erfolgreich angelegt (`PromptBar`)                                       | `attachments`, `scope: 'element' / 'frame' / 'none'` |
| `agent_task_queued`          | Board-Auftrag erfolgreich angelegt (`Board`)                                     | `pipeline_length`                                    |
| `canvas_comment_created`     | Canvas-Kommentar erfolgreich angelegt (`CanvasComments`)                         | —                                                    |
| `element_comment_created`    | Element-Kommentar erfolgreich angelegt (`FrameView`)                             | —                                                    |
| `element_comment_replied`    | Antwort erfolgreich angelegt (`CommentsPanel`, `CanvasComments`, `FrameView`)    | —                                                    |
| `element_comment_resolved`   | Thread erfolgreich erledigt (gleiche drei Komponenten)                           | —                                                    |

### Client: Konto, Verbindungen und Modelle

| Bisheriges Event                         | Auslöser / Datei                                                      | Bisherige Eigenschaften                 |
| ---------------------------------------- | --------------------------------------------------------------------- | --------------------------------------- |
| `login_no_account_found`                 | Anmeldung ohne vorhandenes Konto (`AuthPage`)                         | —                                       |
| `account_signed_up`                      | Registrierung erfolgreich, auch vor E-Mail-Verifizierung (`AuthPage`) | —                                       |
| `account_signed_in`                      | E-Mail-Anmeldung erfolgreich (`AuthPage`)                             | —                                       |
| `account_name_changed`                   | Namen erfolgreich gespeichert (`AccountSettings`)                     | —                                       |
| `account_password_changed`               | Passwort erfolgreich geändert (`AccountSettings`)                     | —                                       |
| `comment_emails_toggled`                 | Benachrichtigungseinstellung gespeichert (`AccountSettings`)          | `on`                                    |
| `agent_connection_opened`                | Verbindungsdialog geöffnet (`CanvasPage`)                             | —                                       |
| `connect_ai_agent_chosen`                | Agent ausgewählt und „Connect“ geklickt (`ConnectModal`)              | `agent`                                 |
| `claude_connector_opened`                | Link „Add to Claude“ geklickt (`ConnectModal`)                        | —                                       |
| `claude_extension_opened`                | Native Claude-Installation geöffnet (`ClaudeDesktopInstall`)          | —                                       |
| `codex_connection_configured`            | Native Codex-Konfiguration erfolgreich (`CodexInstall`)               | —                                       |
| `codex_desktop_setup_opened`             | Desktop-Setup-Link geklickt (`CodexInstall`)                          | —                                       |
| `agent_key_created`, `agent_key_revoked` | Agent-Key erfolgreich angelegt/widerrufen (`AgentKeys`)               | —                                       |
| `chatgpt_connect_started`                | Browser- oder Device-Flow gestartet (`ModelAccount`)                  | `flow: 'loopback' / 'device'`           |
| `chatgpt_connected`                      | ChatGPT-Konto erfolgreich aktiviert (`ModelAccount`)                  | —                                       |
| `model_account_connected`                | BYO-Key erfolgreich verbunden (`ModelAccount`)                        | `kind`                                  |
| `model_account_disconnected`             | Modellkonto erfolgreich getrennt (`ModelAccount`)                     | —                                       |
| `agent_model_changed`                    | Modell erfolgreich geändert (`ModelAccount`, `ModelPicker`)           | `model`, `via: 'composer'` (nur Picker) |
| `image_model_changed`                    | Bildmodell erfolgreich geändert (`ImageModelCard`)                    | `model`                                 |
| `resident_limit_hit`                     | Limit-/Einstiegsdialog eingeblendet (`TeamAllowance`)                 | —                                       |
| `resident_limit_connect_clicked`         | Aus Limitdialog zu Einstellungen gewechselt (`TeamAllowance`)         | —                                       |

Zusätzlich initialisierte der Client automatische Pageviews, Autocapture,
Fehlererfassung, Web-Vitals, Session-Replay und Conversations. Nach Anmeldung
wurde `identify(user.id, { email, name })` aufgerufen; beim Kontowechsel/Logout
`reset()`. Interne E-Mail-Domains und Admin-Impersonation schalteten Replay aus.
Desktop-Sessions registrierten Plattform und Shell-Version als Eigenschaften.
Diese Mechanismen sind entfernt und werden nicht als Rybbit-Anforderung übernommen.

### Client: Workspaces, Billing und Integrationen

| Bisheriges Event              | Auslöser / Datei                                           | Bisherige Eigenschaften            |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| `workspace_created`           | Workspace erfolgreich angelegt (`WorkspaceModals`)         | `active`                           |
| `workspace_member_invited`    | Mitglied hinzugefügt oder Einladung angelegt (`Workspace`) | `pending`                          |
| `workspace_deleted`           | Workspace erfolgreich gelöscht (`Workspace`)               | —                                  |
| `paywall_shown`               | Upgrade-Dialog eingeblendet (`WorkspaceModals`)            | `workspaceId`, `reason`            |
| `workspace_checkout_started`  | Checkout angefordert, vor API-Erfolg (`WorkspaceModals`)   | `workspaceId`, `interval`, `seats` |
| `workspace_plan_activated`    | Billing-Synchronisierung meldet aktiven Plan (`Workspace`) | `workspaceId`, `interval`          |
| `workspace_portal_opened`     | Billing-Portal angefordert, vor API-Erfolg (`Workspace`)   | —                                  |
| `integration_connect_started` | Meta-Verbindungs-URL erhalten (`Integrations`)             | `provider: 'meta'`                 |
| `integration_disconnected`    | Integration erfolgreich getrennt (`Integrations`)          | `provider`                         |
| `automation_created`          | Automation erfolgreich angelegt (`Automations`)            | `example`                          |
| `automation_deleted`          | Automation erfolgreich gelöscht (`Automations`)            | —                                  |
| `automation_saved`            | Automation erfolgreich gespeichert (`AutomationEditor`)    | `steps`                            |
| `automation_run_now`          | Manuellen Lauf gestartet (`AutomationEditor`)              | `status`                           |
| `webhook_created`             | Webhook erfolgreich angelegt (`Webhooks`)                  | `events`                           |
| `webhook_secret_rotated`      | Webhook-Secret erfolgreich rotiert (`Webhooks`)            | —                                  |
| `webhook_deleted`             | Webhook erfolgreich gelöscht (`Webhooks`)                  | —                                  |

### Server (`server/mcp.ts`, jetzt No-op)

| Bisheriges Event         | Auslöser                                                                           | Bisherige Eigenschaften                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `image_generated`        | Bildgenerierung und Asset-Speicherung erfolgreich                                  | `canvas_id`, `aspect`, `quality`, `billed_to`; Identität: Owner-ID oder Agent-Name |
| `custom_agent_connected` | Authentifizierte MCP-`initialize`-Nachricht                                        | `agent_client`, `agent_client_version`; Identität: User-ID                         |
| `custom_agent_used`      | Authentifizierte MCP-`tools/call`-Nachricht, zuvor einmal je User/Event/30 Minuten | `first_tool`; Identität: User-ID                                                   |

### Vorgesehene Produkt-Zuordnung (noch nicht implementiert)

Gemäß Umsetzung § 12.2:

- `design_requested`: bisherige Auftrags-Auslöser aus `Home`, `PromptBar`, `Board` zusammenführen.
- `template_used`: erfolgreicher Community-Fork (`community_canvas_copied`); ersetzt auch das ursprünglich geplante `template_forked`.
- `frame_generated`: eigener erfolgreicher Frame-Generierungsabschluss; `image_generated` bezeichnet ein Bild-Asset, nicht automatisch einen fertigen Frame.
- `element_edited`, `frame_exported`, `frame_shared`: dafür existierten in diesem Stand keine dedizierten PostHog-Aufrufe. Auslöser in TASK-42 ergänzen; `canvas_link_shared` ist kein Frame-Export.
- `template_published` und `upgrade_clicked`: spätere Marketplace-/Stripe-Zuordnung. Die vorhandenen Canvas-Publish-/Checkout-Auslöser sind Anhaltspunkte.

Die Komponenten oben liegen unter `src/components/`, die Seiten unter `src/pages/`.
Der Git-Stand vor `chore(prowin): remove posthog` enthält die ursprünglichen Aufrufe.
