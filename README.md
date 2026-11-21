# LagerKit (Spektron)

**Rückstellproben im Büro: was, woher, bis wann – und was weg kann.** Jede Rückstellprobe bekommt ein Etikett mit QR-Code auf dem
LabelKit-Bogen, ein Ablaufdatum und einen festen Regalplatz. Die Lager-Übersicht zeigt, was fällig ist; „Fällige einsammeln“ führt
einmal am Regal entlang. Läuft im Browser (Edge/Chrome), ohne Server, ohne Netz. Büro-Werkzeug wie LexiKit: SPEKTRON-LOOK v1, keine Leiste.

Adresse: `https://kaspersebastian83-dot.github.io/Lagerkit/` (GitHub Pages muss für dieses Repo eingeschaltet sein). Gleiche Adresse wie
die anderen Apps → LagerKit nimmt den Archivordner, den die Projektzentrale gewählt hat (Browser-Speicher `mosaik-suite`, Schlüssel
`archiv`, nur gelesen; eine eigene Wahl steht unter `lagerkit-archiv`). Aus der Projektzentrale: `#projekt=<Ordnername>`.

Plan und Entscheidungen: Projekt-Docs `claude/lagerkit-plan.md` (Abschnitt „Entscheidungen Basti (21.11.2026)“ gilt), Mock-up
„LagerKit – Mock-up“, Stand: `claude/lagerkit-stand.md`.

## 0.2.0 (21.11.2026) – Inventur, Blanko-Etiketten, Entsorgungsliste mit „wohin“

Plan: Projekt-Doc `claude/lagerkit-0.2.0-plan.md`, Teil „0.2.0 – nur LagerKit“ (F1–F6). „Ans Labor geben“ kommt mit 0.3.0.

- **Inventur** (F1, F2): „Mehr … › Inventur …“ oder auf einem Regalplatz „🔍 Diesen Platz prüfen“ (neben „Proben hier einräumen“). Platz-Code
  scannen → alle Proben darauf scannen → „Platz fertig“; mehrere Plätze in einem Durchgang. Die Leiste heißt **„Prüfen: …“ und ist lila**
  (Einräumen: „Einräumen auf …“, grün). **Beim Prüfen bucht ein Scan nie um** – auch „Platz fertig“ ändert keine Probe. Ergebnis je Platz:
  ✓ da · fehlt (→ „als nicht gefunden eintragen“) · woanders gebucht (→ „hierher umbuchen“) · als entsorgt eingetragen (→ „doch da – Eintrag
  zurücknehmen“) · unbekannter Code (freies Blanko-Etikett → „Neue Rückstellprobe mit diesem Etikett …“); war eine Probe „nicht gefunden“
  eingetragen und liegt da → „wieder gefunden – eintragen“. Jede Korrektur ist ein Klick mit „Du bist“. Vor „Platz fertig“ liest LagerKit
  die betroffenen Projekte frisch. Gespeichert in `_LagerKit\Inventuren\<JJJJ-MM-TT>_<Kürzel>.json` (eine Prüfung je Platz, mit den
  Korrekturen), druckbar (Durchgang und frühere Inventuren). Übersicht: je Regalplatz „zuletzt geprüft MM/JJJJ“.
- **Erinnerung nach drei Monaten** (F2): ruhige gelbe Zeile „Inventur fällig: … – Regal durchgehen →“, wenn ein benutzter Platz zuletzt
  vor mehr als drei Monaten geprüft wurde – oder nie, und seine erste Probe liegt seit drei Monaten dort („seit“ = letzte Umbuchung auf den
  Platz, sonst Erfassen). Sperrt nichts, springt nicht auf; „später“ blendet sie an diesem PC zwei Wochen aus (`localStorage`).
- **Blanko-Etiketten** (F3, F4): „Mehr … › Blanko-Etiketten drucken …“ – n Etiketten mit Startfeld; schwarzer Balken „RÜCKSTELLPROBE · NICHT
  ANS LABOR“ + Code, QR (18 mm wie sonst) mit `LKB0001` …, Klarschrift, drei Schreiblinien „Projekt / Was / Datum“ (je ca. 9 mm), Absender.
  **Erst reservieren, dann drucken:** Der Bereich kommt mit dem sicheren Schreiben in `_LagerKit\Einstellungen.json` (`blankoBereiche`), wird
  nach dem Zurücklesen und noch einmal kurz danach geprüft; überschneidet er sich mit dem eines anderen PCs, weichen beide auf den nächsten
  freien Bereich aus (verworfene bleiben stehen). Ein reservierter Bereich kommt nie wieder, auch nicht nach abgebrochenem Druck; jeder PC
  merkt sich außerdem seine höchste Nummer. Das Druckfenster öffnet sich beim Klick und wird erst nach bestandener Prüfung gefüllt.
