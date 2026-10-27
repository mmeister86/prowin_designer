# Android-Vertrieb und Release-Pipeline

## 1. Was ist im Repo tatsächlich vorhanden?

### Takeaway

**Android-Vertrieb wäre ein neuer Release-Weg; eine lauffähige Android-App ist dessen Voraussetzung.** Desktop ist eine Web-Hülle, iOS eine eigene native App. Eine neue CI-Datei allein portiert diese App nicht.

### Cited Findings

- Root: Bun und Vite-Build; React/Express-Abhängigkeiten. Desktop: Tauri CLI 2.x und Rust/Tauri 2; `frontendDist` zeigt auf die gehostete Website. [package.json:6](/home/matthias/code/prowin_designer/package.json:6), [desktop/package.json:5](/home/matthias/code/prowin_designer/desktop/package.json:5), [Cargo.toml:7](/home/matthias/code/prowin_designer/desktop/src-tauri/Cargo.toml:7), [tauri.conf.json:6](/home/matthias/code/prowin_designer/desktop/src-tauri/tauri.conf.json:6).
- Desktop-Updates der Website benötigen laut README keinen neuen Installer; Shell-Änderungen schon. Bestehende Distribution: macOS-DMG/Windows-NSIS als GitHub Release bei `desktop-v*`, manuell als CI-Artefakte. [desktop/README.md:3](/home/matthias/code/prowin_designer/desktop/README.md:3), [desktop/README.md:151](/home/matthias/code/prowin_designer/desktop/README.md:151).
- iOS ist SwiftUI mit nativem Canvas und eingebettetem Rust/Blitz-Renderer, ausdrücklich keine Website-Hülle. Signierter Release-Workflow bei `ios-v*`/manuellem Start, Upload zu App Store Connect. README nennt noch ausstehende manuelle Store-Arbeit und sagt „No build has been submitted or published“: vorhandene Pipeline ist kein Veröffentlichungsnachweis. [ios/README.md:3](/home/matthias/code/prowin_designer/ios/README.md:3), [ios/README.md:239](/home/matthias/code/prowin_designer/ios/README.md:239), [ios/README.md:259](/home/matthias/code/prowin_designer/ios/README.md:259), [ios-release.yml:1](/home/matthias/code/prowin_designer/.github/workflows/ios-release.yml:1).

### Inferences

- Die vorhandenen Tag-/Artefakt-/Signing-Muster sind organisatorisch wiederverwendbar. Ob Tauri-Hülle oder native Android-App sinnvoll ist, muss die andere Architektur-Recherche klären; hier wurde kein Featurecode untersucht.
- Eine begrenzte Dateinamensuche nach Gradle, AndroidManifest und Android-Dateien fand keine Android-Buildkonfiguration. Das ist eine Suchbeobachtung, kein vollständiger Kompatibilitätsnachweis.

### Gaps

- Keine Builds oder Installationen ausgeführt; tatsächliche Release-Nutzung und vorhandene Google-Konten unbekannt. Keine Code-, Konfigurations- oder Backlog-Änderungen.
- Dokumentation am **27.10.2026** abgerufen. Context7 zunächst wegen fehlendem `npx` im PATH gescheitert; danach vorhandenes `ctx7` mit bestehender Node-Installation verwendet, ohne Installation. `library Android …` → `/websites/developer_android`, anschließend `docs` mit derselben vollständigen Frage. Ergebnis bestätigte Signing, war beim Verifikations-Rollout aber gröber als die direkt gelesenen offiziellen Quellen; für genaue Termine gelten die unten genannten Originalseiten.

## 2. APK direkt oder Google Play für die Kolleginnen?

### Takeaway

**Ein signiertes APK eignet sich für einen kurzen Pilot mit wenigen betreuten Geräten. Play Internal Testing ist für eine kleine, nichttechnische Testgruppe meist bequemer**, weil Installation und spätere Binärupdates über den vertrauten Store laufen. Ein öffentlicher Store-Launch ist dafür zunächst unnötig.

### Cited Findings

