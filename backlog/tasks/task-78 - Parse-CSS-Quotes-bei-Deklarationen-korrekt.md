---
id: TASK-78
title: Parse CSS-Quotes bei Deklarationen korrekt
status: To Do
assignee: []
created_date: '2026-11-01T09:59:00Z'
updated_date: '2026-11-01T10:04:00Z'
labels: []
dependencies: []
priority: low
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CodeRabbit-Kompatibilitaetshinweis aus PR #7: der bewusst restriktive Inline-Style-Parser trennt auch Semikolons in zitierten Fontnamen wie A;B. Das ist fail-closed und betrifft keine freigegebene proWIN-Schrift. Bei Bedarf Quote-/Klammer-Semantik gezielt erweitern, ohne doppelte Properties oder !important-Umgehungen freizugeben.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Semikolons in korrekt zitierten Werten verhindern zulaessige Typografie-Edits nicht.
- [ ] #2 Unvollstaendige Quotes und doppelte CSS-Properties bleiben sicher abgelehnt; Token-Farbgrenzen und Legacy-Resaves bleiben erhalten.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quelle: PR #7 discussion_r4435135755. Reproduktion auf 5edd418: bestehendes style font-family:"A;B";font-size:20px, Aenderung nur font-size auf24px ->403. Unveraenderte Legacy-Styles bleiben speicherbar; keine Token-/Lock-Umgehung. Im aktuellen TASK-30 PR bewusst nicht zur allgemeinen CSS-Parsing-Kompatibilitaet erweitert.
<!-- SECTION:NOTES:END -->