- **Freies Blanko-Etikett scannen** → „Neue Rückstellprobe mit diesem Etikett“: in dieses Projekt / Projekt wählen … (neue Zeile mit der
  nächsten R-Nummer, wie gewohnt ausfüllen) oder „Herkunft unklar …“ (U-Probe). Der Code steht in `codes` der Probe (`art: "blanko"`), die
  R-Nummer bleibt die Bezeichnung. Vergeben wird jeder Code genau einmal: Zuordnung in `Einstellungen.json` (`blankoZuordnung`, id = Code),
  mit dem sicheren Schreiben und einer zweiten Prüfung; ist er schon vergeben, öffnet der Scan diese Probe. Scan, Suche, Inventur und
  „Fällige einsammeln“ finden die Probe über beide Codes (Index `blanko`, sonst die Zuordnung). Eine U-Probe nimmt ihren Blanko-Code beim
  Zuordnen ins Projekt mit. Ein LagerKit-Etikett ist danach freiwillig. Eine Probe mit Blanko-Code ist nie „ganz leer“ (stornieren statt löschen).
- **Entsorgungsliste** (F5, F6): beim Einsammeln je Probe freiwillig „wohin“ (Restmüll · Gefährlicher Abfall / Entsorger · Asbestabfall ·
  zurück an Auftraggeber · Sonstiges mit Freitext), bei „Asbest nachgewiesen“ vorbelegt „Asbestabfall“, „Für alle markierten: …“; Spalte
  „wohin“ auch auf der gedruckten Liste. „wohin“ steht im Ereignis `entsorgt` und in `wohin` der Probe. Jedes „Eintragen“ legt einen
  **festen Beleg** ab: `_LagerKit\Entsorgungslisten\<JJJJ-MM-TT>_<Kürzel>_<lfd>.json` mit genau dem, was die Liste zeigte (wer, wann, je
  Probe Projekt, Nr., Was, Ort, Platz, entsorgt / nicht gefunden / behalten (verlängert bis …) / gesperrt / offen, wohin, Hinweise, ob
  eingetragen). Nächste freie laufende Nummer, eine vorhandene Datei wird nie überschrieben, danach nie geändert. „Entsorgt“ in der Übersicht
  zeigt „Liste vom … · Kürzel · n Proben“; Klick zeigt sie, „Drucken“ druckt sie. Kein PDF-Schreiber – PDF über „Als PDF speichern“ im Druckdialog.
- Kürzel in Dateinamen nur mit Buchstaben und Ziffern („Dr. Ka“ → `DrKa`).

### 0.1.0-PCs im selben Büro

Projektdatei bleibt Fassung 1. Ein PC mit 0.1.0 verliert beim Zusammenführen nichts (getestet mit dem unveränderten 0.1.0-Kern,
`tests/alt/kern-0.1.0.js`): `codes`, `wohin`, Ereignisse mit `wohin`/`bei`, Umbuchungen aus der Inventur, `blankoBereiche` und
`blankoZuordnung` in den Einstellungen bleiben. Was ein 0.1.0-PC nicht kann: LKB-Codes scannen (gilt dort als „kein Code“), „wohin“ und
Belege beim Einsammeln; schreibt er den Index, fehlen darin Blanko-Code und „seit“, bis ein 0.2.0-PC das Projekt wieder liest (beim Start
im Hintergrund) – der Scan findet die Probe über die Zuordnung trotzdem. Eine Zeile, die nur einen Blanko-Code hat, könnte er als „leer“
löschen. Darum alle PCs bald auf 0.2.0 (Seite neu laden).

## 0.1.0 (21.11.2026) – erste Fassung

- **Lager-Übersicht** (Start ohne Projekt): Kacheln je Regalplatz (Anzahl, fällig; Klick filtert), Suche (Projektnr., Ort, Was – oder
  „26.0612 R2“ wie ein Scan), Filter Kürzel/Art, „Fällig – kann weg“, „Wird in den nächsten 30 Tagen fällig“, zugeklappt „Im Lager“ (nach
  Regalplatz), „Herkunft unklar“, „Entsorgt“. Liest `_LagerKit\Index.json`; „Neu einlesen“ baut ihn aus den Projektdateien neu.
