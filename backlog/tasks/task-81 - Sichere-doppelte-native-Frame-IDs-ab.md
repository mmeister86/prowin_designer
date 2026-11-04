---
id: TASK-81
title: Sichere doppelte native Frame-IDs ab
status: To Do
assignee: []
created_date: '2026-11-04T10:21:00Z'
labels: []
dependencies: []
priority: low
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Council TASK-35 Round2 (Opus/Muse Wonder) nennt einen nicht blockierenden Robustheitsfall: keepingNewerFrameRevisions erstellt Dictionary(uniqueKeysWithValues:), das bei doppelten IDs in einem eingehenden nativen Zustand abbricht. Der Server liefert derzeit eindeutige IDs; kein nachgewiesener Produktionsfehler und bewusst außerhalb von TASK-35. Bei erneuter Berührung eine verträgliche Duplicate-Policy prüfen, ohne neue Synchronisationsarchitektur.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Die native Revisionszusammenführung bricht bei doppelten IDs nicht ab und hat eine dokumentierte deterministische Auswahlregel.
- [ ] #2 Vorhandene Regeln für ältere/gleiche/unbekannte Revisionen, eingehende Mitgliedschaft und Canvas-Isolation bleiben unverändert und sind durch Swift-Core-Checks abgedeckt.
<!-- AC:END -->
