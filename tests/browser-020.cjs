// LagerKit 0.2.0 im echten Browser (Chromium), Archiv im OPFS mit erfundenen Projekten (tests/daten.cjs).
// Geprüft: Erinnerung „Inventur fällig“ (und „später“), Blanko-Etiketten drucken (Nummern vorher reserviert, abgebrochener Druck gibt nichts
// frei, Maße), freies Blanko-Etikett scannen → neue Probe im Projekt bzw. „Herkunft unklar“, Finden über beide Codes, Einsammeln mit „wohin“
// (Vorbelegung Asbestabfall, „für alle markierten“) → fester Beleg im Ordner → unter „Entsorgt“ wieder anzeigen und drucken (Beleg bleibt
// unverändert), Inventur mit Scanner-Stoß (bucht nie um), Ergebnis je Platz mit Korrekturen per Klick, Inventur-Datei, „zuletzt geprüft“,
// keine Datei außerhalb von _LagerKit und _Spektron/LagerKit geändert.
// node tests/browser-020.cjs   (Playwright: in CI installiert; lokal NODE_PATH auf ein playwright, CHROME=<chromium>) · LAGERKIT_BILDER=<Ordner>
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
const LAGER = { bericht: D.P.bericht + '/_Spektron/LagerKit/26.0571_Lager.json', ohne: D.P.ohne + '/_Spektron/LagerKit/26.0590_Lager.json', neu: D.P.neu + '/_Spektron/LagerKit/26.0612_Lager.json', zurueck: D.P.zurueck + '/_Spektron/LagerKit/26.0601_Lager.json' };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
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
  const bild = async (name, p) => { if (BILDER) { fs.mkdirSync(BILDER, { recursive: true }); await (p || page).screenshot({ path: path.join(BILDER, '020-' + name + '.png'), fullPage: true }); } };
  const H = `
    window.__arch = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv', { create: true });
    window.__dir = async (teile, create) => { let d = await __arch(); for (const t of teile) d = await d.getDirectoryHandle(t, { create }); return d; };
    window.__schreib = async (pfad, b64) => { const t = pfad.split('/'); const d = await __dir(t.slice(0, -1), true); if (!t.at(-1)) return;
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const w = await (await d.getFileHandle(t.at(-1), { create: true })).createWritable(); await w.write(new TextDecoder().decode(bin)); await w.close(); };
    window.__lies = async pfad => { const t = pfad.split('/'); try { const d = await __dir(t.slice(0, -1), false); return await (await (await d.getFileHandle(t.at(-1))).getFile()).text(); } catch (e) { return null; } };
    window.__liste = async () => { const aus = {}; const geh = async (d, p) => { for await (const [n, h] of d.entries()) { const q = p ? p + '/' + n : n;
      if (h.kind === 'directory') { aus[q + '/'] = 'dir'; await geh(h, q); } else if (!/\\.crswap$/.test(n)) { try { const f = await h.getFile(); aus[q] = f.size + '|' + f.lastModified; } catch (e) { /* gerade ersetzt */ } } } }; await geh(await __arch(), ''); return aus; };`;
  const liesText = p => page.evaluate(x => __lies(x), p);
  const lies = async p => JSON.parse(await liesText(p));
  const ruhig = () => page.waitForFunction(() => window.LagerKit && !window.LagerKit.schreibt && (!window.LagerKit.S.lauf || window.LagerKit.S.lauf.fertigAm) && (!window.LagerKit.S.p || (!window.LagerKit.S.p.aus.size && !window.LagerKit.S.p.speichert)) && !(window.LagerKit.S.inv && window.LagerKit.S.inv.speichert), null, { timeout: 20000 });
  const scan = async code => { await page.keyboard.type(code, { delay: 8 }); await page.keyboard.press('Enter'); };
  const toastText = () => page.textContent('#toast');
  /** Meldung abwarten (die App arbeitet nach dem Klick weiter – auf langsamen Rechnern dauert das) */
  const toastWarte = async re => { try { await page.waitForFunction(q => new RegExp(q[0], q[1]).test(document.querySelector('#toast').textContent), [re.source, re.flags], { timeout: 15000 }); } catch (e) { assert.match(await toastText(), re); } };
  const blitzR2 = () => page.waitForFunction(() => { const i = document.querySelector('tr.blitz input[data-feld="was"]'); return i && i.value === 'Brandschutt (Blanko)'; });
  const gehe = async hash => { await page.goto(url + (hash ? '#' + hash : '')); await page.evaluate(H); await page.waitForSelector('#fussIn > *'); await ruhig(); };
  const mehr = async aktion => { await page.click('#mehr summary'); await page.click(`#mehr [data-aktion="${aktion.a}"]${aktion.w ? `[data-wert="${aktion.w}"]` : ''}`); };
  try {
    await page.goto(url);
    await page.evaluate(H);
    const archiv = D.archiv();
    // Zusätzlich im neuen Projekt: eine fällige Rückstellprobe mit „Asbest nachgewiesen“ (Rest von Probe 4, ResultKit P4), Frist von Hand
    archiv[LAGER.neu] = JSON.stringify(D.lager(D.P.neu, [D.probe({ id: 'n-r1', nr: 1, code: 'LK260612R001', was: 'Fliesenkleber', ort: 'Haus A, EG Bad, Boden', art: 'Materialprobe', probenahme: '2026-11-18', von: 'Dr. Pr', platz: 'pb3',
      nrFest: { am: '2026-11-18T10:00:00Z', anlass: 'Etikett' }, quelle: { app: 'LabelKit', liste: 'asbestProben', id: 1, nr: 4, label: 'P4', titel: 'Probe 4', art: 'Asbest' },
      fristen: [{ id: 'fh', bis: '2026-11-10', wer: 'Dr. Pr', warum: 'Auftraggeber verzichtet', am: '2026-11-19T10:00:00.000Z', art: 'hand' }] })]), null, 1);
    for (const [pfad, inhalt] of Object.entries(archiv)) await page.evaluate(([p, b]) => __schreib(p, b), [pfad, inhalt == null ? '' : b64(inhalt)]);
    const vorher = await page.evaluate(() => __liste());

    /* ---------- 1. Start, Erinnerung „Inventur fällig“ ---------- */
    schritt('Start, Erinnerung „Inventur fällig“');
    await page.reload(); await page.evaluate(H);
    await page.click('[data-zugang="anlegen"]'); await page.waitForSelector('h1:has-text("Rückstellproben im Büro")'); await ruhig();
    await page.evaluate(b => __schreib('_LagerKit/Einstellungen.json', b), b64(JSON.stringify(D.EINST)));
    await gehe(''); await page.click('#btnNeu'); await ruhig();
    await page.selectOption('#wer', 'Tst');
    let erinnerung = await page.textContent('#invErinnerung');
    assert.match(erinnerung, /Inventur fällig: Regal A · Fach 1, Regal A · Fach 2, Regal B · Fach 3 – Regal durchgehen →/, 'seit Juli dort, nie geprüft');
    assert.match(await page.textContent('.kacheln'), /Regal A · Fach 1\s*2 Proben · 2 fällig\s*noch nie geprüft · Inventur fällig/);
    assert.equal(await page.$eval('#invErinnerung', e => getComputedStyle(e).position), 'static', 'ruhig: springt nicht auf, sperrt nichts');
    await bild('1-erinnerung');
    await page.click('#invErinnerung [data-aktion="inventur-spaeter"]');
    assert.equal(await page.$('#invErinnerung'), null, '„später“ blendet aus');
    await gehe('');
    assert.equal(await page.$('#invErinnerung'), null, 'auch nach dem Neuladen (zwei Wochen an diesem PC)');
    assert.equal(await page.evaluate(() => localStorage.getItem('lagerkit-inventur-spaeter')), '2026-12-05');
    await page.evaluate(() => localStorage.removeItem('lagerkit-inventur-spaeter'));

    /* ---------- 2. Blanko-Etiketten: reservieren, drucken, Maße ---------- */
    schritt('Blanko-Etiketten drucken');
    await gehe('');
    await mehr({ a: 'blanko-drucken' });
    await page.waitForSelector('dialog[open] >> text=Blanko-Etiketten drucken');
    await page.fill('dialog[open] input[name="n"]', '3');
    const [druck] = await Promise.all([context.waitForEvent('page'), page.click('#dlgOk')]);
    await druck.waitForSelector('.etk'); await ruhig();
    let einst = await lies('_LagerKit/Einstellungen.json');
    assert.deepEqual(einst.blankoBereiche.map(b => [b.von, b.bis, b.wer]), [[1, 3, 'Tst']], 'Bereich reserviert, bevor gedruckt wurde');
    assert.equal(einst.plaetze.length, 4, 'Regalplätze unverändert');
    const blanko = await druck.$$eval('.etk:not(.leer)', e => e.map(x => x.textContent.replace(/\s+/g, ' ')));
    assert.equal(blanko.length, 3);
    assert.match(blanko[0], /RÜCKSTELLPROBE · NICHT ANS LABOR.*LKB0001.*LKB0001.*Projekt.*Was.*Datum.*Blanko-Etikett · SV Dr\. Schiffers.*52146 Würselen/);
    assert.match(blanko[2], /LKB0003/);
    if (BILDER) await druck.screenshot({ path: path.join(BILDER, '020-2-blanko-etiketten.png'), fullPage: true });
    const mass = await druck.evaluate(() => [...document.querySelectorAll('.etk:not(.leer)')].map(e => {
      const r = e.getBoundingClientRect(), q = e.querySelector('.etk-qr svg').getBoundingClientRect(), mm = px => px / 96 * 25.4;
      const linien = [...e.querySelectorAll('.etk-linie')].map(l => ({ h: mm(l.getBoundingClientRect().height), pt: parseFloat(getComputedStyle(l).fontSize) * 0.75, text: l.textContent }));
      return { w: mm(r.width), h: mm(r.height), qr: mm(q.width), ueber: mm(Math.max(...[...e.querySelectorAll('*')].map(x => x.getBoundingClientRect().bottom)) - r.bottom),
        rechts: mm(Math.max(...[...e.querySelectorAll('*')].map(x => x.getBoundingClientRect().right)) - r.right), linien, code: e.querySelector('.etk-code').textContent,
        abgeschnitten: [...e.querySelectorAll('.etk-absender,.etk-code')].some(x => x.scrollWidth > x.clientWidth + 1) };
    }));
    for (const m of mass) {
      assert.ok(Math.abs(m.w - 97) < 0.2 && Math.abs(m.h - 42.3) < 0.2, '97 × 42,3 mm: ' + m.w + ' × ' + m.h);
      assert.ok(Math.abs(m.qr - 18) < 0.2, 'QR 18 mm'); assert.ok(m.ueber <= 0.05 && m.rechts <= 0.05, 'nichts ragt heraus');
      assert.deepEqual(m.linien.map(l => l.text), ['Projekt', 'Was', 'Datum']);
      assert.ok(m.linien.every(l => l.h >= 7 && l.pt >= 7.99), 'drei Schreiblinien je mind. 7 mm hoch, Text mind. 8 pt: ' + JSON.stringify(m.linien));
    }
    assert.deepEqual(mass.map(m => m.code), ['LKB0001', 'LKB0002', 'LKB0003'], 'Klarschrift unter dem QR');
    assert.ok(mass.every(m => !m.abgeschnitten), 'Code und Absender werden nicht gekürzt');
    await druck.close();
    // Druck abgebrochen (Fenster einfach zu): der Bereich bleibt reserviert, der nächste beginnt dahinter
    await mehr({ a: 'blanko-drucken' });
    await page.fill('dialog[open] input[name="n"]', '2');
    const [druck2] = await Promise.all([context.waitForEvent('page'), page.click('#dlgOk')]);
    await druck2.waitForSelector('.etk'); await druck2.close(); await ruhig();
    einst = await lies('_LagerKit/Einstellungen.json');
    assert.deepEqual(einst.blankoBereiche.map(b => [b.von, b.bis]), [[1, 3], [4, 5]], 'reservierter Bereich kommt nie wieder');
    await toastWarte(/LKB0004 bis LKB0005 reserviert/);

    /* ---------- 3. Freies Blanko-Etikett scannen → Probe im Projekt; über beide Codes finden ---------- */
    schritt('Blanko scannen → Probe im Projekt');
    await page.focus('h1'); await scan('LKB0002');
    await page.waitForSelector('dialog[open] >> text=Neue Rückstellprobe mit diesem Etikett');
    await page.click('dialog[open] [data-bf="projekt"]');
    await page.fill('#pwSuche', '26.0612');
    await page.click(`[data-pw="${D.P.neu}"]`);
    await page.waitForSelector('h1:has-text("Rückstellproben in diesem Projekt")'); await ruhig();
    await toastWarte(/LKB0002 ist jetzt 26\.0612 R2/);
    const neueZeile = page.locator('tr.gewaehlt');
    assert.match(await neueZeile.textContent(), /R2/);
    assert.match(await page.textContent('#detail'), /Blanko-Etikett LKB0002/);
    await neueZeile.locator('input[data-feld="was"]').fill('Brandschutt (Blanko)');
    await neueZeile.locator('input[data-feld="ort"]').fill('Haus A, KG Flur, Boden');
    await neueZeile.locator('input[data-feld="ort"]').press('Tab');
    await neueZeile.locator('select[data-feld="platz"]').selectOption('pa1');
    await ruhig();
    let datei = await lies(LAGER.neu), r2 = datei.proben.find(p => p.nr === 2);
    assert.deepEqual([r2.was, r2.platz, r2.codes.map(c => [c.code, c.art, c.wer])], ['Brandschutt (Blanko)', 'pa1', [['LKB0002', 'blanko', 'Tst']]]);
    assert.ok(!r2.nrFest, 'ein LagerKit-Etikett ist freiwillig');
    einst = await lies('_LagerKit/Einstellungen.json');
    assert.deepEqual(einst.blankoZuordnung.map(z => [z.id, z.ordner, z.probe, z.wer]), [['LKB0002', D.P.neu, r2.id, 'Tst']]);
    for (const code of ['LKB0002', 'LK260612R002']) {
      await gehe(''); await page.focus('h1'); await scan(code);
      await blitzR2(); await ruhig();
    }
    assert.match(await page.textContent('tr.blitz'), /R2/, 'über beide Codes dieselbe Probe');
    await gehe(''); await page.fill('#suche', 'LKB0002');
    assert.match(await page.textContent('main'), /Brandschutt \(Blanko\)/, 'auch die Suche findet den Blanko-Code');
    await page.fill('#suche', '');

    /* ---------- 4. Freies Blanko-Etikett → Herkunft unklar ---------- */
    schritt('Blanko scannen → Herkunft unklar');
    await page.focus('h1'); await scan('LKB0003');
    await page.click('dialog[open] [data-bf="unklar"]');
    await page.fill('dialog[open] input[name="was"]', 'Asche im Eimer');
    await page.fill('dialog[open] input[name="gefunden"]', 'Regal A oben, Karton');
    await page.selectOption('dialog[open] select[name="platz"]', 'pa1');
    await page.click('#dlgOk'); await ruhig();
    await toastWarte(/LKB0003 ist jetzt U1/);
    let ohne = await lies('_LagerKit/Ohne-Projekt.json');
    assert.deepEqual([ohne.proben[0].nr, ohne.proben[0].codes[0].code, ohne.proben[0].platz, ohne.proben[0].probenahmeUnbekannt], [1, 'LKB0003', 'pa1', true]);
    await page.focus('h1'); await scan('LKB0003');
    await page.waitForSelector('dialog[open] >> text=U1 · Asche im Eimer');
    await page.click('dialog[open] [value="abbrechen"]');
    // LKB0002 ein zweites Mal: nie ein zweites Zuordnen – öffnet die Probe
    await page.focus('h1'); await scan('LKB0002'); await blitzR2(); await ruhig();
    assert.equal((await lies('_LagerKit/Einstellungen.json')).blankoZuordnung.length, 2);

    /* ---------- 5. Fällige einsammeln mit „wohin“ → fester Beleg ---------- */
    schritt('Einsammeln mit „wohin“ → Beleg');
    await gehe('ansicht=einsammeln');
    await page.waitForSelector('h1:has-text("Fällige Proben einsammeln · 5")'); await ruhig();
    const kNeu = D.P.neu + '|n-r1', kR1 = D.P.bericht + '|b-r1', kR3 = D.P.bericht + '|b-r3', kO = D.P.ohne + '|o-r1';
    assert.equal(await page.inputValue(`select[data-wohin="${kNeu}"]`), 'Asbestabfall', '„Asbest nachgewiesen“ → vorbelegt Asbestabfall');
    assert.equal(await page.inputValue(`select[data-wohin="${kR1}"]`), '', 'sonst leer (freiwillig)');
    await page.focus('h1'); await scan('LK260571R001');
    await page.waitForFunction(() => window.LagerKit.S.sammel.marks.size === 1);
    await page.click(`[data-aktion="mark"][data-key="${kNeu}"][data-wert="entsorgt"]`);
    await page.click(`[data-aktion="mark"][data-key="${kO}"][data-wert="nichtGefunden"]`);
    await page.selectOption('#wohinAlle', 'Restmüll'); await page.click('[data-aktion="wohin-alle"]');
    assert.equal(await page.inputValue(`select[data-wohin="${kR1}"]`), 'Restmüll', 'für alle markierten');
    await page.selectOption(`select[data-wohin="${kNeu}"]`, 'Sonstiges');
    await page.fill(`input[data-wohin-frei="${kNeu}"]`, 'Big Bag, Entsorger Muster');
    // „behalten“ für R3: verlängern – kommt als „behalten“ in den Beleg
    await page.click(`[data-aktion="behalten"][data-key="${kR3}"]`);
    await page.fill('dialog[open] input[name="bis"]', '2027-03-31'); await page.fill('dialog[open] textarea[name="warum"]', 'Rückfrage Versicherer');
    await page.click('#dlgOk'); await ruhig();
    await page.waitForSelector('h1:has-text("Fällige Proben einsammeln · 4")');
    const [liste] = await Promise.all([context.waitForEvent('page'), page.click('[data-aktion="liste-drucken"]')]);
    await liste.waitForLoadState();
    assert.match(await liste.textContent('body'), /wohin.*Restmüll/s); await liste.close();
    await bild('5-einsammeln');
    await page.click('[data-aktion="eintragen"]'); await ruhig();
    await toastWarte(/3 Proben eingetragen von Tim Test.*fester Beleg/);
    const r1 = (await lies(LAGER.bericht)).proben.find(p => p.id === 'b-r1'), nr1 = (await lies(LAGER.neu)).proben.find(p => p.id === 'n-r1'), o1 = (await lies(LAGER.ohne)).proben[0];
    assert.deepEqual([r1.ereignisse.at(-1).art, r1.ereignisse.at(-1).wohin, r1.wohin], ['entsorgt', 'Restmüll', 'Restmüll']);
    assert.deepEqual([nr1.ereignisse.at(-1).wohin, nr1.wohin], ['Sonstiges: Big Bag, Entsorger Muster', 'Sonstiges: Big Bag, Entsorger Muster']);
    assert.deepEqual([o1.ereignisse.at(-1).art, o1.ereignisse.at(-1).wohin, o1.wohin], ['nichtGefunden', undefined, ''], '„nicht gefunden“ ohne wohin');
    const belegName = '_LagerKit/Entsorgungslisten/2026-11-21_Tst_1.json', belegText = await liesText(belegName);
    const beleg = JSON.parse(belegText);
    assert.equal(beleg.format, 'spektron-lagerkit-entsorgungsliste'); assert.equal(beleg.wer, 'Tst');
    assert.deepEqual(beleg.proben.map(z => [z.titel, z.ergebnis, z.wohin, z.eingetragen]).sort(), [
      ['R1', 'entsorgt', 'Restmüll', true], ['R1', 'entsorgt', 'Sonstiges: Big Bag, Entsorger Muster', true], ['R1', 'nichtGefunden', '', true], ['R2', 'gesperrt', '', false], ['R3', 'behalten', '', true]].sort(),
      'genau, was die Liste zeigte – auch gesperrt und behalten');
    assert.match(beleg.proben.find(z => z.ergebnis === 'behalten').verlaengertBis, /2027-03-31/);
    assert.ok(beleg.proben.find(z => z.wohin.startsWith('Sonstiges')).hinweise.some(h => /Asbest nachgewiesen/.test(h)));
    // unter „Entsorgt“ wieder anzeigen und drucken
    await gehe('');
    await page.click('details.klapp:has(.belege) > summary');
    assert.match(await page.textContent('.belege'), /Liste vom 21\.11\.2026 · Tst · 3 Proben/);
    await page.click('[data-aktion="beleg-zeigen"]');
    await page.waitForSelector('dialog[open] >> text=Entsorgungsliste vom 21.11.2026');
    const dlgText = await page.textContent('dialog[open]');
    assert.match(dlgText, /Big Bag, Entsorger Muster/); assert.match(dlgText, /gesperrt – nicht entsorgt/); assert.match(dlgText, /verlängert bis 31\.03\.2027/); assert.match(dlgText, /Als PDF speichern/);
    const [bdruck] = await Promise.all([context.waitForEvent('page'), page.click('#dlgOk')]);
    await bdruck.waitForLoadState();
    assert.match(await bdruck.textContent('body'), /Entsorgungsliste Rückstellproben.*fester Beleg.*2026-11-21_Tst_1\.json/s);
    if (BILDER) await bdruck.screenshot({ path: path.join(BILDER, '020-5-beleg-druck.png'), fullPage: true });
    await bdruck.close(); await ruhig();
    assert.equal(await liesText(belegName), belegText, 'Anzeigen und Drucken ändern den Beleg nicht');

    /* ---------- 6. Inventur: Scanner-Stoß bucht nie um ---------- */
    schritt('Inventur mit Scanner-Stoß');
    await gehe('ansicht=platz&id=pa1');
    await page.click('[data-aktion="platz-pruefen"]');
    await page.waitForSelector('.pruefen >> text=Prüfen: Regal A · Fach 1');
    assert.equal(await page.$('.einraeumen'), null, 'nicht „Einräumen“');
    assert.notEqual(await page.$eval('.pruefen', e => getComputedStyle(e).backgroundColor), 'rgb(76, 99, 34)', 'andere Farbe als „Einräumen“ (#4c6322)');
    const vorScan = {}; for (const [k, p] of Object.entries(LAGER)) vorScan[k] = await liesText(p);
    const ohneVor = await liesText('_LagerKit/Ohne-Projekt.json');
    await page.focus('h1');
    for (const c of ['LK260571R003', 'LKB0002', 'LK260571R001', 'LK260590R001', 'LK260571R003', 'LK260612R099', 'LKB0005']) await scan(c);   // Stoß, ohne Pause
    await page.waitForFunction(() => window.LagerKit.S.inv.aktiv.scans.length === 6);
    await ruhig();
    await bild('6-inventur-pruefen');
    assert.match(await page.textContent('main'), /2 von 3 gescannt/);
    for (const [k, p] of Object.entries(LAGER)) assert.equal(await liesText(p), vorScan[k], 'Prüfen bucht nie um: ' + k);
    assert.equal(await liesText('_LagerKit/Ohne-Projekt.json'), ohneVor);
    await page.click('.pruefen [data-aktion="platz-fertig"]'); await ruhig();
    for (const [k, p] of Object.entries(LAGER)) assert.equal(await liesText(p), vorScan[k], 'auch „Platz fertig“ ändert keine Probe: ' + k);
    const karte = await page.textContent('main section.karte:first-of-type');
    assert.match(karte, /✓ da · 2.*fehlt – sollte hier sein, nicht gescannt · 1.*U1.*woanders gebucht – liegt aber hier · 1.*26\.0590 R1.*laut LagerKit auf Regal B · Fach 3.*als entsorgt eingetragen – liegt aber hier · 1.*26\.0571 R1.*unbekannter Code · 2.*LK260612R099.*LKB0005.*freies Blanko-Etikett/s);
    let inv = await lies('_LagerKit/Inventuren/2026-11-21_Tst.json');
    assert.equal(inv.format, 'spektron-lagerkit-inventur');
    assert.deepEqual([inv.pruefungen.length, inv.pruefungen[0].platz, inv.pruefungen[0].da.map(x => x.titel).sort(), inv.pruefungen[0].fehlt.map(x => x.titel)], [1, 'pa1', ['R2', 'R3'], ['U1']]);
    await bild('6-inventur-ergebnis');
    // Korrekturen: je ein Klick, mit Namen
    await page.click(`[data-aktion="inv-korr"][data-art="umbuchen"][data-key="${kO}"]`); await ruhig();
    await page.click(`[data-aktion="inv-korr"][data-art="zurueck"][data-key="${kR1}"]`); await ruhig();
    await page.click('[data-aktion="inv-korr"][data-art="nichtGefunden"]'); await ruhig();
    assert.match(await page.textContent('main section.karte:first-of-type'), /✓ hierher umgebucht \(Tst\).*✓ Eintrag „entsorgt“ zurückgenommen \(Tst\)/s);
    const o1b = (await lies(LAGER.ohne)).proben[0], r1b = (await lies(LAGER.bericht)).proben.find(p => p.id === 'b-r1');
    assert.deepEqual([o1b.platz, o1b.plaetze.at(-1).von, o1b.plaetze.at(-1).nach, o1b.plaetze.at(-1).wer], ['pa1', 'pb3', 'pa1', 'Tst']);
    assert.deepEqual([r1b.ereignisse.at(-1).art, r1b.ereignisse.at(-1).wer], ['entsorgtZurueck', 'Tst']);
    ohne = await lies('_LagerKit/Ohne-Projekt.json');
    assert.deepEqual(ohne.proben[0].ereignisse.map(e => [e.art, e.bei, e.wer]), [['nichtGefunden', 'inventur', 'Tst']]);
    inv = await lies('_LagerKit/Inventuren/2026-11-21_Tst.json');
    assert.deepEqual(inv.pruefungen[0].korrekturen.map(k => [k.art, k.wer, k.erledigt]), [['umbuchen', 'Tst', true], ['zurueck', 'Tst', true], ['nichtGefunden', 'Tst', true]]);
    // nächster Platz per Platz-Scan, nichts gescannt → „fehlt“
    await page.focus('h1'); await scan('LKP0003');
    await page.waitForSelector('.pruefen >> text=Prüfen: Regal B · Fach 3');
    await page.click('.pruefen [data-aktion="platz-fertig"]'); await ruhig();
    inv = await lies('_LagerKit/Inventuren/2026-11-21_Tst.json');
    assert.deepEqual(inv.pruefungen.map(p => [p.platz, p.fehlt.map(x => x.titel)]), [['pa1', ['U1']], ['pb3', ['R1']]], 'Regal B · Fach 3: 26.0601 R1 nicht gescannt (26.0612 R1 ist entsorgt, 26.0590 R1 umgebucht)');
    const [idruck] = await Promise.all([context.waitForEvent('page'), page.click('[data-aktion="inv-drucken"]')]);
    await idruck.waitForLoadState();
    assert.match(await idruck.textContent('body'), /Inventur Rückstellproben.*Regal A · Fach 1.*hierher umgebucht.*Regal B · Fach 3/s);
    assert.equal(await idruck.$$eval('button', b => b.filter(x => getComputedStyle(x).display !== 'none').length), 0, 'beim Drucken keine Knöpfe');
    await idruck.close();
    await page.click('[data-aktion="inv-ende"]'); await page.waitForSelector('#suche'); await ruhig();
    assert.match(await page.textContent('.kacheln'), /Regal A · Fach 1[^]*?zuletzt geprüft 11\/2026/);
    erinnerung = await page.textContent('#invErinnerung');
    assert.match(erinnerung, /Inventur fällig: Regal A · Fach 2 –/, 'geprüfte Plätze sind aus der Erinnerung');
    await gehe('ansicht=platz&id=pa1');
    assert.match(await page.textContent('main'), /Zuletzt geprüft 11\/2026/);

    /* ---------- 7. Zweites Eintragen: neuer Beleg, der erste bleibt ---------- */
    schritt('Zweiter Beleg');
    await gehe('ansicht=einsammeln'); await page.waitForSelector('.sk');
    await page.click(`[data-aktion="mark"][data-key="${kR1}"][data-wert="entsorgt"]`);
    await page.click('[data-aktion="eintragen"]'); await ruhig();
    assert.ok(await liesText('_LagerKit/Entsorgungslisten/2026-11-21_Tst_2.json'), 'zweiter Beleg');
    assert.equal(await liesText(belegName), belegText, 'der erste bleibt unverändert');

    /* ---------- 8. Nur eigene Dateien ---------- */
    schritt('Nur eigene Dateien');
    const nachher = await page.evaluate(() => __liste());
    for (const [k, v] of Object.entries(vorher)) if (!k.endsWith('/')) assert.ok(k.includes('/_Spektron/LagerKit/') || nachher[k] === v, 'geändert: ' + k);
    const neuDa = Object.keys(nachher).filter(k => !(k in vorher)).sort();
    for (const k of neuDa) assert.ok(k.startsWith('_LagerKit/') || /\/_Spektron\/(LagerKit\/.*)?$/.test(k) || k.endsWith('/_Spektron/BITTE NICHT ANFASSEN.txt'), 'neu angelegt: ' + k);
    assert.ok(neuDa.includes('_LagerKit/Inventuren/') && neuDa.includes('_LagerKit/Entsorgungslisten/'));
    assert.deepEqual(fehler, [], 'keine Fehler in der Konsole');
    console.log('Browser 0.2.0: alle Schritte grün');
  } catch (e) {
    await bild('fehler');
    console.error(e); console.error('Konsole:', fehler.join('\n')); process.exitCode = 1;
  } finally { await browser.close(); server.close(); }
})();