- **Im Projekt erfassen**: R1, R2 … mit Was, Raum/Ort, Oberfläche/Attribute, Art, Behälter, Probenahme (vorbelegt: Ortstermin aus
  `_Projekt.json`), Genommen von (vorbelegt: Kürzel aus dem Ordnernamen), Aufbewahren bis, Regalplatz, Notiz, „Asbest / schadstoffhaltig
  (Verdacht)“. Pflicht gelb; ohne Pflichtangaben kein Etikett. **„Aus Laborproben übernehmen …“**: nicht stornierte LabelKit-Proben
  anhaken → „R2 · Rest von Probe 7“, Texte schreibgeschützt („in LabelKit ändern“), schon übernommene ausgegraut. Speichert von selbst.
- **Nummern wie LabelKit**: fest beim ersten Druck, danach stornieren statt löschen (mit Name), eine Nummer kommt nie wieder, eine ganz
  leere Zeile darf weg. Zählung je Projekt; eine R-Nummer heißt nie „Probe“.
- **Etikett**: A4, 2 × 6 à 97 × 42,3 mm, Startfeld für angebrochene Bögen, nur schwarz. Schwarzer Balken „RÜCKSTELLPROBE · NICHT ANS
  LABOR“ + Projektnr. (als SVG – druckt auch ohne „Hintergrundgrafiken“), QR 18 × 18 mm (Version 1, Fehlerkorrektur M, Ruhezone) mit
  Klarschrift, große R-Nummer, Was, Raum/Ort, Attribute, „genommen … · Kürzel“ (ggf. „Rest von Probe n“), Asbest-Zeile, gerahmt
  „Aufbewahren bis mind. TT.MM.JJJJ · Regalplatz“, Absenderzeile wie LabelKit. Text nicht kleiner als bei LabelKit (≥ 8 pt); was nicht
  passt, wird gekürzt und im Druckschritt gelb genannt. „Etikett aufs Gefäß, nie auf den Deckel“ im Druckschritt und in der Kurzanleitung.
- **Frist** (Plan E6, Entscheidung 21.11.2026): 3 Monate ab Übergabe des Berichts, bis Monatsende. Übergabe = **„Ans Büro übergeben“ in der
  Projektzentrale** (BüroKit-Aufgabe „Gutachten“ in `_Spektron/Buero/aufgaben/`, Zeitpunkt `erstellt`); bei mehreren Mitteilungen die
  zuletzt übergebene; aus der Liste genommen („geloescht“, auch frühere Übergaben „withdraw“; künftig „zurueck“) zählt nicht. Ohne
  Bericht: vorläufig Probenahme + 3 Monate – fällig so mit dem gelben Hinweis „kein Bericht übergeben – bitte prüfen“ (keine Sperre). Der
  Bericht schiebt nur nach hinten. Von Hand gesetztes Datum / Verlängerung (Name + Grund) gilt vor der Regel. Das spätere Tor
  „Fertigstellen & ans Büro übergeben“ legt dieselbe Aufgabe an – LagerKit muss dann nichts ändern.
- **Verlängern / Nicht entsorgen / Platz ändern**: mit „Du bist“ und Pflicht-Grund; Sperre aufheben ebenso; alles im Verlauf. Danach
  „Etikett neu drucken“ angeboten, wenn sich etwas geändert hat, das auf dem Etikett steht.
- **Fällige einsammeln**: nach Regalplatz, als Entsorgungsliste druckbar; je Probe „entsorgt“ · „nicht gefunden“ · „behalten (verlängern …)“;
  gesperrte nicht abhakbar; „Eintragen“ schreibt Name und Datum (frisch geprüft: inzwischen gesperrt oder nicht mehr fällig → nichts).
  Nichts wird gelöscht; Entsorgtes bleibt grau im Projekt und unter „Entsorgt“ („Doch nicht entsorgt …“ mit Name und Grund).
- **Asbest nachgewiesen** aus ResultKits `_Ergebnisse.json` für die verknüpfte Laborprobe (gleiche Regel wie ResultKit `asbestBefund`):
  leicht rote Marke in Listen, auf Etikett und Entsorgungsliste. Keine Werte, keine Grenzwerte.
