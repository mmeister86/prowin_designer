# Vollständige deutsche App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die gesamte eigene Endnutzeroberfläche für Web, Desktop und iOS konsistent deutsch bereitstellen, ohne technische Verträge oder bestehende Nutzerinhalte zu verändern.

**Architecture:** Deutsch direkt in den vorhandenen Textdefinitionen und UI-Standards hinterlegen. Bestehende Zeit-/Preishelfer anpassen, stabile Auth-Fehlercodes an der Anzeigegrenze deutsch auflösen. Keine neue Abhängigkeit, kein Sprachumschalter und kein allgemeines Übersetzungsframework.

**Tech Stack:** Bestehendes TypeScript/React/Express, Vitest mit Browserprüfungen, Tauri/Rust und SwiftUI.

**Spec:** `docs/superpowers/specs/2026-10-25-german-app-design.md`

## Global Constraints

- Deutsch ist die feste App-Sprache, mit freundlicher Du-Ansprache.
- Glossar: Canvas → Arbeitsfläche, Frame → Zeichenfläche, Workspace → Arbeitsbereich, Layer → Ebene, Owner → Eigentümer, Member → Mitglied, Memory → Designwissen, Task → Aufgabe, Agent → Agent, AI → KI. Creator bleibt der eingeführte Rollenname.
- IDs, Rollenwerte, JSON-Schlüssel, Fehlermaschinencodes, URLs, Routen, CSS-Werte, Tastaturkürzel, Header und Modell-IDs bleiben unverändert.
- Keine bestehenden Nutzerinhalte nachträglich übersetzen oder umbenennen. USD bleibt USD; keine Preise, Rechte oder Feature-Flags ändern.
- Optionale deaktivierte Oberflächen mitübersetzen, aber nicht aktivieren. Keine neue Abhängigkeit und kein neues Mehrsprachen-Framework.
- Abnahme ausschließlich über Backlog-CLI pflegen; TASK-68 und Untertasks bleiben bis zur ausdrücklichen Nutzerabnahme offen.

## Review Focus

- Signup-Fehler werden als Text im Redirect transportiert: bestehende Erkennung und erlaubte Domainhinweise dürfen nicht verloren gehen; TASK-68.3 testet bekannte, unbekannte und eingeschränkte Anmeldung.
- Übersetzte Namen dürfen keine technischen Werte ändern: TASK-68.2 testet Zeichenwerkzeug-ID, Objektname und unveränderten Nutzernamen getrennt.
- Deutsche Dezimalkommas dürfen keine CSS-/Zahleneingaben oder Währungen verändern: TASK-68.3 testet Anzeige und unveränderten Eingabewert/Preis separat.
- Längere deutsche Texte müssen in schmalen Dialogen erreichbar bleiben: TASK-68.6 prüft mobile Dialoge, Schließen/Abbrechen und Tastaturbedienung.
- Native Bundles und Bildressourcen sind eigene Auslieferungsflächen: TASK-68.4/5 prüfen Sprachdeklaration, Activity-Zuordnung und aktualisierte DMG-PNG, nicht nur Quelltexte.

## Ausführung und Dateiverantwortung

Vor Implementierung Planfreigabe einholen und `using-git-worktrees` zur Isolationsentscheidung verwenden. Erst danach Implementierungsagenten einsetzen. Keine Commits oder PRs ohne passenden Auftrag erzeugen.

TASK-68.3 zuerst für gemeinsame Definitionen/Fehlererkennung beginnen. Danach können klar getrennte Web-, Editor- und native Bereiche parallel bearbeitet werden. Bestehende Tests mit mehreren Besitzern erst bei der Integration gemeinsam aktualisieren; Tests nicht blind per globaler Textersetzung verändern.

### Task 1: TASK-68.1 — Web-Seiten, Navigation und UI-Standards

**Files:** `src/App.tsx`, `src/pages/**`, `src/prowin/CreatorRegistration.tsx`, `src/integrations/**`, `index.html`, `claude-extension/manifest.json`, `src/components/ui/**` sowie `AccountSettings`, `AgentExecutionPanel`, `AgentKeys`, `AppearanceSettings`, `AppRail`, `AutomateShell`, `CanvasSearchModal`, `ClaudeDesktopInstall`, `CodexInstall`, `ConnectModal`, `CursorInstall`, `DashShell`, `DesktopTabs`, `HomeHero`, `ImageModelCard`, `LocalClaude`, `Onboarding`, `ShareModal`, `TeamAllowance`, `ThemePicker`, `Webhooks`, `WorkspaceModals` in `src/components/`.

