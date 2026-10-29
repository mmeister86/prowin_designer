---
id: TASK-74
title: LumiosBrush-Lizenz klären und Platzhalter ersetzen
status: To Do
assignee: []
created_date: '2026-10-28T13:08:00Z'
labels: []
dependencies: []
priority: medium
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Die Brush-Rolle trägt seit TASK-25 übergangsweise Kaushan Script (SIL OFL 1.1), weil LumiosBrush-Regular kommerziell ist und die Foundry-EULA SaaS- und Authoring-Nutzung ausschließt. Dieses Task klärt die Lizenz und ersetzt den Platzhalter durch die echte Markenschrift.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Custom- oder OEM-Lizenz für LumiosBrush-Regular bei The Type Founders angefragt und schriftlich beantwortet
- [ ] #2 Bei Freigabe: LumiosBrush-Regular als WOFF2 mit Lizenzdatei unter /fonts ausgeliefert und im kanonischen Frame-Block ergänzt
- [ ] #3 Bei Freigabe: Kaushan-Script-Faces und -Assets entfernt, betroffene Frames auf die echte Familiennamen umgestellt
- [ ] #4 Bei Ablehnung: Entscheidung dokumentiert und die Brush-Rolle dauerhaft einer freien Schrift zugeordnet
<!-- AC:END -->
