# Android-Pipeline: Repository, Toolchain und Aufwand

## 1. Was ist tatsächlich vorhanden?

### Takeaway

**Android ist noch nicht vorbereitet. Desktop ist eine Tauri-WebView-Hülle; iOS ist eine eigenständige native SwiftUI-App.** Ein Android-Build der Website ist deshalb wesentlich kleiner als eine Portierung der iOS-App. Stand: 27.10.2026; ausschließlich statische Untersuchung, keine Installation oder Builds.

### Cited Findings

- **Web:** Paket `doop` 0.9.0, Bun 1.3.10, React/React DOM `^18.3.1`, Vite `^8.3.4`; Lockfile löst React auf 18.3.1 und Vite auf 8.3.4 auf. `build` baut die Claude-Extension und Vite, keinen Android-Client. — [package.json:2](/home/matthias/code/prowin_designer/package.json:2), [package.json:63](/home/matthias/code/prowin_designer/package.json:63), [bun.lock:1535](/home/matthias/code/prowin_designer/bun.lock:1535), [bun.lock:1755](/home/matthias/code/prowin_designer/bun.lock:1755)
- **Desktop:** Tauri 2, App-Version 0.6.0. CLI-Spezifikation `^2.9.0`, tatsächlich gelockt **2.11.4**; Rust `tauri = "2"`, tatsächlich **2.11.5**; `tauri-build` **2.6.3**. Rust Edition 2021. — [desktop/package.json:4](/home/matthias/code/prowin_designer/desktop/package.json:4), [desktop/bun.lock:13](/home/matthias/code/prowin_designer/desktop/bun.lock:13), [Cargo.toml:1](/home/matthias/code/prowin_designer/desktop/src-tauri/Cargo.toml:1), [Cargo.lock:3615](/home/matthias/code/prowin_designer/desktop/src-tauri/Cargo.lock:3615), [Cargo.lock:3666](/home/matthias/code/prowin_designer/desktop/src-tauri/Cargo.lock:3666)
- Desktop lädt **https://doop.design**, ohne eingebautes Web-Frontend. Konfiguration: Kennung `design.doop.desktop`, `frontendDist` als HTTPS-URL; Rust lädt `/auth`. Bundles ausschließlich `app`, `dmg`, `nsis`; Deep-Link-Konfiguration ausschließlich `desktop`. — [tauri.conf.json:5](/home/matthias/code/prowin_designer/desktop/src-tauri/tauri.conf.json:5), [tauri.conf.json:26](/home/matthias/code/prowin_designer/desktop/src-tauri/tauri.conf.json:26), [main.rs:262](/home/matthias/code/prowin_designer/desktop/src-tauri/src/main.rs:262), [desktop/README.md:3](/home/matthias/code/prowin_designer/desktop/README.md:3)
- **iOS:** SwiftUI/UIKit-Oberfläche plus Rust/Blitz-C-ABI; keine Tauri-App. Swift-Package-Tools 5.9, Xcode-Einstellung `SWIFT_VERSION = 5.0`; tatsächliches Deployment-Target **iOS 16.2**, README vereinfacht „16+“. App-Version 0.1.0, Bundle-ID `design.doop.ios`. — [ios/README.md:3](/home/matthias/code/prowin_designer/ios/README.md:3), [Package.swift:1](/home/matthias/code/prowin_designer/ios/Package.swift:1), [project.pbxproj:337](/home/matthias/code/prowin_designer/ios/Doop.xcodeproj/project.pbxproj:337), [project.pbxproj:398](/home/matthias/code/prowin_designer/ios/Doop.xcodeproj/project.pbxproj:398)
- Blitz ist auf Git-Commit **0f60502ea724ef703b34220b3847bb3483f70b5f** festgelegt, lokaler `blitz-paint`-Patch; Rust Edition 2024, `staticlib`/`rlib`, Skia standardmäßig aktiv. Das Build-Skript bedient nur `aarch64-apple-ios[-sim]`. — [BlitzKit/Cargo.toml:8](/home/matthias/code/prowin_designer/ios/BlitzKit/rust/Cargo.toml:8), [BlitzKit/Cargo.toml:33](/home/matthias/code/prowin_designer/ios/BlitzKit/rust/Cargo.toml:33), [build.sh:18](/home/matthias/code/prowin_designer/ios/BlitzKit/build.sh:18)
- **CI vorhanden:** Web-Checks auf Ubuntu; Desktop-Builds für macOS/Windows mit Artefakten, Release über `desktop-v*`; iOS-Simulator-Build sowie signierter Archive-/TestFlight-Workflow über `ios-v*`. Das sind konfigurierte Abläufe, keine in dieser Recherche nachgewiesenen grünen Runs. — [ci.yml:13](/home/matthias/code/prowin_designer/.github/workflows/ci.yml:13), [desktop.yml:36](/home/matthias/code/prowin_designer/.github/workflows/desktop.yml:36), [desktop-release.yml:16](/home/matthias/code/prowin_designer/.github/workflows/desktop-release.yml:16), [ios.yml:15](/home/matthias/code/prowin_designer/.github/workflows/ios.yml:15), [ios-release.yml:68](/home/matthias/code/prowin_designer/.github/workflows/ios-release.yml:68)
- **Negativbefund:** Im untersuchten Dateibaum fehlen `android/`, `desktop/src-tauri/gen/android`, Gradle-Dateien, AndroidManifest, Android-Workflow und `desktop/src-tauri/src/lib.rs`. Manifest hat keinen `[lib]`-Abschnitt; Einstieg ist `fn main()`. Wichtig: `desktop/src-tauri/gen` wird bereits komplett ignoriert; aus fehlenden getrackten Dateien allein wäre kein lokaler Android-Stand ableitbar, hier wurde zusätzlich die Existenz geprüft. — [Cargo.toml:1](/home/matthias/code/prowin_designer/desktop/src-tauri/Cargo.toml:1), [main.rs:209](/home/matthias/code/prowin_designer/desktop/src-tauri/src/main.rs:209), [.gitignore:5](/home/matthias/code/prowin_designer/.gitignore:5)