**Tests:** `tests/confirmDialogs.test.tsx`, `tests/connectModal.test.tsx`, `tests/homeHero.test.tsx`, `tests/optionalNavigation.test.tsx`, `tests/prowinCreatorUi.test.tsx`, betroffene Auth-/Agenten-UI-Tests; neue `tests/germanUi.test.tsx`.

**Interfaces:** Vorhandene Props, Routen und Select-Werte unverändert. Gemeinsame Rollen-/Statusanzeigen aus TASK-68.3 konsumieren; UI-Standardtexte `Confirm`/`Cancel`/`Close` werden `Bestätigen`/`Abbrechen`/`Schließen`.

- [ ] Einen zunächst fehlschlagenden UI-Test für deutsche Anmeldeüberschrift, Abbrechen/Schließen und unveränderte Select-Werte ergänzen; deutsche Aufrufstellen mit den vorhandenen Test-Helfern prüfen.
- [ ] Test gezielt ausführen, den erwarteten Textfehler bestätigen und erst dann eigene Nutzertexte übersetzen; keine Eigennamen oder Befehle ersetzen.
- [ ] Optionale Seiten, Admin, mobile Varianten, KI-Hinweis und Accessibility ausdrücklich abgleichen; das neue `lang="de"` und deutsche Metadaten testen.
- [ ] `bun run test -- tests/germanUi.test.tsx tests/confirmDialogs.test.tsx tests/connectModal.test.tsx tests/homeHero.test.tsx tests/optionalNavigation.test.tsx tests/prowinCreatorUi.test.tsx` ausführen; auch weitere durch Textänderungen betroffene Tests aktualisieren, ohne Verhaltensprüfungen zu entfernen.

### Task 2: TASK-68.2 — Editor, Zusammenarbeit und Clientmeldungen

**Files:** Alle übrigen eigenen `src/components/**` außerhalb TASK-68.1; `src/lib/**` außer `api.ts`, `auth.ts` und `time.ts` (TASK-68.3). Besonders `tools.ts`, `drawing.ts`, `pages.ts`, `homePrompt.ts`, `frameClipboard.ts`, `frameExport.ts`, `pathEditing.ts`, `elementResize.ts`, `desktop.ts` sowie Inspector, Ebenen, Kommentare, Board, Memory und Export.

**Tests:** `tests/tools.test.ts`, `tests/homePrompt.test.ts`, `tests/drawing.test.ts`, `tests/frameClipboard.test.ts`, `tests/frameExport.test.ts`, `tests/elementLink.test.tsx`, `tests/frameExportModal.test.tsx`, `tests/commentsPanel.test.tsx` und betroffene Editor-Browsertests.

**Interfaces:** IDs wie `select`, `rectangle`, `frame` unverändert. Nur Anzeigenamen und neue app-eigene Standardinhalte deutsch; bestehenden Objekt-/Frame-/Dokumentnamen nie eine Übersetzungsfunktion überstülpen.

- [ ] Regressionen für `TOOLS` mit `id: 'rectangle'` und `label: 'Rechteck'`, deutsche Namen neu erzeugter Objekte und unveränderte vom Nutzer gesetzte Namen zunächst rot nachweisen.
- [ ] Texte einschließlich Toasts, aria-label, Tooltips, Menüs, leere Zustände, Standardnamen, Vorlagen und Beispielprompts direkt übersetzen; Leserichtungen, Grammatik und Singular/Plural kontrollieren.
- [ ] Betroffene Tests mit ihren konkreten Dateien ausführen und auf Grün bringen; Schnittstellen-/Persistenzassertionen unverändert lassen.
- [ ] `bun run test -- tests/tools.test.ts tests/homePrompt.test.ts tests/drawing.test.ts tests/frameClipboard.test.ts tests/frameExport.test.ts tests/elementLink.test.tsx tests/frameExportModal.test.tsx tests/commentsPanel.test.tsx` sowie relevante Editor-Browsertests ausführen.

