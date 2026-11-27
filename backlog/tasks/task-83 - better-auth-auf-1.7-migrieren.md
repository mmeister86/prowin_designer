---
id: TASK-83
title: better-auth auf 1.7 migrieren
status: To Do
assignee: []
created_date: '2026-11-27T20:59:44Z'
updated_date: '2026-11-27T21:16:31Z'
labels:
  - security
  - dependencies
milestone: m-6
dependencies: []
priority: high
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Sicherheitsupdate vor M6 (Online). better-auth 1.6.x hat drei offene Advisories, die erst in 1.7 gepatcht sind und nicht auf die 1.6-Linie zurückportiert wurden: GHSA-965c-763c-88jm (kritisch, OAuth-State als Magic Link), GHSA-r4xp-prcw-77qf (hoch, OAuth Proxy), GHSA-q84f-53jg-9ppm (hoch, Device-Login-Freigabe). Nach Prüfung vom 27.11.2026 trifft keine davon die aktuelle Konfiguration (kein Magic Link, kein OAuth Proxy, kein Device Authorization; Plugins nur mcp, admin, oneTimeToken). Übergangsweise läuft 1.6.35 (gepflegte release-1.6-Linie, nur Bugfixes).

1.7 ist ein Migrationsprojekt (Upgrade-Guide docs/content/docs/guides/1-7-upgrade-guide.mdx im better-auth-Repo):
- MCP-Plugin zieht nach @better-auth/mcp auf Basis von @better-auth/oauth-provider; jwt() wird Pflicht; Optionen aus oidcConfig werden flach; ein kanonisches HTTPS-resource ist Pflicht.
- Client-Registrierung: mcp() erlaubt keine unauthentifizierte DCR mehr; vorgesehen ist cimd() (metadataProfile mcp-2026-07-28) oder bewusst beide DCR-Flags.
- Der Guide sieht den v2-Handler des MCP SDK vor (@modelcontextprotocol/server, createMcpHandler mit legacy reject, nur POST). Das betrifft den Transport in server/mcp.ts.
- Schema: oauth_application wird oauthClient (Daten manuell übertragen: redirectUrls -> redirectUris, metadata als JSON, Grant-Typen, Auth-Methode), neue Token-, Resource- und Consent-Spalten. Account-Schema bleibt ab 1.7.3 wie 1.6. Drizzle: Schema mit auth generate erzeugen, prüfen, als eigene Migration anwenden.
- OAuth-Endpunkte wandern von /mcp/* nach /oauth2/*; Discovery-Clients finden sie automatisch, bestehende Tokens und Registrierungen müssen geprüft oder neu verbunden werden.
- Betroffene Stellen: server/auth.ts (Plugin-Setup), server/index.ts (oAuthDiscoveryMetadata, .well-known-Routen, /api/mcp-consent mit oauthApplication), server/mcp.ts (getMcpSession, WWW-Authenticate), server/allowance.ts (oauthAccessToken), server/db/auth-schema.ts, src/pages/OAuthConsent.tsx, Claude-Extension, Codex- und Cursor-Anbindung.
- Proxy: hinter Coolify prüfen, ob Callback-, Issuer-, Discovery- und JWKS-URLs öffentlich korrekt erzeugt werden (trustedProxyHeaders, kanonischer Origin für Consent-Redirects).

Upstream doop ist noch auf 1.6.26. Die Migration verändert Upstream-eigene Dateien (auth.ts, index.ts, mcp.ts) stark und vergrößert künftige Merge-Konflikte; vor Beginn prüfen, ob Upstream inzwischen migriert hat.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Vor Beginn prüfen, ob Upstream doop better-auth 1.7 bereits übernommen hat; Ergebnis und gewählte Strategie (eigene Migration oder Upstream-Merge) in den Notes festhalten
- [ ] #2 Klären, ob Claude Desktop (Extension mit mcp-remote), Codex und Cursor CIMD unterstützen oder DCR brauchen; Registrierungsweg danach festlegen
- [ ] #3 better-auth und @better-auth/mcp auf eine 1.7-Version ab 1.7.7 heben; bun audit meldet keine better-auth-Advisories mehr
- [ ] #4 Drizzle-Migration für das 1.7-Schema erzeugen, prüfen und anwenden; bestehende oauth_application-Daten nach oauthClient übertragen oder bewusst verwerfen und dokumentieren
- [ ] #5 Login mit E-Mail/Passwort, Google, Apple (inkl. iOS nativ) und Desktop-Handoff (oneTimeToken) sowie Admin-Impersonation funktionieren
- [ ] #6 MCP: Discovery, Consent (/oauth/consent), Token, Refresh und eine geschützte Anfrage funktionieren für Claude-Extension, Codex und Cursor; tests/claudeExtension.test.ts grün
- [ ] #7 Verhalten für bereits verbundene Agents dokumentiert (automatisch weiter oder Neuverbindung nötig) und für Nutzer kommuniziert
- [ ] #8 bun run typecheck, lint, test (beide Gruppen) und build grün; TECHSTACK.md aktualisiert
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
27.11.2026: Übergangsweise better-auth 1.6.26 -> 1.6.35 (PR chore/deps-better-auth-1.6.35). Die 1.7-Advisories sind dort nicht zurückportiert. Weitere offene Major-Updates vor M6 (eigene Tasks bei Bedarf): sharp 0.34 -> 0.35 (libvips/libheif/librsvg), nodemailer 9 -> 10.0.6+ (relevant für TASK-46).

27.11.2026: Entscheidung Nutzer: TASK-83 ist kein Blocker für TASK-50 (M6-Freigabe); keine Abhängigkeit eintragen.
<!-- SECTION:NOTES:END -->
