// LagerKit im echten Browser (Chromium): Archivordner im privaten Dateisystem des Browsers (OPFS) mit erfundenen Projekten.
// Geprüft: _LagerKit anlegen, Übersicht (fällig mit Bericht, vorläufig mit gelbem Hinweis, gesperrt, zurückgeholt), Erfassen,
// Übernehmen aus LabelKit (fremde LabelKit-Datei nie gelesen), Etikett drucken = Nummer fest, Stornieren statt Löschen,
// Verlängern mit Grund, Fällige einsammeln mit Scanner-Stoß (vormerken, gesperrt/nicht fällig: nichts), Eintragen, Entsorgt bleibt
// sichtbar, Regalplatz-Scan mit und ohne „Proben hier einräumen“, Projekt vor 26.0560 (nur _Spektron/LagerKit), keine Datei
// außerhalb von _LagerKit und _Spektron/LagerKit geändert.
// node tests/browser.cjs   (Playwright: in CI installiert; lokal NODE_PATH auf ein playwright) · LAGERKIT_BILDER=<Ordner> für Bildschirmfotos
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const D = require('./daten.cjs');
const ROOT = path.join(__dirname, '..');
const TYP = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYP[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const BILDER = process.env.LAGERKIT_BILDER;
const b64 = x => Buffer.from(String(x)).toString('base64');
const schritt = t => console.log('· ' + t);

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  // Archiv-Handle wie aus „mosaik-suite“/„archiv“ der Projektzentrale – direkt aus dem OPFS (wie LexiKit tests/browser.cjs)
  await context.addInitScript(() => {
    window.LAGERKIT_TEST = true; window.LAGERKIT_NACHPRUEF_MS = 30;
    const orig = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (k) {
      if (k !== 'archiv' || this.name !== 'kv') return orig.call(this, k);
      const req = { result: undefined, error: null, onsuccess: null, onerror: null };
      navigator.storage.getDirectory().then(r => r.getDirectoryHandle('Archiv')).then(
        h => { req.result = h; if (req.onsuccess) req.onsuccess({ target: req }); },
        () => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    };
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-21T10:00:00+01:00'));
  const fehler = []; page.on('pageerror', e => fehler.push(e.message)); page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  page.on('dialog', d => { fehler.push('Browser-Dialog: ' + d.message()); d.dismiss(); });
  const bild = async name => { if (BILDER) { fs.mkdirSync(BILDER, { recursive: true }); await page.screenshot({ path: path.join(BILDER, name + '.png'), fullPage: true }); } };
  const H = `
    window.__arch = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv', { create: true });
    window.__dir = async (teile, create) => { let d = await __arch(); for (const t of teile) d = await d.getDirectoryHandle(t, { create }); return d; };
    window.__schreib = async (pfad, b64) => { const t = pfad.split('/'); const d = await __dir(t.slice(0, -1), true); if (!t.at(-1)) return;
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const w = await (await d.getFileHandle(t.at(-1), { create: true })).createWritable(); await w.write(new TextDecoder().decode(bin)); await w.close(); };
    window.__lies = async pfad => { const t = pfad.split('/'); try { const d = await __dir(t.slice(0, -1), false); return await (await (await d.getFileHandle(t.at(-1))).getFile()).text(); } catch (e) { return null; } };
    window.__liste = async () => { const aus = {}; const geh = async (d, p) => { for await (const [n, h] of d.entries()) { const q = p ? p + '/' + n : n;
      if (h.kind === 'directory') { aus[q + '/'] = 'dir'; await geh(h, q); } else if (!/\.crswap$/.test(n)) { try { const f = await h.getFile(); aus[q] = f.size + '|' + f.lastModified; } catch (e) { /* gerade ersetzt */ } } } }; await geh(await __arch(), ''); return aus; };`;
  const lies = async p => JSON.parse(await page.evaluate(x => __lies(x), p));
  const ruhig = () => page.waitForFunction(() => window.LagerKit && !window.LagerKit.schreibt && (!window.LagerKit.S.lauf || window.LagerKit.S.lauf.fertigAm) && (!window.LagerKit.S.p || (!window.LagerKit.S.p.aus.size && !window.LagerKit.S.p.speichert)), null, { timeout: 20000 });
  const scan = async code => { await page.keyboard.type(code, { delay: 8 }); await page.keyboard.press('Enter'); };
  const toastText = () => page.textContent('#toast');
  try {
    await page.goto(url);
    await page.evaluate(H);
    for (const [pfad, inhalt] of Object.entries(D.archiv())) await page.evaluate(([p, b]) => __schreib(p, b), [pfad, inhalt == null ? '' : b64(inhalt)]);
    const vorher = await page.evaluate(() => __liste());

    /* ---------- 1. Erster Start: _LagerKit fehlt → anlegen ---------- */
    schritt('_LagerKit anlegen');
    await page.reload(); await page.evaluate(H);
    await page.waitForSelector('[data-zugang="anlegen"]');
    await page.click('[data-zugang="anlegen"]');
    await page.waitForSelector('h1:has-text("Rückstellproben im Büro")');
    await ruhig();
    assert.ok(await page.evaluate(() => __lies('_LagerKit/Index.json')), 'Index angelegt');
    // Regalplätze (wie von einem anderen PC angelegt) – dann neu laden
    await page.evaluate(b => __schreib('_LagerKit/Einstellungen.json', b), b64(JSON.stringify(D.EINST)));
    await page.reload(); await page.evaluate(H);
    await page.waitForSelector('h1:has-text("Rückstellproben im Büro")'); await ruhig();
    await page.click('#btnNeu'); await ruhig();
    await page.selectOption('#wer', 'Tst');
    await bild('1-uebersicht');

    /* ---------- 2. Übersicht: Fristregeln sichtbar ---------- */
    schritt('Übersicht');
    const faellig = await page.textContent('.karte-kopf.rot');
    assert.match(faellig, /Fällig – kann weg · 4/, 'vier fällig: 26.0571 R1–R3 (Bericht 20.07.), 26.0590 R1 (vorläufig)');
    const tab = await page.textContent('section.karte:has(.karte-kopf.rot) table');
    assert.match(tab, /31\.10\.2026/);
    assert.match(tab, /kein Bericht übergeben – bitte prüfen/);
    assert.match(tab, /nicht entsorgen – Streitfall/);
    assert.ok(!/Putz verrußt/.test(tab), 'zurückgeholter Bericht: zählt ohne Bericht, ab Probenahme 01.09. → 31.12. nicht fällig');
    const hinweisZeilen = await page.$$eval('section.karte:has(.karte-kopf.rot) tbody tr', trs => trs.filter(t => /kein Bericht übergeben/.test(t.textContent)).map(t => t.textContent));
    assert.equal(hinweisZeilen.length, 1); assert.match(hinweisZeilen[0], /Löschpulver/);
    assert.match(await page.textContent('.kacheln'), /Regal A · Fach 1\s*2 Proben · 2 fällig/);

    /* ---------- 3. Erfassen im neuen Projekt (#projekt=…) ---------- */
    schritt('Erfassen');
    await page.goto(url + '#projekt=' + encodeURIComponent(D.P.neu)); await page.evaluate(H);
    await page.waitForSelector('h1:has-text("Rückstellproben in diesem Projekt")');
    assert.match(await page.textContent('#untertitel'), /Ortstermin 18\.11\.2026/);
    await page.click('[data-aktion="neu"]');
    await page.fill('input[data-feld="was"]', 'Brandschutt');
    let zeile = page.locator('tr[data-probe]').first();
    assert.equal(await zeile.locator('input[data-feld="probenahme"]').inputValue(), '18.11.2026', 'Probenahme = Ortstermin');
    assert.equal(await zeile.locator('input[data-feld="von"]').inputValue(), 'Dr. Pr', 'Genommen von = Kürzel aus dem Ordnernamen');
    assert.match(await page.textContent('#meldungen ~ .spalten'), /„Raum\/Ort“, „Regalplatz“ fehlt noch/, 'Pflichtfelder gelb');
    assert.ok(await page.$('tr[data-probe] input[data-feld="ort"].luecke') && await page.$('tr[data-probe] select[data-feld="platz"].luecke'), 'Raum/Ort und Regalplatz gelb');
    assert.ok(await page.isDisabled('[data-aktion="drucken"]'), 'ohne Pflichtangaben kein Etikett');
    await zeile.locator('input[data-feld="ort"]').fill('Haus A, EG Küche Brandraum, Boden');
    await zeile.locator('input[data-feld="ort"]').press('Tab');
    await zeile.locator('select[data-feld="platz"]').selectOption('pb3');
    await page.fill('input[data-feld="attribute"]', 'verrußt, nass');
    await ruhig();
    assert.match(await page.textContent('tr[data-probe]'), /mind\. 28\.02\.2027/, 'vorläufig: 18.11.2026 + 3 Monate bis Monatsende');
    let datei = await lies(D.P.neu + '/_Spektron/LagerKit/26.0612_Lager.json');
    assert.equal(datei.proben.length, 1); assert.equal(datei.proben[0].nr, 1); assert.equal(datei.proben[0].platz, 'pb3'); assert.equal(datei.version, 1);
    assert.equal(datei.app.name, 'LagerKit');

    /* ---------- 4. Aus LabelKit übernehmen ---------- */
    schritt('Aus LabelKit übernehmen');
    await page.click('[data-aktion="lk-oeffnen"]');
    const lkText = await page.textContent('#lkPanel');
    assert.ok(!/FREMDES PROJEKT/.test(lkText), 'fremde LabelKit-Datei nie gelesen');
    assert.ok(!/Probe 6/.test(lkText), 'stornierte Laborprobe nicht angeboten');
    assert.match(lkText, /Probe 4 · Asbest/); assert.match(lkText, /Brandgeruch-Probe 1/);
    await page.check('#lkPanel input[data-lk="asbestProben:1"]');
    await page.check('#lkPanel input[data-lk="sonstigeProben:1"]');
    await page.click('[data-aktion="lk-uebernehmen"]');
    await page.waitForSelector('tr[data-probe] >> text=Rest von Probe 4');
    const zeilen = await page.$$eval('tr[data-probe]', t => t.map(x => x.textContent.replace(/\s+/g, ' ')));
    assert.equal(zeilen.length, 3);
    assert.match(zeilen[1], /R2.*Fliesenkleber.*Rest von Probe 4 · aus LabelKit.*Haus A, EG Bad, Boden.*in LabelKit ändern/);
    assert.match(zeilen[1], /Asbest nachgewiesen/, 'Asbest aus ResultKit');
    assert.match(zeilen[2], /R3.*Brandschutt.*Rest von Probe 7/);
    assert.ok(!(await page.$('tr[data-probe]:nth-child(2) input[data-feld="was"]')), 'Texte aus LabelKit schreibgeschützt');
    await page.click('[data-aktion="lk-oeffnen"]');
    assert.ok(await page.isDisabled('#lkPanel input[data-lk="asbestProben:1"]'), 'schon übernommen: ausgegraut');
    assert.match(await page.textContent('#lkPanel'), /schon übernommen als R2/);
    await page.click('[data-aktion="lk-zu"]');
    await ruhig();
    await bild('2-erfassen');

    /* ---------- 5. Etikett drucken = Nummer fest ---------- */
    schritt('Etikett drucken');
    await page.click('[data-aktion="drucken"]');
    await page.waitForSelector('dialog[open] >> text=nie auf den Deckel');
    const [druck] = await Promise.all([context.waitForEvent('page'), page.click('dialog[open] [data-start="3"]').then(() => page.click('#dlgOk'))]);
    await druck.waitForLoadState();
    const etiketten = await druck.$$eval('.etk:not(.leer)', e => e.map(x => x.textContent.replace(/\s+/g, ' ')));
    assert.equal(etiketten.length, 3); assert.equal(await druck.$$eval('.etk.leer', e => e.length), 9, 'Startfeld 3: zwei leere Felder davor, Rest der Seite leer');
    assert.match(etiketten[0], /RÜCKSTELLPROBE · NICHT ANS LABOR.*26\.0612.*LK260612R001.*R1.*Brandschutt.*Haus A, EG Küche Brandraum, Boden.*verrußt, nass.*genommen 18\.11\.2026 · Dr\. Pr.*Aufbewahren bis mind\. 28\.02\.2027.*Regal B · Fach 3.*Gouleystr\. 59/);
    assert.match(etiketten[1], /R2.*Rest von Probe 4.*Asbest nachgewiesen – als asbesthaltigen Abfall entsorgen/);
    assert.ok(!/Probe 1\b/.test(etiketten[0]), 'nie „Probe“ für eine R-Nummer');
    if (BILDER) await druck.screenshot({ path: path.join(BILDER, '3-etiketten.png'), fullPage: true });
    // Etikett: QR 18 mm, Text nicht kleiner als bei LabelKit, nichts ragt aus dem Etikett
    const mass = await druck.evaluate(() => { const e = document.querySelectorAll('.etk:not(.leer)')[1], q = e.querySelector('.etk-qr svg').getBoundingClientRect(), r = e.getBoundingClientRect();
      const unten = Math.max(...[...e.querySelectorAll('*')].map(x => x.getBoundingClientRect().bottom));
      return { qr: q.width / 96 * 25.4, h: r.height / 96 * 25.4, ueber: (unten - r.bottom) / 96 * 25.4, klein: Math.min(...[...e.querySelectorAll('.etk-text *')].map(x => parseFloat(getComputedStyle(x).fontSize))) * 0.75 }; });
    assert.ok(Math.abs(mass.qr - 18) < 0.2, 'QR 18 mm: ' + mass.qr); assert.ok(mass.ueber <= 0.05, 'nichts ragt heraus'); assert.ok(mass.klein >= 7.99, 'Text mind. 8 pt: ' + mass.klein);
    await druck.close();
    await ruhig();
    datei = await lies(D.P.neu + '/_Spektron/LagerKit/26.0612_Lager.json');
    assert.ok(datei.proben.every(p => p.nrFest && p.gedruckt.length === 1), 'Nummern fest, Druck vermerkt');
    assert.deepEqual(datei.proben.map(p => p.code), ['LK260612R001', 'LK260612R002', 'LK260612R003']);
    assert.match(await page.textContent('tr[data-probe]'), /🔒 fest/);

    /* ---------- 6. Stornieren statt löschen, leere Zeile löschen ---------- */
    schritt('Stornieren / leere Zeile');
    await page.click('[data-aktion="neu"]');   // R4, leer
    assert.equal(await page.textContent('tr[data-probe]:last-child .nr'), 'R4');
    await page.click('#detail [data-aktion="loeschen"]');
    await ruhig();
    assert.equal(await page.$$eval('tr[data-probe]', t => t.length), 3, 'ganz leere Zeile weg');
    await page.click('tr[data-probe]:nth-child(3) td:first-child');
    await page.click('#detail [data-aktion="loeschen"]');
    await page.fill('dialog[open] input[name="grund"]', 'doppelt erfasst');
    await page.click('#dlgOk'); await ruhig();
    assert.match(await page.textContent('tr[data-probe]:nth-child(3)'), /storniert/);
    await page.click('[data-aktion="neu"]');
    assert.equal(await page.textContent('tr[data-probe]:last-child .nr'), 'R4', 'stornierte R3 bleibt vergeben, neue = R4');
    await page.click('#detail [data-aktion="loeschen"]'); await ruhig();

    /* ---------- 7. Verlängern mit Grund (Pflicht) ---------- */
    schritt('Verlängern');
    await page.click('tr[data-probe]:nth-child(1) td:first-child');
    await page.click('#detail [data-aktion="verlaengern"]');
    await page.fill('dialog[open] input[name="bis"]', '2027-06-30');
    await page.click('#dlgOk');
    assert.match(await page.textContent('#dlgFehler'), /warum/);
    await page.fill('dialog[open] textarea[name="warum"]', 'Rückfrage des Versicherers');
    await page.click('#dlgOk'); await ruhig();
    assert.match(await page.textContent('tr[data-probe]:nth-child(1)'), /mind\. 30\.06\.2027.*verlängert/s);
    assert.match(await toastText(), /Etikett neu drucken/, 'nach Änderung, die auf dem Etikett steht: neu drucken anbieten');
    datei = await lies(D.P.neu + '/_Spektron/LagerKit/26.0612_Lager.json');
    assert.deepEqual(datei.proben[0].fristen.map(f => [f.bis, f.wer, f.warum, f.art]), [['2027-06-30', 'Tst', 'Rückfrage des Versicherers', 'verlaengert']]);

    /* ---------- 7b. Scan landet in einem Textfeld: Zeichen wieder heraus; Platz-Scan füllt den Regalplatz der Zeile ---------- */
    schritt('Scan im Textfeld');
    await page.click('[data-aktion="neu"]');
    const r4 = page.locator('tr[data-probe]').last();
    await r4.locator('input[data-feld="was"]').click();
    await page.keyboard.type('Asche', { delay: 140 });   // Mensch tippt
    await scan('LKP0002');                                 // Scanner-Stoß ins selbe Feld
    await page.waitForFunction(() => /Regalplatz Regal A · Fach 2/.test(document.querySelector('#toast').textContent));
    assert.equal(await r4.locator('input[data-feld="was"]').inputValue(), 'Asche', 'Scan-Zeichen aus dem Feld entfernt');
    assert.equal(await r4.locator('select[data-feld="platz"]').inputValue(), 'pa2', 'Platz-Scan füllt „Regalplatz“');
    await ruhig();
    assert.equal((await lies(D.P.neu + '/_Spektron/LagerKit/26.0612_Lager.json')).proben.find(p => p.nr === 4).was, 'Asche');
    // tippen und sofort zur Übersicht (Codex, PR #1): die Änderung wird vor dem Verlassen gespeichert
    await page.click('tr[data-probe]:last-child td:first-child');
    await page.fill('#detail input[data-feld="notiz"]', 'evtl. DepV');
    await page.click('#zurUebersicht');
    await page.waitForSelector('#suche'); await ruhig();
    assert.equal((await lies(D.P.neu + '/_Spektron/LagerKit/26.0612_Lager.json')).proben.find(p => p.nr === 4).notiz, 'evtl. DepV', 'nichts verloren beim Verlassen');
    await page.goto(url + '#projekt=' + encodeURIComponent(D.P.neu)); await page.evaluate(H); await page.waitForSelector('tr[data-probe]'); await ruhig();

    /* ---------- 8. Fällige einsammeln mit Scanner ---------- */
    schritt('Fällige einsammeln');
    await page.goto(url + '#ansicht=einsammeln'); await page.evaluate(H);
    await page.waitForSelector('h1:has-text("Fällige Proben einsammeln · 4")'); await ruhig();
    const karten = await page.$$eval('.sk', k => k.map(x => x.textContent.replace(/\s+/g, ' ')));
    assert.match(karten[0], /Regal A · Fach 1/); assert.match(karten[1], /Regal A · Fach 1/); assert.match(karten[2], /Regal A · Fach 2.*Gesperrt/); assert.match(karten[3], /Regal B · Fach 3.*kein Bericht übergeben/);
    assert.equal(await page.$$eval('.sk:nth-child(3) [data-aktion="mark"]', x => x.length), 0, 'gesperrt: nicht abhakbar');
    await page.focus('h1');
    await scan('LK260571R003');
    await page.waitForFunction(() => window.LagerKit.S.sammel.marks.size === 1);
    assert.match(await toastText(), /R3.*Gipskarton verrußt.*„entsorgt“ vorgemerkt/);
    assert.equal(await page.getAttribute('.sk.vorgemerkt [data-wert="entsorgt"]', 'aria-pressed'), 'true');
    await scan('LK260571R002');   // gesperrt
    await page.waitForFunction(() => /gesperrt/.test(document.querySelector('#toast').textContent));
    await scan('lk260612r001');    // nicht fällig (Kleinbuchstaben wie bei Feststelltaste)
    await page.waitForFunction(() => /nicht fällig/.test(document.querySelector('#toast').textContent));
    await scan('LK999999R001');
    await page.waitForFunction(() => /unbekannte Probe/.test(document.querySelector('#toast').textContent));
    assert.equal(await page.evaluate(() => window.LagerKit.S.sammel.marks.size), 1, 'gesperrt/nicht fällig/unbekannt: nichts vorgemerkt');
    await bild('5-einsammeln');
    await page.click('.sk:nth-child(1) [data-wert="entsorgt"]');
    await page.click('.sk:nth-child(4) [data-wert="nichtGefunden"]');
    const [liste] = await Promise.all([context.waitForEvent('page'), page.click('[data-aktion="liste-drucken"]')]);
    await liste.waitForLoadState();
    const lt = await liste.textContent('table');
    assert.match(lt, /Regal A · Fach 1.*Regal A · Fach 1.*Regal A · Fach 2.*GESPERRT.*Regal B · Fach 3.*kein Bericht übergeben/s, 'Entsorgungsliste nach Regalplatz');
    await liste.close();
    await page.click('[data-aktion="eintragen"]'); await ruhig();
    await page.waitForFunction(() => /eingetragen von Tim Test am 21\.11\.2026/.test(document.querySelector('#toast').textContent));
    datei = await lies(D.P.bericht + '/_Spektron/LagerKit/26.0571_Lager.json');
    assert.deepEqual(datei.proben.find(p => p.id === 'b-r1').ereignisse.map(e => [e.art, e.wer]), [['entsorgt', 'Tst']]);
    assert.equal(datei.proben.find(p => p.id === 'b-r2').ereignisse.length, 0);
    assert.deepEqual(datei.proben.find(p => p.id === 'b-r3').ereignisse.map(e => e.art), ['entsorgt'], 'vorgemerkt per Scan');
    assert.equal(datei.proben.length, 3, 'nichts gelöscht');
    assert.deepEqual((await lies(D.P.ohne + '/_Spektron/LagerKit/26.0590_Lager.json')).proben[0].ereignisse.map(e => e.art), ['nichtGefunden']);

    /* ---------- 9. Scan von Hand / in der Übersicht, entsorgt bleibt sichtbar ---------- */
    schritt('Übersicht nach dem Einsammeln, Scan öffnet die Probe');
    await page.goto(url); await page.evaluate(H); await page.waitForSelector('#suche'); await ruhig();
    assert.match(await page.textContent('.karte-kopf.rot'), /Fällig – kann weg · 2/, 'R1 (Klick) und R3 (Scan) entsorgt; gesperrte R2 und „nicht gefunden“ bleiben fällig');
    assert.match(await page.textContent('details.klapp:last-of-type summary'), /Entsorgt · 2/);
    await page.click('details.klapp:last-of-type summary');
    assert.match(await page.textContent('details.klapp:last-of-type'), /R1.*Brandschutt.*entsorgt 21\.11\.2026 · Tst/s);
    await page.click('#suche'); await scan('LK260571R002');
    await page.waitForSelector('tr.blitz[data-probe="b-r2"]');
    assert.equal(await page.evaluate(() => location.hash.includes('probe=b-r2')), true);
    // im Projekt bleibt die entsorgte Probe grau sichtbar
    assert.match(await page.textContent('tr[data-probe="b-r1"]'), /entsorgt 21\.11\.2026/);
    assert.ok(await page.$('tr.grau[data-probe="b-r1"]'));
    await page.goto(url); await page.evaluate(H); await page.waitForSelector('#suche'); await ruhig();
    await page.fill('#suche', '26.0612 R2'); await page.press('#suche', 'Enter');
    await page.waitForSelector('tr.blitz >> text=Fliesenkleber');

    /* ---------- 10. Regalplatz-Scan: ohne Schalter nichts verschieben, mit Schalter einräumen ---------- */
    schritt('Regalplatz-Scan');
    await page.goto(url); await page.evaluate(H); await page.waitForSelector('#suche'); await ruhig();
    await page.focus('h1'); await scan('LKP0004');
    await page.waitForSelector('h1:has-text("Boden links")');
    await scan('LK260612R002');   // ohne „einräumen“: öffnet nur
    await page.waitForSelector('tr.blitz >> text=Fliesenkleber'); await ruhig();
    assert.equal((await lies(D.P.neu + '/_Spektron/LagerKit/26.0612_Lager.json')).proben[1].platz, 'pb3', 'ohne Schalter nichts verschoben');
    await page.goto(url + '#ansicht=platz&id=pbl'); await page.evaluate(H); await page.waitForSelector('h1:has-text("Boden links")'); await ruhig();
    await page.click('[data-aktion="einraeumen-an"]');
    await page.waitForSelector('.einraeumen >> text=Einräumen auf Boden links');
    await page.focus('h1'); await scan('LK260612R002');
    await page.waitForFunction(() => /R2.*→ Boden links/.test(document.querySelector('#toast').textContent)); await ruhig();
    datei = await lies(D.P.neu + '/_Spektron/LagerKit/26.0612_Lager.json');
    assert.equal(datei.proben[1].platz, 'pbl');
    assert.deepEqual(datei.proben[1].plaetze.map(x => [x.von, x.nach, x.wer]), [['pb3', 'pbl', 'Tst']]);
    assert.match(await page.textContent('main'), /Fliesenkleber/, 'liegt jetzt hier');
    await page.click('[data-aktion="einraeumen-aus"]');
    await bild('4-regalplatz');

    /* ---------- 10b. Regalplatz anlegen, Aufräumtag mit „Herkunft unklar“, U-Probe einem Projekt zuordnen ---------- */
    schritt('Regalplatz anlegen, Aufräumtag, Herkunft unklar');
    await page.goto(url + '#ansicht=plaetze'); await page.evaluate(H); await page.waitForSelector('#platzNeu'); await ruhig();
    await page.fill('#platzNeu', 'Regal C · Fach 1'); await page.click('[data-aktion="platz-neu"]');
    await page.waitForSelector('td.mono >> text=LKP0005');
    await page.goto(url + '#ansicht=aufraeumen'); await page.evaluate(H); await page.waitForSelector('#aufrPlatz'); await ruhig();
    await page.selectOption('#aufrPlatz', { label: 'Regal C · Fach 1' });
    const z1 = page.locator('tr[data-aufr]').nth(0), z2 = page.locator('tr[data-aufr]').nth(1);
    await z1.locator('[data-af="projekt"]').fill('26.0590'); await z1.locator('[data-af="was"]').fill('Asche im Glas'); await z1.locator('[data-af="ort"]').fill('KG');
    await z2.locator('[data-af="unklar"]').check(); await z2.locator('[data-af="was"]').fill('Kunststoffschmelze'); await z2.locator('[data-af="gefunden"]').fill('Regal A oben');
    await bild('6-aufraeumtag');
    await page.click('[data-aktion="aufr-speichern"]');
    await page.waitForSelector('dialog[open] >> text=Etiketten drucken');
    const [auf] = await Promise.all([context.waitForEvent('page'), page.click('#dlgOk')]);
    await auf.waitForLoadState();
    const at = await auf.$$eval('.etk:not(.leer)', e => e.map(x => x.textContent.replace(/\s+/g, ' ')));
    assert.equal(at.length, 2, 'alle Etiketten des Aufräumtags in einem Druck, in Zeilenfolge');
    assert.match(at[0], /26\.0590.*LK260590R002.*R2.*Asche im Glas.*Datum unbekannt · nachträglich erfasst 21\.11\.2026.*Aufbewahren bis mind\. 28\.02\.2027.*Regal C · Fach 1/);
    assert.match(at[1], /Herkunft unklar.*LKU0001.*U1.*Kunststoffschmelze.*gefunden: Regal A oben/);
    await auf.close(); await ruhig();
    const ohneDatei = await lies('_LagerKit/Ohne-Projekt.json');
    assert.deepEqual(ohneDatei.proben.map(u => [u.nr, u.gefunden, u.nachtraeglich, u.probenahmeUnbekannt]), [[1, 'Regal A oben', true, true]]);
    const r2 = (await lies(D.P.ohne + '/_Spektron/LagerKit/26.0590_Lager.json')).proben.find(p => p.nr === 2);
    assert.ok(r2.nrFest && r2.nachtraeglich && r2.probenahmeUnbekannt);
    await page.goto(url); await page.evaluate(H); await page.waitForSelector('#suche'); await ruhig();
    await page.click('details.klapp > summary:has-text("Herkunft unklar ·")');
    await page.click('[data-aktion="u-zuordnen"]');
    await page.fill('#pwSuche', '26.0612'); await page.click('[data-pw]');
    await page.waitForSelector('tr.blitz input[data-feld="was"][value="Kunststoffschmelze"]'); await ruhig();
    const r5 = (await lies(D.P.neu + '/_Spektron/LagerKit/26.0612_Lager.json')).proben.find(p => p.ausU === 'U1');
    assert.equal(r5.nr, 5, 'nächste R-Nummer im Projekt (R4 ist die Asche aus 7b)');
    assert.deepEqual(r5.codes.map(c => c.code), ['LKU0001'], 'U-Code bleibt als Verlauf');
    assert.deepEqual((await lies('_LagerKit/Ohne-Projekt.json')).proben[0].zugeordnet.nr, 5);

    /* ---------- 11. Projekt vor 26.0560: nur _Spektron/LagerKit ---------- */
    schritt('Projekt vor 26.0560');
    await page.goto(url + '#projekt=' + encodeURIComponent(D.P.alt)); await page.evaluate(H);
    await page.waitForSelector('text=Projekt vor 26.0560');
    await page.click('[data-aktion="neu"]');
    await page.fill('input[data-feld="was"]', 'Asche'); await ruhig();
    await ruhig();
    const nachher = await page.evaluate(() => __liste());
    const neuDa = Object.keys(nachher).filter(k => !(k in vorher)).sort();
    assert.deepEqual(neuDa.filter(k => k.startsWith(D.P.alt)), [D.P.alt + '/_Spektron/', D.P.alt + '/_Spektron/LagerKit/', D.P.alt + '/_Spektron/LagerKit/25.0310_Lager.json']);

    /* ---------- 12. Nichts außerhalb von _LagerKit und _Spektron/LagerKit geändert ---------- */
    schritt('Nur eigene Dateien');
    for (const [k, v] of Object.entries(vorher)) if (!k.endsWith('/')) assert.ok(k.includes('/_Spektron/LagerKit/') || nachher[k] === v, 'geändert: ' + k);
    // Spektron-Projekte (ab 26.0560): spektron-ordner.js ergänzt beim Anlegen die Hinweisdatei in „_Spektron“ – wie in jeder App
    for (const k of neuDa) assert.ok(k.startsWith('_LagerKit/') || /\/_Spektron\/(LagerKit\/.*)?$/.test(k) || (!k.startsWith(D.P.alt) && k.endsWith('/_Spektron/BITTE NICHT ANFASSEN.txt')), 'neu angelegt: ' + k);
    assert.deepEqual(fehler, [], 'keine Fehler in der Konsole');
    console.log('Browser: alle Schritte grün');
  } catch (e) {
    await bild('fehler');
    console.error(e); console.error('Konsole:', fehler.join('\n')); process.exitCode = 1;
  } finally { await browser.close(); server.close(); }
})();