- **Herkunft unklar** (U1, U2 … in `_LagerKit\Ohne-Projekt.json`) und **Aufräumtag** (Schnellerfassung platzweise, Datum „unbekannt“ →
  Frist ab heute, „nachträglich erfasst“, alle Etiketten in einem Druck). U-Probe → Projekt: nächste R-Nummer dort, U-Code bleibt im Verlauf.
- **Scannen** (USB-Handscanner, 2D, Tastatur-Modus): Code nur Buchstaben und Ziffern (`LK260612R002`, `LKU0002`, `LKP0001`), damit US- und
  DE-Layout dasselbe tippen; das Muster wird auch in verstümmelter Eingabe gefunden (Groß/klein, Zeichen davor/danach). Scan = schnelle
  Zeichenfolge mit Enter; landet er in einem Textfeld, nimmt LagerKit die Zeichen dort wieder heraus. Übersicht/Projekt: öffnet die Probe.
  „Fällige einsammeln“: merkt „entsorgt“ vor (Ton, rückgängig); nicht fällig / gesperrt / unbekannt → Meldung, nichts vorgemerkt.
  **Regalplatz-Codes** (`LKP0001` …, „Platz-Etiketten drucken“): Scan zeigt, was dort liegt; nur mit „Proben hier einräumen“ (Leiste mit
  „Fertig“) verschiebt ein Proben-Scan die Probe dorthin (Name, rückgängig). Im Erfassen füllt ein Platz-Scan den Regalplatz der Zeile.
- **Mehr …**: Regalplätze (anlegen, umbenennen, „nicht mehr benutzt“ – nie löschen; Platz-Etiketten), Aufräumtag, Standardfrist, Index neu
  aufbauen, Kurzanleitung, Über/Version.

## Dateien – LagerKit schreibt nur hier

- `<Projekt>/_Spektron/LagerKit/<Nr>_Lager.json` – die Wahrheit, mit datierten Sicherungen in `_Spektron/LagerKit/_Sicherungen/`
  (eine je Tag vor dem ersten Schreiben). Projekte vor 26.0560: LagerKit legt dort nur `_Spektron/LagerKit` an, sonst nichts.
  (Bei Spektron-Projekten ergänzt `spektron-ordner.js` wie in jeder App die Hinweisdatei in `_Spektron`, falls sie fehlt.)
- Archivordner `_LagerKit\`: `Index.json` (Zwischenspeicher, jederzeit neu aufbaubar; unlesbar → wird neu geschrieben),
  `Ohne-Projekt.json`, `Einstellungen.json` (Standardfrist, Regalplätze; ab 0.2.0 `blankoBereiche`, `blankoZuordnung`),
  ab 0.2.0 `Inventuren\<JJJJ-MM-TT>_<Kürzel>.json` und `Entsorgungslisten\<JJJJ-MM-TT>_<Kürzel>_<lfd>.json` (feste Belege, nie geändert).
  Den Ordner legt LagerKit nach einem Klick an.
- Gemeinsame Dateien wie LexiKit 0.4.0: neu lesen, zusammenführen (nach id; nur die selbst geänderten Felder, Verlaufslisten werden
  vereinigt), schreiben, nach 1,5 s zurücklesen und prüfen, sonst bis zu viermal; eine unlesbare oder neuere Datei wird nie überschrieben.
  Die Projektdatei wird genauso geschrieben. Jede Datei trägt `format`, `version: 1` und `app`; eine neuere Fassung öffnet nur zum Ansehen.
- Nur gelesen: LabelKit-Datei (über `spektron-ordner.js` `labelkitWahl` – eine Datei eines anderen Projekts nie, LabelKit-Regel m2),
  `_Projekt.json`, `_Ergebnisse.json`, BüroKit-Aufgaben, `_Spektron-Mitarbeiter.json`.
- Für 0.2.0 vorbereitet (ohne Formatbruch): `ansLabor` in der Projektdatei, je Probe `codes` (zweiter Code, Blanko-Etiketten) und `wohin`.

### Format der Projektdatei (Fassung 1)

`{ format: 'spektron-lagerkit', version: 1, app, projekt: { nr, ordner }, proben: [ … ], ansLabor: [], gespeichertAm }` – je Probe
`id, nr, code, codes[], erfasst, erfasstVon, geaendert, was, ort, attribute, art, behaelter, probenahme, probenahmeUnbekannt, von, platz,
notiz, verdacht, quelle (LabelKit: liste, id, nr, label, titel), nachtraeglich, ausU, wohin, nrFest, storniert, weg` und die Verlaufslisten
`fristen, sperren (aufgehoben), plaetze, ereignisse (entsorgt – ab 0.2.0 mit `wohin`, nichtGefunden – aus der Inventur mit
`bei: "inventur"`, entsorgtZurueck, gefunden), gedruckt, ansLabor`; `codes` ab 0.2.0 auch `{ code: "LKB0013", art: "blanko", am, wer }`.

## Aufbau

Eine Datei `index.html` (Look, App, Kern) plus `spektron-ordner.js` (byte-gleich mit der Projektzentrale, unverändert), `sw.js`
(offline), `manifest.webmanifest`, `icon.svg`. Inhaltsregel `connect-src 'self'`, kein Netz. App-Farbe Moosgrün `#5f7a2b` / `#4c6322`
(4,9 : 1 bzw. 6,7 : 1 auf Weiß) – das Türkis aus dem Mock-up liegt zu nah an BelegKit und LexiKit.

