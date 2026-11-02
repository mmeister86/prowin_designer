---
id: TASK-80
title: Nutze Preset-Maße für Agent-Platzierung
status: To Do
assignee: []
created_date: '2026-11-02T12:42:00Z'
labels: []
dependencies: []
priority: low
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CodeRabbit-Follow-up aus TASK-32: Resident createFrameInput verwendet bei preset-only Neuanlagen für placeBeside noch 800×500 statt der tatsächlichen Katalogmaße. actions.createFrame erzwingt bereits korrekt die kanonischen Maße; betroffen ist die Kollisionsprüfung der automatischen Platzierung neben einem Kommentar. Kein blockierender Befund zur Preset-Persistenz oder Resize-Sicherheit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Verwende bei gültigen Presets die Katalogmaße für placeBeside, ohne Legacy- und Quellkopie-Verhalten zu verändern.
- [ ] #2 Belege mit einem Regressionstest, dass A4- und Status-Preset-Neuanlagen neben einem Kommentar bestehende Frames nicht wegen der falschen Defaultgröße überlappen.
<!-- AC:END -->