### Task 3: TASK-68.3 — Server, gemeinsame Definitionen, Fehler und Formate

**Files:** Eigene nutzersichtbare Texte in `server/**`, insbesondere `auth.ts`, `workspaces.ts`, `commentNotifications.ts`, `demo.ts`, `index.ts`, `notifications.ts`, `access.ts`, `admin.ts`, `liveActivities.ts`; Anzeige-/Vorlagentexte in `shared/**`; `src/lib/api.ts`, `src/lib/auth.ts`, `src/lib/time.ts`. In `server/guide.ts` und `server/resident.ts` die Standard-Ausgabesprache neuer Agentenantworten und feste menschliche Status-/Fehlermeldungen übersetzen, nicht technische Tool-/Prompt-Schemas. Planpräzisierung gemäß Spec: Auch feste Resident-Statusmeldungen sind eigene Nutzertexte.

**Tests:** `tests/commentNotifications.test.ts`, `tests/signupRestrictions.test.ts`, `tests/loginProviders.test.ts`, `tests/workspaces.test.ts`, `tests/billing.test.ts`, `tests/automations.test.ts` und betroffene API-Tests. Neu `tests/germanFormatting.test.ts` und `tests/germanErrors.test.ts`.

**Interfaces:** `timeAgo(ts: number): string`, `formatUsd(cents: number): string`, `errorMessage(err: unknown, fallback: string): string` behalten Signaturen. Auth-Fehler anhand vorhandener Codes auswerten; nur bei mehrfacher Verwendung einen kleinen gemeinsamen Helfer ergänzen. Rollen-/Statuswerte bleiben unverändert, vorhandene Label-Maps werden deutsch. Kein Laufzeitwörterbuch, das nachträglich beliebigen Nutzertext übersetzt.

- [ ] Fehler-/Formatierungstests zunächst rot nachweisen: `timeAgo` an 0/5/60/3600/86400 Sekunden, deutsche Dezimalanzeige von 1650 USD-Cent mit unverändertem Betrag, gültige Mail-Links und unveränderter zitierter Nutzerkommentar, Signup-Domainhinweis und deutscher Ersatz für unbekannten Auth-Fehler.
- [ ] Alle ausgewerteten Fehlertexte vor Änderung über Aufrufstellen und Tests verfolgen; stabile Codes und Signup-Redirect-Erkennung erhalten. Menschliche Servertexte und E-Mails deutsch formulieren, fremde Fehlermeldungen nicht blind durchreichen.
- [ ] Bestehende Formatierer für Nutzeranzeigen auf deutsche Locale umstellen. Technische Datumsteile für Scheduler, CSS-Zahlen und numerische Eingaben nicht lokalisieren. Gespeicherte Demo-/Nutzerdaten nicht migrieren.
- [ ] `bun run test -- tests/germanFormatting.test.ts tests/germanErrors.test.ts tests/commentNotifications.test.ts tests/signupRestrictions.test.ts tests/loginProviders.test.ts tests/workspaces.test.ts tests/billing.test.ts tests/automations.test.ts` und betroffene API-/Live-Activity-Tests ausführen.

### Task 4: TASK-68.4 — Native Desktop-App und Installer