**QR-Code:** „QR Code Generator for JavaScript“ von Kazuhiko Arase, Version 2.0.4 (npm `qrcode-generator`), MIT-Lizenz – unverändert
eingebettet (Block `QR-ERZEUGER` in `index.html`, Lizenzkopf dort). Ausgabe als SVG. „QR Code“ ist eine eingetragene Marke der DENSO WAVE
INCORPORATED.

## Tests

- `node tests/kern.cjs` – Frist (Bericht, vorläufig, mehrere Mitteilungen, Zurückholen, nur nach hinten, von Hand, Monatsende inkl.
  Februar/Schaltjahr), Nummern fest/storniert, Code ↔ Projekt/R-Nummer, verstümmelte Eingabe mit US/DE-Layout, erzeugter QR wird mit
  jsQR zurückgelesen (nur im Test), Zusammenführen mit einem zweiten PC, unlesbar/neuer nie überschreiben, Index neu aufbauen.
- `node tests/dateien.cjs` – Look byte-gleich mit BerichtKit und LexiKit, `spektron-ordner.js` byte-gleich mit der Projektzentrale,
  Offline-Dateien, kein Netz, Farbe/Kontrast, Lizenzhinweis.
- `node tests/browser.cjs` (Playwright, Chromium, Archiv im OPFS mit erfundenen Projekten) – _LagerKit anlegen, Übersicht, Erfassen,
  aus LabelKit übernehmen (fremde Datei nie gelesen), Etikett drucken = Nummer fest (QR 18 mm, ≥ 8 pt, nichts ragt heraus), stornieren,
  verlängern mit Grund, Scan im Textfeld, Fällige einsammeln mit Scanner-Stoß, Entsorgungsliste, Eintragen, Entsorgt bleibt sichtbar,
  Regalplatz-Scan mit und ohne „Proben hier einräumen“, Aufräumtag, U-Probe zuordnen, Projekt vor 26.0560, keine fremde Datei geändert.
- `node tests/kern-020.cjs` (0.2.0) – Inventur-Abgleich (alle Fälle), Erinnerung (drei Monate, nie geprüft, „seit“), LKB-Reservierung mit
  bis zu drei PCs gleichzeitig und einem 0.1.0-PC dazwischen (gedruckte Bereiche überlappen nie, abgebrochener Druck gibt nichts frei),
  Blanko-Code genau einmal zuordnen (drei PCs gleichzeitig), Finden über beide Codes, „wohin“-Vorbelegung, Beleg nie überschrieben (auch
  zwei PCs im selben Augenblick), 0.1.0-Datei ↔ 0.2.0 ohne Verlust (mit dem echten 0.1.0-Kern).
- `node tests/browser-020.cjs` (0.2.0) – Erinnerung und „später“, Blanko drucken (Maße 97 × 42,3 mm, QR 18 mm, drei Linien, nichts
  gekürzt) → scannen → im Projekt und als „Herkunft unklar“ erfassen → über beide Codes finden, Einsammeln mit „wohin“ und „behalten“ →
  Beleg im Ordner → unter „Entsorgt“ anzeigen und drucken (Beleg unverändert), Inventur mit Scanner-Stoß (bucht nie um), Korrekturen per
  Klick, Inventur-Datei, „zuletzt geprüft“, zweiter Beleg, nur eigene Dateien.
- Lokal: Repos `berichtkit`, `lexikit`, `projektzentrale` neben `Lagerkit` klonen; `NODE_PATH` auf `playwright` und `jsqr`; `LANG=C.UTF-8`.
  Alle Testdaten sind erfunden.