### Inferences

- **Wiederverwendung:** Website und gehostetes Backend sind der naheliegende kurze Weg; SwiftUI und UIKit werden durch Hinzufügen eines Android-CI-Jobs nicht portiert. Backend-Verträge und gegebenenfalls Rust-Rendering wären bei einer nativen Neuentwicklung wiederverwendbare Ansatzpunkte, kein belegter fertiger Android-Unterbau.

### Gaps

- Keine Builds, CI-Historie, GitHub-Secrets oder Play-Console-Konten geprüft. Diese Recherche beurteilt keine vollständige Plugin-/Feature-Kompatibilität.

## 2. Welche minimalen Ergänzungen braucht ein Android-Build?

### Takeaway

**Ein kleiner mobiler Tauri-Einstieg plus Android-Projekt und ein eigener Linux-CI-Job** ist die pragmatische Variante. Signierte APKs reichen als technisches Artefakt für erste Kolleginnen-Tests; Google-Play-Veröffentlichung ist ein zusätzlicher Schritt.

### Cited Findings

- Tauri lädt mobile Apps als Bibliothek: `src/lib.rs`, gemeinsames `run()` mit `#[cfg_attr(mobile, tauri::mobile_entry_point)]`, Desktop-`main.rs` ruft dieses auf. **Das fehlt hier**; Bibliotheksziel und plattformgerechter Einstieg müssen zuerst angelegt oder in einer separaten dünnen Android-Hülle bereitgestellt werden. — [Tauri-Projektstruktur](https://v2.tauri.app/start/project-structure/), [Repo main.rs:209](/home/matthias/code/prowin_designer/desktop/src-tauri/src/main.rs:209)
- Android benötigt **JDK**, SDK-Plattform, Platform-Tools, Build-Tools, Command-Line-Tools und **NDK**; Variablen `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`. Rust-Ziele laut Dokumentation: `aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android`. Für einen ARM64-Prototyp genügt eine gezielte Architektur. — [Tauri-Voraussetzungen](https://v2.tauri.app/start/prerequisites/)
- **Version passend zur vorhandenen CLI geprüft:** Offizielle Vorlagen im Tag `tauri-cli-v2.11.4` verwenden **AGP 8.11.0**, **Kotlin-Plugin 1.9.25**, **Gradle 8.14.3**, `compileSdk/targetSdk = 36`. Diese Werte sind Vorlagenwerte eines künftig initialisierten Projekts, **keine bereits vorhandene Repo-Konfiguration**. — [Root-Gradle-Vorlage](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-cli/templates/mobile/android/build.gradle.kts), [Wrapper-Vorlage](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-cli/templates/mobile/android/gradle/wrapper/gradle-wrapper.properties), [App-Vorlage](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-cli/templates/mobile/android/app/build.gradle.kts)
- Tauri-Befehle: `bun run tauri android init`; anschließend etwa `bun run tauri android build --debug --apk --target aarch64 --ci`. Für Release `--debug` weglassen; `--aab` für Bundle, `--apk` für APK. Plattform-Override `tauri.android.conf.json` ist unterstützt. **Nur dokumentiert, nicht ausgeführt.** — [CLI android init/build](https://v2.tauri.app/reference/cli/)
- APK ist für Tests/Verteilung außerhalb des Stores geeignet; AAB für Play. Standardmäßig alle Architekturen. Dokumentierter AAB-Pfad: `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`; APKs im entsprechenden `outputs/apk/`-Baum nach tatsächlichem Variantennamen einsammeln. `versionCode` lässt sich explizit konfigurieren. — [Tauri Google Play](https://v2.tauri.app/distribute/google-play/)
- Android-Release-Signierung verwendet **Java-Keystore und Gradle-signingConfig**. Offizielles CI-Beispiel: `ANDROID_KEY_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`; Keystore in temporäre Datei dekodieren, `gen/android/keystore.properties` erzeugen, Release-Konfiguration in `gen/android/app/build.gradle.kts` anbinden. — [Tauri Android Code Signing](https://v2.tauri.app/distribute/sign/android/)
- Alle installierbaren APKs müssen signiert sein; Debug wird mit Debug-Zertifikat signiert. Play App Signing trennt Upload-Key und eigentlichen App-Signing-Key. Für direkte APK-Updates muss die Signaturidentität erhalten bleiben. — [Android-Signierung](https://developer.android.com/studio/publish/app-signing)
- SDK-Pakete können ohne Android-Studio-GUI eingerichtet werden; offizielle Dokumentation empfiehlt feste Paketversionen für Skripte. Aktueller Hinweis: `sdkmanager` wird zugunsten von `android sdk` als veraltet bezeichnet. — [Android SDK-Verwaltung](https://developer.android.com/tools/sdkmanager)

### Inferences

- **Minimaler geplanter CI-Ablauf:** Checkout → festgelegte Bun-/Rust-/JDK-Versionen → Android SDK 36, feste Build-Tools-/NDK-Version → ARM64-Rust-Ziel → eingefrorene Abhängigkeiten → Android-Build → APK/AAB als Workflow-Artefakt hochladen. JDK 17 ist ein sinnvoller zu validierender Ausgangspunkt für diese AGP-8-Vorlage; die konkrete NDK-Version nach Initialisierung festlegen. Für reines Kompilieren ist kein laufender Emulator nötig; Funktionstests brauchen Gerät/Emulator.
- **Projektdateien reproduzierbar halten:** wegen aktuellem Ignore entweder Android-Projekt gezielt versionieren oder Initialisierung und alle Änderungen deterministisch aus festgelegter CLI erzeugen. Bei Signierung/Manifest-Anpassungen ist Versionierung praktikabler. Keystore/Passwörter bleiben Secrets.
- Vorhandene Artefakt-Uploads, Tag-/Dispatch-Muster und Cargo-Caches lassen sich übernehmen. `setup-desktop` richtet bisher nur Bun, Rust und Desktop-Abhängigkeiten ein; es ersetzt kein Android-Setup. — [setup-desktop/action.yml:16](/home/matthias/code/prowin_designer/.github/actions/setup-desktop/action.yml:16)
- „Reproduzierbar“ hier bedeutet wiederholbar aus festgelegten Tools/Quellen; **keine nachgewiesene Bitidentität**. Bei der gehosteten Website ist außerdem nur die native Hülle versioniert, nicht die später ausgelieferte Web-Oberfläche. — [desktop/README.md:3](/home/matthias/code/prowin_designer/desktop/README.md:3)

### Gaps

- Noch keine konkrete Android-ID, NDK-Version, Icons, Secret-Belegung oder Gradle-Variante im Repo. Kein getesteter Buildbefehl. Store-Policy, Kontoeinrichtung und automatische Play-Veröffentlichung sind nicht Bestandteil der Artefakt-Schätzung.

## 3. Wie groß ist der Aufwand – und was blockiert wirklich?

### Takeaway

**Schätzung: 1–2 Arbeitstage bis zum ersten ARM64-Debug-APK mit gehosteter Web-App; insgesamt 2–4 Arbeitstage bis zum signierten, wiederholbaren CI-Artefakt.** Das setzt erfahrene Umsetzung und keine größeren Web-/Plugin-Anpassungen voraus. Keine Aussage über native iOS-Funktionsparität.

### Cited Findings

- **Struktureller Blocker:** mobiler Bibliothekseinstieg fehlt; nur `android init` plus Workflow reicht nicht. — [Repo Cargo.toml:1](/home/matthias/code/prowin_designer/desktop/src-tauri/Cargo.toml:1), [Tauri-Projektstruktur](https://v2.tauri.app/start/project-structure/)
- **Desktop-spezifischer Shell-Code ist vorhanden:** unbedingte Registrierung des Single-Instance-Plugins, native Dateidialoge, CLI-/Desktop-Kommandos und eigener Window-Aufbau. Für den Minimalbuild muss das mobil abgegrenzt oder durch eine kleine neue Hülle umgangen werden. Einzelne API-Kompatibilität ist hier bewusst nicht bewertet. — [main.rs:213](/home/matthias/code/prowin_designer/desktop/src-tauri/src/main.rs:213), [main.rs:298](/home/matthias/code/prowin_designer/desktop/src-tauri/src/main.rs:298), [Cargo.toml:10](/home/matthias/code/prowin_designer/desktop/src-tauri/Cargo.toml:10)
- **Debug-URL-Falle:** Rust setzt bei `debug_assertions` fest `http://localhost:4300`; die Tauri-devUrl ist ebenfalls localhost. Ein kompiliertes Debug-APK muss zum erreichbaren Entwicklungsserver oder explizit zum gehosteten HTTPS-Origin geleitet werden. `--debug` allein erzeugt noch keinen nutzbaren Cloud-Client. — [main.rs:73](/home/matthias/code/prowin_designer/desktop/src-tauri/src/main.rs:73), [tauri.conf.json:6](/home/matthias/code/prowin_designer/desktop/src-tauri/tauri.conf.json:6)
- **Vorhandener Nutzen:** iOS und Desktop verwenden bereits Backend und Browser-Login-Handoff; iOS hat dafür eigenen Swift-Code. Das unterstützt Wiederverwendung der Serverprotokolle, beweist aber keinen fertigen Android-Login. — [ios/README.md:78](/home/matthias/code/prowin_designer/ios/README.md:78)

### Inferences

- **Debug-Prototyp, 1–2 Tage:** mobile Einstiegshülle, Desktop-Abgrenzung, Android-Initialisierung, Toolchain, richtige URL und ein Starttest auf Gerät. Schätzung kann bei bereits eingerichtetem Android-System sinken, bei nativen Abhängigkeiten steigen.
- **Signierte CI, insgesamt 2–4 Tage:** zusätzlich festgelegte Toolchain/Generierung, Keystore/Secrets, Release-Konfiguration, Versionierung, Artefakt-Upload, Signaturprüfung und wiederholter sauberer CI-Lauf. Nicht zusätzlich 2–4 Tage zum Debug-Prototyp.
- **Native Android-App auf iOS-Niveau:** eigenständiger Entwicklungsumfang in Wochen oder mehr, kein bloßes Pipeline-Ticket; belastbare Aufwandsschätzung erst nach Funktionsumfang und Rendering-Entscheidung. SwiftUI/UIKit müssen neu umgesetzt oder durch eine andere Oberfläche ersetzt werden. Rust-C-ABI allein stellt keine Android-UI bereit.
- Für Kolleginnen zuerst **begrenzten Web-Hüllen-Prototyp auf echten Android-Geräten** prüfen; Signierung/Pipeline danach produktionsfähig machen. Feature-Parität, Mobile-UX und Deep-Link-/Export-Kompatibilität sind zusätzliche Abnahmekriterien und nicht durch einen erfolgreichen APK-Build erledigt.

### Gaps

- Aufwand sind **technische Schätzungen**, keine Messwerte. Keine Abnahme auf Android; keine Zusage zu Login, Export, Tastatur/Gesten oder Rendering. Kontext7 erfolgreich über bereits vorhandene CLI (`npx --no-install ctx7@latest library Tauri …`, danach `docs /tauri-apps/tauri-docs …`); offizielle Seiten und zur gelockten CLI passende Quellvorlagen zusätzlich gelesen. Keine Code-, Konfigurations- oder Backlog-Dateien verändert; nur diese Notiz geschrieben.