**Files:** `desktop/src-tauri/src/**`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/dmg/background.html`, `desktop/src-tauri/dmg/background.png` und tatsächlich verwendete native Installer-Ressourcen.

**Tests:** Vorhandene Rust-Tests; ergänzende statische Ressourcenassertionen in `tests/germanNativeResources.test.ts` werden mit TASK-68.5 abgestimmt und bei TASK-68.6 integriert.

**Interfaces:** Tauri-Kommandonamen, Deep Links, App-ID und Serveradresse unverändert. Nur eigene Beschriftungen und Handlungsanweisungen ändern; vom Betriebssystem gelieferte Texte nicht durch Eigenbau ersetzen.

- [ ] Vor Änderung prüfen, welche native Sprache/Installer-Konfiguration und welcher PNG-Erzeugungsweg tatsächlich genutzt werden; zunächst fehlschlagende Ressourcenassertionen für deutsche Menü-/Dialogtexte und DMG-Vorlage vorbereiten.
- [ ] Native Nutzertexte übersetzen und Windows-Installer auf Deutsch konfigurieren, soweit vom bestehenden Installer unterstützt. DMG-PNG aus der übersetzten Vorlage neu erzeugen und visuell kontrollieren.
- [ ] `cargo fmt --manifest-path desktop/src-tauri/Cargo.toml --check` und vorhandene ausführbare native Prüfungen ausführen; nicht verfügbare Rust-/GTK-/Apple-Buildumgebung konkret dokumentieren.
- [ ] Ohne macOS keinen erfolgreichen DMG-Build oder Installation behaupten; bestehende Remote-URL als Deployment-Grenze dokumentieren.

### Task 5: TASK-68.5 — iOS und Live Activities

**Files:** `ios/Doop/**`, `ios/DoopActivity/**`, `ios/Shared/**`, `ios/Doop.xcodeproj/project.pbxproj`; nur erforderliche eigene Sprachressourcen hinzufügen. Drittanbieter-Renderer in `ios/BlitzKit/**` nicht übersetzen.

**Tests:** Bestehende `ios/Tests/**` und `ios/ConnectionTests/**`; statische Bundle-/Sprachassertionen in `tests/germanNativeResources.test.ts` gemeinsam mit TASK-68.4/6 integrieren.

**Interfaces:** API-/Socket-Werte, gespeicherte Namen, Phasenwerte und App-IDs unverändert. Deutsch als App-Sprache deklarieren; native Zahlenanzeigen deutsch, technische API-Zahlen unverändert.

- [ ] Fehler und Ressourcenpfade vor Änderungen verfolgen; statisch zunächst englische Löschdialoge, VoiceOver-Labels und fehlende deutsche Bundle-Deklaration nachweisen.
- [ ] Eigene UI-/Fehlertexte und neue Standardnamen in App und Activity übersetzen; deutsche Locale und Ressourcen pro Ziel prüfen. Nicht ungeprüft `.localizedDescription` als deutsche Meldung ansehen.
- [ ] Auf einer verfügbaren Apple-Umgebung Kernprüfungen und Simulator-Build ausführen; ohne macOS nur belegbare Struktur-/Ressourcenprüfungen durchführen und die native Abnahme offen lassen.
- [ ] Kontolöschung, Verbindungsabbruch, schmale Anzeigen, VoiceOver und Live Activities in die manuelle Abnahmeliste aufnehmen.

### Task 6: TASK-68.6 — Integration, unabhängiges Review und Abnahme

**Files:** Betroffene `tests/**`, neue `tests/germanNativeResources.test.ts`, `docs/prowin/deutsche-uebersetzung.md`, dieser Plan; Backlog ausschließlich per CLI.

**Interfaces:** Alle vorherigen Änderungen zusammenführen. Kein neues allgemeines Übersetzungssystem oder globaler String-Replacer zur Beseitigung von Review-Befunden.

- [ ] Neue statische Ressourcenchecks gemeinsam integrieren und zuerst ihr Rot anhand des Basisstands beziehungsweise gezielter unveränderter Ressourcentexte belegen; danach mit den nativen Änderungen Grün prüfen.
- [ ] Eigene ausgelieferte Quelltexte systematisch auf englische Nutzerausgaben durchsuchen. Ausnahmen begründen; keine Kennzahl als vollständige Sprachabdeckung ausgeben.
- [ ] Vollständige Prüfungen: `bun run typecheck`, `bun run test`, `bun run lint`, `bun run format:check`, `bun run build`, `git diff --check`. Fehler ursächlich beheben oder konkrete externe Blocker nennen; keine Tests für die Übersetzung abschwächen.
- [ ] Unabhängigen Review auf Glossar, Resttexte, dynamische Fehler, unveränderte technische Verträge, Nutzerinhalte und Zahlen anfordern; Befunde prüfen und betroffene Checks wiederholen.
- [ ] Soweit Browserumgebung erreichbar: Login, Startseite, Editor, Freigabe, Einstellungen, Löschen/Abbrechen und schmale Dialoge prüfen; nicht ausgeführte OAuth-/SMTP-/Stripe-/Apple-Flows explizit offen lassen.
- [ ] Prüfprotokoll und verbleibende manuelle Schritte dokumentieren; Backlog-AC nur mit Nachweisen abhaken. Den Nutzer ausdrücklich um manuelle Abnahme bitten, erst danach Status `Done` setzen.
