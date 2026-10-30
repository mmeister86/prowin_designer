# TASK-28 — Offizielle Produkt- und Partywerbung

Recherche: **Dana Scully**, Stand **29.10.2026**. Drei kuratierte Hauptreferenzen; keine eigenen Layouts. Neu abgerufene öffentliche Originalquellen, keine lokale Alt-Recherche. PDFs und zwei Original-JPEGs wurden über die Dateiansicht **als Bilder visuell betrachtet**, nicht nur als Text ausgewertet. Originaldownloads ausschließlich unter `/tmp/opencode/task28-dana/`; keine Broschüren oder Personenbilder ins Repository übernommen.

## Welche offiziellen Seiten verlinken echte Werbe-PDFs oder Bildmotive?

### Takeaway

**I-DROP und YOURDAY besitzen belegte offizielle PDF-Linkketten.** Für die Party ist ein offizielles Bild-plus-CTA-Modul belegt, aber kein fertiger Einladungsvordruck.

### Cited Findings

- **1 — I-DROP:** Die deutsche [Produkt-Landingpage](https://prowin.net/de/i-drop) verlinkt mit „Jetzt Angebot nutzen“ unmittelbar den [einseitigen Originalflyer](https://prowin-hub.net/files/public/public.php?file=doc/1/de/printmedien/flyer/iDROP.pdf). Der PDF-Abruf lieferte HTTP 200 und `application/pdf`; lokal `idrop.pdf`. Die Seite enthält außerdem „Jetzt Vorführungstermin vereinbaren“ als Beratungsbrücke. — [Quelle](https://prowin.net/de/i-drop)
- **2 — YOURDAY:** Die offizielle [Aktionsübersicht](https://prowin.net/de/unsere-produkte/aktionen) verlinkt im YOURDAY-Slider direkt die [zwölfseitige Produktbroschüre](https://prowin-hub.net/files/public/public.php?file=doc/1/de/printmedien/flyer/yourday.pdf). HTTP 200 und `application/pdf`; lokal `yourday.pdf`. **Korrekte Herkunftskette: Aktionsübersicht → Hub-PDF**, nicht die nur ergänzend geprüfte [new-wellness-Kategorie](https://prowin.net/de/produkte/area/new-wellness). Die [YOURDAY-Kategorie](https://prowin.net/de/produkte/area/new-wellness/cat/yourday) bestätigt die Produktfamilie. Hauptmagazine und Saisonflyer wurden nicht untersucht. — [Offizieller PDF-Linkgeber](https://prowin.net/de/unsere-produkte/aktionen)
- **3 — Party/Einladung:** `/de/prowin-party` führt auf [„proWIN Party feiern“](https://prowin.net/de/prowin-party/prowin-party-feiern). Dort stehen das Modul „Werden Sie proWIN Partygastgeber“, sein [Original-JPEG](https://prowin.net/files/prowin-data/img/teaserboxen/party/prowin-partygastgeber-werden.jpg) und der CTA [„Partygastgeber werden“](https://prowin.net/de/prowin-party/gastgeber). Die Zielseite führt über „Suche starten“ zur Beratungssuche. JPEG: HTTP 200, lokal `party-gastgeber.jpg`. — [Quelle des Werbemoduls](https://prowin.net/de/prowin-party/prowin-party-feiern)

### Inferences

- Diese drei Fälle liefern unterschiedliche, bereits existierende Kommunikationsaufgaben: **System verkaufen → Produkt erklären → zur persönlichen Begegnung führen**. Die Auswahl ist eine kuratorische Bewertung, kein offizielles proWIN-Designsystem.

### Gaps

- Auf den geprüften Party-/Gastgeberseiten und in der gezielten offiziellen Websuche fand sich **kein öffentlicher druckfertiger Einladungsflyer**. Das Website-Modul ausdrücklich nicht als solchen ausgeben.

## Welche drei konkreten Motive eignen sich als Referenzen?

### Takeaway

Empfohlen: **I-DROP, PDF-Seite 1; YOURDAY Female Meno Moment!, PDF-Seite 6; offizieller Partygastgeber-Teaser.** Die beschriebenen Kompositionen sind selbst visuell beobachtet.

### Cited Findings

- **1 — Technische Produktbühne: „HELLO I-DROP / READY TO DROP.“** **PDF-Seite 1 von 1.** Hochformat mit dunkler, fast schwarzer Studiobühne und türkisfarbenem Lichtschein. Großes Eimer-/Mopp-Ensemble; der Stiel läuft diagonal ins Bild, die runde weiße Flächenfaser dominiert vorn, daneben die ALLESKÖNNER-Flasche. Oben türkisfarbener Titelblock; darunter ein weißer Infoblock mit Setbestandteilen links und sechs grauen Nutzenbalken rechts. Türkisfarbener Fuß mit großem „Systempreis 179,- €“ und weißem Markenlogo. **Relevanz:** Produktgröße, Materialnähe und klare Trennung von Hero, Nutzen und Preis — keine bloße Freistellerliste. — [Original, Seite 1](https://prowin-hub.net/files/public/public.php?file=doc/1/de/printmedien/flyer/iDROP.pdf#page=1)
- **2 — Wellness-Produktinfo: „Female Meno Moment!“** **PDF-Seite 6 von 12**, gedruckte Seitenzahl 6. Oben links fliederfarbene Textfläche mit weißer Serifenschrift, gelben Nutzenzeilen, Dosierungsicon und Produkt-QR; oben rechts Lifestylefoto einer Frau mit passendem Beutel. Unten links der fliederfarbene Packshot mit botanischen Zutaten und handschriftlichen Beschriftungen auf dunklerem Violett; unten rechts eine großformatige Wurzelaufnahme mit gelben Zielgruppenlabels. Kleine Pflicht-/Verzehrhinweise am Fuß. **Relevanz:** Ein Produkt wird über Farbcode, Lebensphase, Anwendung und Zutaten erklärt; gute Alternative zur reinen Angebotskarte. Die gesundheitsbezogenen Aussagen sind Herstellerwerbung, hier nicht medizinisch überprüft. — [Original, Seite 6](https://prowin-hub.net/files/public/public.php?file=doc/1/de/printmedien/flyer/yourday.pdf#page=6)
- **3 — Einladung/Beratungsbrücke: „Werden Sie proWIN Partygastgeber“.** **Website-Teasermodul**, kein PDF. Das separat betrachtete JPEG hat **600 × 300 Pixel**: mehrere lachende Erwachsene an einem Holztisch in heller Loft-/Küchenumgebung, weiße Pflegebehälter und Anwendungsgeste im Vordergrund. Das Foto enthält selbst keine Einladungstypografie; Überschrift, Prämienargument und CTA sind im ausgelesenen Seiteninhalt belegt, nicht im JPEG. Das Gesamtseitenlayout wurde nicht visuell geprüft. **Relevanz:** Geselligkeit und Produkterlebnis statt Gerätehero; nachvollziehbare Strecke vom Anlass zur Gastgeberinformation und Beratung. Nicht als Vorlage mit Termin-/Adressfeldern beschreiben. — [Originalbild](https://prowin.net/files/prowin-data/img/teaserboxen/party/prowin-partygastgeber-werden.jpg), [Modulkontext](https://prowin.net/de/prowin-party/prowin-party-feiern), [Beratungsbrücke](https://prowin.net/de/prowin-party/gastgeber)

### Inferences

- Die Referenzen ergänzen sich: **dunkel/türkis und sachlich-technisch**, **flieder/gelb und erklärend**, **hell/fotografisch und sozial**. Das sind beobachtete Unterschiede, keine neu entworfenen Richtlinien.

### Gaps

- **AIRBOWL geprüft, nicht als vierte Hauptreferenz gezählt:** Die [offizielle AIRBOWL-touch-Seite](https://prowin.net/de/airbowl-touch) bindet ein [Bedienmotiv](https://prowin.net/files/prowin-data/img/airbowl-touch/prowin-airbowl-touch-leistungsstufen.jpg) ein. Visuell betrachtet: Gerät rechts, Finger am rot leuchtenden Touchpanel, unscharfer Hinterkopf links; 1920 × 1080 Pixel. Reale technische Alternative, aber kein in dieser Prüfung belegter separater Werbeflyer. Lokal `airbowl-stufen.jpg`.

## Was ist datiert, zeitlos oder historisch — und wo liegen die Grenzen?

### Takeaway

**Aktuell öffentlich verlinkt ist nicht gleich aktuell preisbestätigt oder zur Wiederverwendung freigegeben.** Keines der drei ausgewählten Motive trägt eine sichtbare Angebotsfrist.

### Cited Findings

- **I-DROP:** Im vollständig betrachteten Einseiter steht der Systempreis **179,- €**, aber kein sichtbares Jahr, Ausgabedatum oder Gültigkeitsende. Als **undatierter, weiterhin offiziell verlinkter Werbeflyer** einordnen; heutige Bestellbarkeit und Preisgültigkeit nicht separat bestätigt. Auch die dortigen Umwelt-/Zertifizierungsaussagen wurden nicht eigenständig geprüft. — [Flyer](https://prowin-hub.net/files/public/public.php?file=doc/1/de/printmedien/flyer/iDROP.pdf), [Linkgeber](https://prowin.net/de/i-drop)
- **YOURDAY:** Kein sichtbarer Ausgabestand in den betrachteten zwölf Seiten. Die Originaldatei enthält **CreationDate 23.02.2026, 09:39:03 +01:00** und **ModDate 23.02.2026, 09:39:30 +01:00**: **technische Metadaten**, kein nachgewiesener Veröffentlichungstermin. Seite 11 enthält Preise und Abovergleich; Seite 12 nennt Änderungsvorbehalt und Vorratsgrenze. Einzelne aktuelle Produktseiten bestätigen nicht sämtliche Broschürenpreise oder Abobedingungen. — [Original-PDF](https://prowin-hub.net/files/public/public.php?file=doc/1/de/printmedien/flyer/yourday.pdf), [ergänzend geprüfte Produktseite](https://prowin.net/de/produkt/yourday-power-for-you)
- **Party:** Zeitloses Anlassmotiv ohne eingeblendetes Datum oder Angebotspreis. Die offizielle Gastgeberseite beschreibt **umsatzabhängige** Prämien; daraus kein bedingungsloses Geschenkversprechen ableiten. — [Modul](https://prowin.net/de/prowin-party/prowin-party-feiern), [Bedingungskontext](https://prowin.net/de/prowin-party/gastgeber)

### Inferences

- Kein Kandidat muss aufgrund der belegten Quellen als abgelaufene historische Aktion bezeichnet werden. **„Zeitlos“ beschreibt hier die Gestaltung, nicht unbegrenzte kommerzielle Gültigkeit.**

### Gaps

- Für PDFs, Fotos und abgebildete Personen wurde **keine assetspezifische Wiederverwendungs-/Bearbeitungsfreigabe** erhoben. Öffentliche Abrufbarkeit ist keine Lizenz; bestehende Pressekit-Annahmen wurden weder neu bewertet noch auf diese Dateien übertragen. Nur als Quellen-/Analysebelege verlinken, nicht als freigegebene Nutzerassets ausweisen.