- **Direktes APK:** Android erlaubt Verteilung über eigene Website/Server oder E-Mail. Nutzerinnen müssen Installationen aus dieser Quelle erlauben; seit Android 8 geschieht das pro Quelle, etwa Browser. APKs können weitergegeben werden: ein privater Download ersetzt keine Anmeldung/Zugriffskontrolle. Seite zuletzt aktualisiert **26.02.2026**. [Alternative distribution](https://developer.android.com/distribute/marketing-tools/alternative-distribution).
- **Signing:** Jedes installierbare APK muss signiert sein. Für Updates muss die Signatur kompatibel bleiben; deshalb Release-Keystore sicher sichern. Bei Play werden AABs mit dem Upload-Key signiert, Google signiert daraus erzeugte APKs mit dem App-Signing-Key. Ein verlorener Upload-Key kann bei Play ersetzt werden. Für einen späteren Wechsel zwischen Direkt-APK und Play die Schlüsselstrategie vor dem ersten Release planen. Seite zuletzt aktualisiert **06.03.2026**. [Sign your app](https://developer.android.com/studio/publish/app-signing).
- **AAB:** Neue Play-Apps müssen seit August 2021 als Android App Bundle veröffentlicht werden. AAB ist das Uploadformat; Play erzeugt daraus gerätespezifische APKs. Eine AAB-Datei ist somit nicht die Installationsdatei zum Verschicken. [App Bundles](https://developer.android.com/guide/app-bundle).
- **Play-Konto:** einmalig **25 US-Dollar**, Identitätsprüfung; persönliche Konten müssen zusätzlich Zugriff auf ein Android-Gerät über die Play-Console-App verifizieren. Keine jährliche Kontogebühr in dieser Quelle. [Play Console starten](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en).
- **Internal Testing:** bis **100 Tester pro App**, Google-/Workspace-Konto, Freigabe per E-Mail-Liste und Opt-in-Link; noch vor vollständigem App-Setup möglich. Bereitstellung meist in Minuten, erste Links/Änderungen können Stunden benötigen; temporäre Store-Angaben bis 48 Stunden. Interne Tests sind von der Data-Safety-Darstellung ausgenommen und können ohne reguläre Policy-/Security-Review auskommen — keine garantierte Reviewfreiheit. **Closed:** gezielt freigegebene größere Gruppe, vollständiges Setup. **Open:** öffentlich sichtbarer Test, jeder kann teilnehmen. [Testkanäle](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).
- **Neue persönliche Konten nach 13.11.2023:** vor Production-Zugang ein Closed Test mit mindestens **12 über 14 aufeinanderfolgende Tage angemeldeten Testern**, anschließend Antrag. Google beurteilt auch Testengagement; Review des Production-Zugangs meist höchstens sieben Tage, gegebenenfalls länger/weitere Tests. Open Testing wird erst nach Production-Zugang verfügbar. Diese Schwelle gilt **nicht** als Voraussetzung für Internal Testing; Organisationskonten fallen nicht unter diese spezielle Neukontenregel. [Testing-Anforderungen](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
- Wartung: Für neue reguläre Smartphone-Apps/Updates verlangt Play seit **31.08.2026 Android 16 / target API 36**; `targetSdk` ist nicht die Mindestversion des Nutzergeräts. Anforderungen künftig erneut prüfen. [Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-UM).

### Inferences

- **Installationsfriktion:** Direkt-APK bedeutet Download, Freigabe unbekannter Quelle, Installation; ohne zusätzliches Update-System jede neue Binärversion erneut verteilen und bestätigen lassen. Gerätespezifische Schutzdialoge/verwaltete Firmenhandys können Betreuung erfordern. Play benötigt einmalig die richtige Google-Konto-Adresse und Testbeitritt; danach normale Store-Updates, abhängig von Auto-Update-Einstellungen.
- **Empfehlung:** Pilot auf wenigen Geräten gegebenenfalls APK; bei wiederholter Nutzung durch Kolleginnen einen internen Play-Test evaluieren. Das ist ein Testkanal, keine pauschale Empfehlung für dauerhaften kommerziellen Betrieb darin. Bei größerer Zielgruppe Closed bzw. regulären Release planen. Store-Verfügbarkeit schützt die Serverdaten nicht; dafür bleibt App-Authentifizierung zuständig.
- **Schätzung ausschließlich Release-Technik, bei bereits funktionierender Android-App:** signierter APK-CI-Job samt Secrets, Versionsnummern, Artefakt/Download und Installationsanleitung **1–2 Entwicklertage**; Play-AAB/Signing/interner Kanal **zusätzlich 1–3 Tage**, zunächst mit manuellem Upload möglich. Store-Metadaten/Datenschutzerklärungen/Testzugang für Closed/Public **weitere 1–3 Tage**. Keine Portierung, Android-Funktionsfehler oder umfangreiche Geräte-QA enthalten; dies sind Planungswerte, keine gemessenen Repo-Zeiten.
- **Kalenderzeit getrennt:** Direkt-APK keine Play-Freigabewartezeit. Internal abhängig von Konto-/Identitätsprüfung und Verarbeitung, kein garantierter Sofortstart. Bei betroffenem persönlichem Neukonto mindestens 14 Tage Closed Test ab vollständiger Testergruppe plus Production-Zugangsprüfung; Rekrutierung und eventuelle weitere App-Reviews kommen hinzu.
- **Laufende Kosten/Arbeit:** Keine aus den Quellen ersichtliche jährliche Android-Vertriebsgebühr; eigene CI-/Hostingkontingente und bestehender Backendbetrieb separat. Keystore-/Secretpflege, SDK-/Abhängigkeitsupdates, Geräte-/WebView-QA, Release- und Installationssupport bleiben. Kleine stabile Hülle als grober Planungsansatz einige Stunden pro Monat plus größere Plattformupdates; native Funktionsparität wäre gesondert zu schätzen.

### Gaps

- Anzahl/Geräte/Konten der Kolleginnen, Privat- oder Firmenhandys, kommerzieller Einsatz und bestehendes Play-Konto unbekannt. Daher keine garantierten Kalender- oder Betriebskosten; Zahlungssysteme/Play-Billing nicht untersucht.

## 3. Was bedeutet Developer Verification im Oktober 2026 für Deutschland?

### Takeaway

**Kein universeller „Android-Sideloading-Stopp ab September 2026“.** Deutschland/EU gehören nicht zur genannten ersten Ländergruppe; für 2027 ist eine globale Ausweitung angekündigt, ohne in den geprüften Quellen einen festen Deutschland-/EU-Tag zu nennen.

### Cited Findings

- Offizieller Guide: Start **30.09.2026 in Brasilien, Indonesien, Singapur und Thailand**, zunächst Installationen aus benannten teilnehmenden Stores; globale Ausweitung 2027. Verifikation verbindet Entwickleridentität, Paketname und Signing-Key. Play-Entwickler nutzen Play Console; exklusiv außerhalb Play die Android Developer Console. [Verifikationsguide](https://developer.android.com/developer-verification/guides).
- FAQ präzisiert ausdrücklich: **direktes Sideloading und andere nicht teilnehmende Stores werden in der September-2026-Phase noch nicht erfasst**. Der spätere Rollout betrifft zertifizierte Android-Geräte ab Android 7 über Play services. Full-Distribution-ADC-Gebühr **25 US-Dollar**, Limited kostenlos. Bestehende Play-Konten können auch externe Apps verwalten; keine pauschale zweite Kontoanforderung. [Offizielle FAQ](https://developer.android.com/developer-verification/guides/faq).
- **Limited Distribution:** laut Erstnotizen kostenlos, maximal **20 ausdrücklich autorisierte Geräte**, Freigabe per Link/QR und Zustimmung. Kein amtlicher ID-Nachweis, aber Google-Konto mit 2FA und Payments-Profil für Name/Adresse. Beispiele richten sich an Hobby/Lernen/persönliche, nichtkommerzielle Projekte. Nicht als geprüften Vertriebsweg für dieses berufliche Produkt empfehlen; aktuellen Status vor Nutzung erneut prüfen. [Limited Distribution](https://developer.android.com/developer-verification/guides/limited-distribution).
- Registrierung außerhalb Play verlangt Paketname und SHA-256-Signing-Zertifikat; bei bestehenden Paketnamen APK mit Eigentumsnachweis. [Android Developer Console](https://developer.android.com/developer-verification/guides/android-developer-console).

### Inferences

- Für einen deutschen APK-Pilot im Oktober 2026 ist diese neue regionale Frist kein akuter Blocker. Trotzdem Paketname/Signing stabil festlegen und die globale Ausweitung bei langfristiger Direktverteilung einplanen.
- Die Limited-Seite formuliert die erste Phase breiter als Guide/FAQ. Für den tatsächlich erfassten Installationsweg sind Guide und die ausdrückliche Sideloading-FAQ präziser; die allgemeinere Formulierung ist kein Beleg für einen universellen Stichtag.
- Später verfügbare „Advanced flow“-Ausnahmen für unregistrierte Apps sind für nichttechnische Kolleginnen keine gute Standard-Vertriebsstrategie; registrierte Verteilung reduziert Zusatzfriktion. [Verifikationsguide](https://developer.android.com/developer-verification/guides).

### Gaps

- **Kein konkretes Deutschland-/EU-Datum für 2027 belegt.** Vor dem tatsächlichen Release erneut prüfen; die Quellen sind rollierende Dokumentation, keine Garantie für unveränderte Regeln. Google-Help-Seiten ohne sichtbares Publikationsdatum wurden am 27.10.2026 abgerufen.
- **Council-Korrektur:** Die ursprünglich notierten Änderungsdaten einzelner Verifikationsseiten waren bei unabhängigen Abrufen nicht reproduzierbar und wurden entfernt. Lizenzpflichten/AGPL-Quellcodezugang vor Android-Verteilung separat prüfen; Q3 zu iOS ist keine automatische Play-Freigabe. Kontotyp und mögliche Organisationsnachweise bleiben offen.
