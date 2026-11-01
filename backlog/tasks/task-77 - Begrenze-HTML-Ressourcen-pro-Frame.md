---
id: TASK-77
title: Begrenze HTML-Ressourcen pro Frame
status: To Do
assignee: []
created_date: '2026-11-01T09:59:00Z'
updated_date: '2026-11-01T10:04:00Z'
labels: []
dependencies: []
priority: medium
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CodeRabbit-Follow-up aus PR #7: tiefe HTML-Baeume koennen den rekursiven Guard mit RangeError beenden; Append-Rohdaten haben bereits vor TASK-30 kein Gesamtbudget. Definiere zusammenhaengende Grenzen fuer Tiefe und kumulierte Entwurfsbytes, statt isolierte Sonderfall-Guards in TASK-30 nachzuruesten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Uebermaessige HTML-Tiefe wird kontrolliert ohne generischen 500-Fehler abgelehnt.
- [ ] #2 Ein kumulierter Append-Grenzwert wird vor Entwurfsaenderung geprueft; abgelehnte Chunks lassen Entwurf und gespeicherten Frame unveraendert.
- [ ] #3 Grenzwerte sind dokumentiert und mit normalen sowie ueberlangen Unicode-/HTML-Eingaben getestet.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quellen: PR #7 discussion_r4435135747 (Guard-Tiefe) und pullrequestreview-5727473553 Follow-up f340be59b6127d51b3fdb561 (Append-Gesamtgroesse). Verifiziert auf 5edd418: Node + tsx, 6000 verschachtelte div-Elemente, assertTemplateWrite wirft RangeError statt kontrollierter Validierungsantwort. Append-Rohdatenbudget fehlt auch am Merge-Base 1486f6c; keine neue Rollen-/Constraint-Umgehung.
<!-- SECTION:NOTES:END -->
