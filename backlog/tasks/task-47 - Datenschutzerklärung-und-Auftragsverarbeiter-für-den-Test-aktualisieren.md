---
id: TASK-47
title: Datenschutzerklärung und Auftragsverarbeiter für den Test aktualisieren
status: To Do
assignee: []
created_date: '2026-10-23T09:53:00Z'
labels:
  - prowin
  - implementation
milestone: m-6
dependencies:
  - TASK-21
  - TASK-38
  - TASK-46
documentation:
  - docs/prowin/doop-fork-umsetzung.md
  - docs/prowin/bezugsdokumente-referenz.md
priority: high
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Der Fork verändert die Datenflüsse durch HTML, Vision und Resend. Die bisherige Checkliste muss diese tatsächlichen Übermittlungen abbilden.

Quellen: Umsetzung §§ 7.6, 13.1; Referenz R4.6, R6
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Hetzner, Requesty, Magnific, eigene Rybbit-Instanz und Resend sind mit geprüften Rollen, Regionen und erforderlichen Verträgen erfasst.
- [ ] #2 Resend-US-Speicherung und der beschlossene Umgang mit Kontaktdaten/Screenshots sind zutreffend beschrieben; Stripe wird erst bei Aktivierung ergänzt.
- [ ] #3 Datensparsamkeit, Löschung, Speicherfristen, kein Training und Drittlandtransfers sind für die tatsächlich genutzten Dienste nachvollziehbar geprüft.

<!-- AC:END -->
