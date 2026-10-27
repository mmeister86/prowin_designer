---
id: TASK-72
title: Prüfe Android-Pilot nach allen Milestones
status: To Do
assignee: []
created_date: '2026-10-27T12:51:00Z'
labels:
  - prowin
  - android
  - post-milestones
  - decision
dependencies:
  - TASK-53
  - TASK-54
  - TASK-55
  - TASK-56
  - TASK-57
  - TASK-58
  - TASK-59
  - TASK-60
  - TASK-61
  - TASK-62
  - TASK-63
  - TASK-64
  - TASK-65
documentation:
  - reports/Android Pipeline im bestehenden Repo.md
  - research_notes/Android Pipeline im bestehenden Repo/repo.md
  - research_notes/Android Pipeline im bestehenden Repo/compatibility.md
  - research_notes/Android Pipeline im bestehenden Repo/distribution.md
priority: low
type: spike
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Ziel und Einordnung
- Sichere die Council-geprüften Android-Findings und entscheide später, ob die Android-nutzenden Kolleginnen eine eigene App benötigen oder der Browser genügt.
- Erst nach Abschluss ALLER aktuell geplanten Milestones bearbeiten, einschließlich des letzten Milestones m-8 (M7 — Nach dem Test). Keinem bestehenden Milestone zuordnen.
- Die Abhängigkeiten umfassen alle 13 Tasks des letzten Milestones und transitiv sämtliche aktuell noch offenen Tasks früherer Milestones. Bei neuen Milestones oder Tasks die Sperre vor Arbeitsbeginn aktualisieren.
- Dieser Task startet keine Android-Implementierung und gibt keine Store-Veröffentlichung frei.

## Gesicherte Findings — Stand 27.10.2026
- Desktop ist eine Tauri-Web-Hülle; iOS eine separate SwiftUI/UIKit-App mit Rust-/Blitz-Renderer. Eine Android-Pipeline portiert die native iOS-App nicht automatisch.
- Android-Projekt, Gradle-Konfiguration, mobiler Rust-Bibliothekseinstieg und Android-CI fehlen im untersuchten Repo-Stand. Eine dünne Tauri-Hülle um die eigene proWIN-Web-App erscheint realistisch.
- doop.design ist nur der Upstream-Standardwert, kein Deployment-Nachweis dieses Forks. Eigene erreichbare HTTPS-Instanz, richtige DOOP_APP_URL und passende Remote-Origin-Freigabe sind Voraussetzung; keine proWIN-Testdaten ungeprüft an Upstream senden. Debug-URL und localhost separat berücksichtigen.
- Mobile Web-Ansichten und Touch-Gesten existieren, sind aber kein Nachweis einer fertigen Android-App oder PWA. Den tatsächlichen Beraterinnen-Flow aus TASK-55 und Datei-Teilen aus TASK-35 bewerten, nicht bloß den Creator-Editor.
- Anpassungspunkte: desktopgebundene Cargo-Abhängigkeiten UND Aufrufpfade (single-instance/rfd), lokale CLI-Kommandos, falsche Android-/macOS-Erkennung, Mobile-Capabilities und Zeitpunkt der Marker-Injektion. Bei gemeinsamem Desktop-Crate Regressionen auf macOS/Windows prüfen.
- Kritische Gerätetests: PNG/JPG-Blob-Download und Weitergeben, Anmeldung/Session, Tastatur/Zurück-Geste, Lifecycle/Netzwechsel, Touch und große Boards. E-Mail/Passwort ist ein möglicher kleiner Pilotumfang; Social-Login benötigt zusätzlich einen geprüften mobilen Rückweg.
- Play Internal Testing ist ein möglicher Pilotkanal für bis zu 100 Testpersonen; Entwicklerkonto laut damaliger Dokumentation einmalig 25 USD. Die 12-Tester-/14-Tage-Regel betrifft den Production-Zugang bestimmter persönlicher Neukonten, nicht Internal Testing. Kontotyp, Verifikation und aktuelle Regeln vor Nutzung neu prüfen.
- AGPL-/Quellcodepflichten und Android-Verteilungsweg separat klären. Die iOS-Frage Q3 bedeutet weder automatisch Android-Verbot noch Play-Freigabe.

## Aufwand und Grenzen
- Grobe, nicht gemessene Größenordnung: 5–14 Personentage beziehungsweise 1–3 Engineering-Wochen für eine begrenzte, gerätegeprüfte Android-Web-Hülle inklusive internem Play-Pilot bei ausreichend fertiger eigener Web-App.
- 2–4 PT bis zum signierten CI-Artefakt sind ein optimistischer Teilfall, keine zusätzliche oder belastbare Zusage. Überschneidungen der Schätzungen nicht doppelt addieren.
- Deployment, offene Produktfunktionen, Lizenzklärung, Konto-/Store-Wartezeit, native iOS-Parität und Offline-Betrieb sind nicht enthalten.
- Kleinster späterer Einstieg: 0,5–1 PT Browser-Test an eigener Instanz auf zwei Android-Geräten; bei verbleibendem Bedarf 1–2 PT Android-Spike für Build, Login und Export, danach neu schätzen.
- Bisher ausschließlich statische Recherche und Dokumentationsprüfung: keine Builds, Gerätetests, Live-Instanz oder Play-Konten geprüft.

## Council-Prüfung
- Zwei vollständige Runden, alle drei akzeptieren den korrigierten Bericht als Entscheidungsgrundlage, nicht als Termin- oder Lauffähigkeitszusage.
- Claude Opus 5.5: 6,5/10 → 8/10; GPT-6.1 Sol: 8/10 → 9/10; Muse Wonder 1.0: 7/10 → 8/10. Bewertet wurde Recherchequalität.
- Maßgeblich ist der korrigierte Hauptbericht; einzelne Erstnotizen nicht isoliert als Zusage verwenden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prüfe vor Arbeitsbeginn den Abschluss aller dann bestehenden Milestones und aktualisiere bei Roadmapänderungen die Abhängigkeiten.
- [ ] #2 Validiere die Findings am aktuellen Repo- und Regelstand sowie den relevanten Beraterinnen-Ablauf mit Login, Export und Weitergabe auf zwei Android-Geräten an der eigenen proWIN-Instanz.
- [ ] #3 Dokumentiere die Entscheidung Browser genügt, Android-Spike oder Zurückstellung; schätze nach einem etwaigen Spike neu und lege nur bei ausdrücklicher Freigabe separate Implementierungstasks an.
- [ ] #4 Kläre vor einer geplanten externen Verteilung Lizenzpflichten, Kontotyp, Signierung und Pilotkanal; versprich weder native iOS-Parität noch Offline-Funktion ohne eigene Prüfung.
<!-- AC:END -->
