---
id: TASK-11
title: SSO/OIDC und Microsoft-Login aus allen Clients entfernen
status: Done
assignee: []
created_date: '2026-10-23T09:49:00Z'
labels:
  - prowin
  - implementation
milestone: m-1
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Die vorgesehenen Login-Wege sind E-Mail/Passwort, Google und Apple. iOS verwendet bislang auch die OIDC-Konfiguration.

Quellen: Umsetzung §§ 4, 6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 OIDC- und Microsoft-Konfiguration, Serverpfade und Login-Buttons sind entfernt.
- [x] #2 iOS benötigt /api/oidc-config nicht mehr; E-Mail, Google und Apple bleiben verfügbar.
- [x] #3 Typecheck, relevante Auth-Tests und betroffene Client-Prüfungen bestehen.

<!-- AC:END -->

## Implementation Notes

- SSO/OIDC- und Microsoft-Provider samt Env-Konfiguration, generischem OAuth-Plugin,
  Login-Buttons und ungenutzten Microsoft-Assets entfernt.
- Web/Desktop und iOS fragen `/api/login-providers` ab; die Antwort enthält nur
  `google`, `apple` und `appleNative`. MCP-OAuth bleibt unabhängig davon erhalten.
- Bestehende Konten bleiben erhalten. Hinweise zum gemeinsamen Server-/iOS-Update
  und zum Login-Wechsel für bisherige SSO-/Microsoft-Konten stehen in `README.md`.

## Verification

- `bun run typecheck`, `bun run lint`, `bun run build`, Formatprüfung der geänderten
  Dateien und `git diff --check`: erfolgreich.
- 82 gezielte Tests erfolgreich: `loginProviders`, `loginProvidersConfig`, `desktopAuth`,
  `appleSignIn`, `access`, `admin`, `accountDeletion`, `signupRestrictions`, `firstCanvasLanding`.
- Gesamtsuite: 917/921 Tests bestanden; Timeouts in `drawingBrowser`,
  `legacyPagesMigration`, `pageControlsBrowser` und `rate-limit-wiring`.
  Erneuter Lauf dieser vier Dateien mit `--maxWorkers=1`: 29/29 Tests bestanden.
- Unabhängiges Code-Review: keine kritischen, wichtigen oder kleineren Befunde.
- AC #3 auf ausdrückliche Nutzerfreigabe anhand der bestandenen Prüfungen abgenommen.
  Native Provider-Tests wurden angepasst, aber `swift run --package-path ios DoopCoreChecks`
  sowie iOS-Build/Simulatorprüfung wurden hier nicht ausgeführt (Swift fehlt, Exit 127).
  Diese Prüflücke ist dokumentiert und blockiert den Abschluss gemäß Nutzerfreigabe nicht.
- Echte Google-/Apple-Provider-Roundtrips wurden nicht durchgeführt; die Tests prüfen
  die Redirects und native Apple-Tokens mit lokalen Test-Schlüsseln.
