---
id: TASK-46
title: Resend-SMTP und datensparsame Transaktionsmails vorbereiten
status: To Do
assignee: []
created_date: '2026-10-23T09:53:00Z'
labels:
  - prowin
  - implementation
milestone: m-6
dependencies: []
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: medium
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Die vorhandene nodemailer-Anbindung reicht aus. Versandregion eu-west-1 bedeutet jedoch keine EU-Speicherung von Resend-Logs und Empfängeradressen.

Quellen: Umsetzung §§ 13, 13.1; Referenz R6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 SMTP über Port 587 und bei Bedarf 2587, Versand-Subdomain, SPF/DKIM/DMARC und EMAIL_FROM sind geprüft; Secrets stehen nur in der Deployment-Konfiguration.
- [ ] #2 E-Mail-Bestätigung, Passwort-Reset und Kommentarbenachrichtigung funktionieren; Kommentar-Mails enthalten nur einen Link statt Kommentar-/Design-Inhalten.
- [ ] #3 Resend-DPA, Drittlandgrundlage und Eintrag in der Datenschutzerklärung sind geprüft; ein gegebenenfalls erforderlicher EU-SMTP-Wechsel ist als Konfigurationswechsel dokumentiert.

<!-- AC:END -->
