# Frame-CSP (TASK-27 / Q7)

## Policy

`src/lib/framePolicy.ts` setzt die CSP **vor** das gelieferte HTML. Das gilt für vollständige Dokumente und Fragmente. `FRAME_BOOTSTRAP` nutzt dieselbe Funktion wie Verlauf, Memory-Vorschauen und Zeichnungsverschiebung.

| Ressource                                           | Erlaubt                                          |
| --------------------------------------------------- | ------------------------------------------------ |
| Skripte                                             | Exakte HTTP(S)-Instanz-Origin und Inline-Skripte |
| Styles                                              | Exakte Instanz-Origin und Inline-Styles          |
| Bilder, Fonts, Medien                               | Exakte Instanz-Origin, `data:`, `blob:`          |
| Fetch/XHR                                           | Exakte Instanz-Origin; CORS gilt weiterhin       |
| Base-URL                                            | Exakte Instanz-Origin                            |
| Formulare, Unterframes, Worker, sonstige Ressourcen | Gesperrt                                         |

Keine Wildcard-Hosts, kein `unsafe-eval`, keine ausführbaren `data:`-/`blob:`-Dokumente. Die Instanz-Origin wird aus der URL des Elternfensters abgeleitet. `'self'` reicht nicht: Die Sandbox erzeugt eine opake Origin (`null`). Nicht-HTTP(S)-Instanzen werden abgewiesen.

## Sandbox und Editor

- Editor und Präsentation behalten `sandbox="allow-scripts"`, ohne `allow-same-origin`.
- Passive Vorschauen behalten `sandbox=""`; Skripte sind dort zusätzlich durch die Sandbox gesperrt.
- Die Policy gilt vor dem Bootstrap. Der Browser behält sie auch nach Entfernung des Meta-Tags durch das DOM-Morphing bei.
- Gespeicherte Designs werden nicht umgeschrieben. Beim normalen Rendern entfernt das Morphing die Bootstrap-Metadaten; Editor-Serialisierung und Nachrichten funktionieren unverändert.
- Lokale Bilder und Fonts müssen weiterhin vom Server mit passenden CORS-Headern ausgeliefert werden. Fremde Asset-URLs müssen vor Verwendung über einen freigegebenen Instanzpfad bereitgestellt werden; diese Aufgabe fügt keinen Proxy hinzu.

## Nachweise

```sh
bun run test tests/framePolicy.test.ts tests/frameCspBrowser.test.ts tests/frameRuntimeBody.test.ts tests/frameVisibilityBrowser.test.ts tests/prowinFontsBrowser.test.ts
bun run typecheck
bun run lint
bun run test --maxWorkers=2
```

Verifiziert am 28.10.2026: **15/15 gezielte Tests** und **1.397/1.397 Tests der Gesamtsuite (175 Dateien)** bestanden. Typecheck, Lint und Produktionsbuild bestanden; unabhängiges read-only Review ohne konkrete Fehler. Ein vorheriger Gesamtlauf hatte Browser-Testseiten während paralleler Dateiänderungen verloren; die Wiederholung ohne Änderungen war vollständig grün.

Die Chromium-Tests verwenden einen echten lokalen Fremdorigin-Server. Sie prüfen, dass **keine** der verbotenen Ressourcen dort ankommt, und erfassen CSP-Verletzungen:

- Fremde Bilder, Fonts, Styles, Skripte und Fetch vor/nach wiederholtem DOM-Morphing.
- Erfolgreiches Laden lokaler Bilder, Styles, Skripte und Fonts sowie `data:`-/`blob:`-Bilder und -Fonts.
- Bootstrap- und Editor-Nachrichten mit Origin `null`, Elementauswahl, Hit-Test, Style-Updates und Serialisierung.
- Fremde Base-URLs, Bild-Redirects, Unterframes, Worker und ausführbare `data:`-/`blob:`-Skripte.
- Passive Vorschauen aus Dokumenten und Fragmenten, geschützt vor der ersten Ressourcenanforderung.
- Bestehende Body-Styles, Sichtbarkeit und Font-Parität zwischen Browser und Export.

## Grenzen

- Dies ist eine **Ressourcen-CSP**, kein HTML-Sanitizer und keine vollständige Netzwerk-/Navigationsfirewall. Inline-Designskripte und Skripte der eigenen Instanz bleiben absichtlich erlaubt. Beispielsweise verhindert diese Meta-CSP keine Navigation des Frames zu einer anderen Seite.
- Der serverseitige Screenshot-/Export-Renderer behält seinen bestehenden Request-Guard; diese Änderung betrifft Browser-`srcDoc`-Frames.
- Automatischer Browser-Smoke-Test in Chromium; Firefox, WebKit, Desktop-Paket und manuelle UI-Abnahme sind nicht geprüft.
- Redirect-Tests decken Bilder ab; andere Ressourcentypen und die tatsächliche UI-Verdrahtung der Vorschauen wurden im Code-Review geprüft, nicht separat per UI-Test.
- Der Nutzer hat den Abschluss von TASK-27 am 28.10.2026 ausdrücklich freigegeben. Die genannten Testgrenzen bleiben bestehen.
