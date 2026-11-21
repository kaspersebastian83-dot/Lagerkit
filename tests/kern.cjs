// LagerKit-Kern in Node: Frist, Nummern, Codes, QR, Zusammenführen, Index. node tests/kern.cjs
// (jsQR nur zum Prüfen, nicht in der App: in CI installiert, lokal JSQR=<Pfad> oder NODE_PATH; ohne jsQR wird der Lesetest übersprungen,
// mit LAGERKIT_QR_PFLICHT=1 nicht.)
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const K = require('./kern-laden.cjs');
let n = 0; const t = (name, fn) => { fn(); n++; };
const at = async (name, fn) => { await fn(); n++; };

(async () => {
/* ---------- Frist (Plan E6) ---------- */
t('Monatsende inkl. Februar und Schaltjahr', () => {
  assert.equal(K.fristAb('2026-11-18', 3), '2027-02-28');
  assert.equal(K.fristAb('2027-11-30', 3), '2028-02-29', 'Schaltjahr 2028');
  assert.equal(K.fristAb('2027-11-01', 3), '2028-02-29');
  assert.equal(K.fristAb('2026-01-31', 1), '2026-02-28');
  assert.equal(K.fristAb('2026-10-31', 3), '2027-01-31', 'über den Jahreswechsel');
  assert.equal(K.fristAb('2026-12-15', 12), '2027-12-31');
  assert.equal(K.fristAb('kein Datum', 3), '');
});
const probe = o => Object.assign({ id: 'x', nr: 1, probenahme: '2026-07-14', erfasst: '2026-07-14T08:00:00Z', fristen: [], sperren: [], ereignisse: [] }, o);
t('ohne Bericht: vorläufig ab Probenahme, mit Hinweis wenn fällig', () => {
  const f = K.frist(probe(), { monate: 3, uebergabe: '' });
  assert.deepEqual([f.bis, f.quelle], ['2026-10-31', 'vorlaeufig']);
  const z = K.zustand(probe(), { monate: 3 }, '2026-11-21');
  assert.equal(z.status, 'faellig'); assert.equal(z.keinBericht, true);
  assert.equal(K.zustand(probe(), { monate: 3 }, '2026-10-31').status, 'bald', 'am letzten Tag noch nicht fällig');
  assert.equal(K.zustand(probe(), { monate: 3 }, '2026-09-30').status, 'lager');
});
t('ab Übergabe des Berichts, bis Monatsende', () => {
  const f = K.frist(probe(), { monate: 3, uebergabe: '2026-08-20' });
  assert.deepEqual([f.bis, f.quelle], ['2026-11-30', 'bericht']);
  assert.equal(K.zustand(probe(), { monate: 3, uebergabe: '2026-08-20' }, '2026-11-21').keinBericht, false);
});
t('der Bericht schiebt nur nach hinten', () => {
  // Probe nach dem Bericht genommen (Nachbeprobung): bleibt bei Probenahme + 3
  const f = K.frist(probe({ probenahme: '2026-11-18' }), { monate: 3, uebergabe: '2026-09-01' });
  assert.equal(f.bis, '2027-02-28'); assert.equal(f.quelle, 'bericht');
});
t('von Hand / verlängert gilt vor der Regel', () => {
  const p = probe({ fristen: [{ id: 'f1', bis: '2027-06-30', wer: 'Tst', warum: 'Rückfrage', am: '2026-11-01T10:00:00Z', art: 'verlaengert' }] });
  assert.deepEqual([K.frist(p, { monate: 3, uebergabe: '2026-08-20' }).bis, K.frist(p, { monate: 3 }).quelle], ['2027-06-30', 'hand']);
  const q = probe({ fristen: [...p.fristen, { id: 'f2', bis: '2026-12-31', wer: 'Mbe', warum: 'doch früher', am: '2026-11-05T10:00:00Z', art: 'hand' }] });
  assert.equal(K.frist(q, { monate: 3 }).bis, '2026-12-31', 'die jüngste Eintragung gilt, auch wenn früher');
  assert.equal(K.zustand(q, { monate: 3 }, '2027-01-02').keinBericht, false, 'von Hand: Mensch hat entschieden, kein Hinweis');
});
t('Datum unbekannt (Aufräumtag): Frist ab dem Erfassen', () => {
  assert.equal(K.frist(probe({ probenahme: '', probenahmeUnbekannt: true, erfasst: '2026-11-21T09:00:00Z' }), { monate: 3 }).bis, '2027-02-28');
});
t('Übergabe: zuletzt übergebene Mitteilung, Zurückholen, alte Übergaben', () => {
  const a = [{ id: 'a1', art: 'gutachten', erstellt: '2026-08-20T10:00:00Z' }, { id: 'a2', art: 'gutachten', erstellt: '2026-10-02T10:00:00Z' }, { id: 'e1', art: 'eigene', erstellt: '2026-11-01T10:00:00Z' }];
  assert.equal(K.uebergabeTag(a, []), '2026-10-02', 'mehrere Mitteilungen: die zuletzt übergebene; eigene Aufgaben zählen nicht');
  const zurueck = [{ id: 'v1', aufgabe: 'a2', schritt: 'geloescht', wert: true, zeit: '2026-10-03T10:00:00Z' }];
  assert.equal(K.uebergabeTag(a, zurueck), '2026-08-20', 'zurückgeholt: die vorige zählt');
  assert.equal(K.uebergabeTag(a.slice(1, 2), zurueck), '', 'einzige Mitteilung zurückgeholt: wieder ohne Bericht');
  assert.equal(K.uebergabeTag(a, [...zurueck, { id: 'v2', aufgabe: 'a2', schritt: 'geloescht', wert: false, zeit: '2026-10-04T10:00:00Z' }]), '2026-10-02', 'Zurückholen rückgängig');
  assert.equal(K.uebergabeTag(a, [{ id: 'v3', aufgabe: 'a2', schritt: 'zurueck', wert: true, zeit: '2026-10-05T10:00:00Z' }]), '2026-08-20', 'geplant: vom Büro zurückgegeben');
  assert.equal(K.uebergabeTag([{ id: 'a', art: 'gutachten', erstellt: '2026-08-20T22:30:00Z' }], []), '2026-08-21', 'Kalendertag in Würselen');
  const alt = K.altUebergabeLesen(JSON.stringify({ format: 'spektron-buero', version: 1, id: 'u-1234567', created: '2026-05-01T08:00:00Z', content: {} }),
    [JSON.stringify({ format: 'spektron-buero', id: 'r1', orderId: 'u-1234567', type: 'withdraw', at: '2026-05-02T08:00:00Z', payload: {} })], 'u-1234567');
  assert.equal(K.uebergabeTag([alt.aufgabe], alt.vermerke), '', 'frühere Büroübergabe zurückgezogen');
  assert.deepEqual(K.bueroAufgabeLesen('{"format":"spektron-buerokit","typ":"aufgabe","id":"a1","art":"gutachten","erstellt":"2026-08-20T10:00:00Z"}', 'a1').aufgabe.art, 'gutachten');
  assert.equal(K.bueroAufgabeLesen('{"format":"spektron-buerokit","typ":"aufgabe","id":"a1"}', 'anders'), null, 'Datei-id muss passen');
});

/* ---------- Nummern ---------- */
t('Nummern: fest beim Druck, stornieren statt löschen, nie wiederverwenden', () => {
  const am = '2026-11-21T09:00:00.000Z', p = (nr, o) => Object.assign({ id: 'p' + nr, nr, erfasst: am, was: '', ort: '', fristen: [], sperren: [] }, o);
  let l = [p(1, { was: 'Asche' }), p(2), p(3, { was: 'Putz' })];
  assert.equal(K.loeschen(l, 'p2', '', '', am), 'weg', 'ganz leere Zeile darf weg');
  assert.deepEqual(K.da(l).map(x => [x.id, x.nr]), [['p1', 1], ['p3', 2]], 'ohne feste Nummer rücken die übrigen nach (wie LabelKit)');
  assert.equal(K.nummernFestlegen(l, ['p1'], 'Etikett', am), 1);
  assert.equal(K.loeschen(l, 'p1', '', '', am), 'Bitte oben bei „Du bist“ deinen Namen wählen.');
  assert.equal(K.loeschen(l, 'p1', 'Tst', 'doppelt', am), 'storniert');
  assert.ok(l[0].storniert && l[0].nrFest);
  assert.equal(K.naechsteNr(l), 3, 'stornierte zählt mit – R1 kommt nie wieder');
  l.push(p(3, { id: 'p4' })); assert.equal(K.loeschen(l, 'p4', '', '', am), 'weg');
  assert.deepEqual(K.da(l).map(x => x.nr), [1, 2], 'mit fester Nummer im Projekt: nichts rückt nach');
  assert.equal(K.loeschen(l, 'p3', 'Tst', '', am), 'storniert', 'nicht leer: stornieren, auch ungedruckt');
  assert.equal(K.ganzLeer(p(9, { quelle: { liste: 'proben', id: 1 } })), false, 'aus LabelKit übernommen ist nie leer');
});
t('Nummern: zwei PCs legen gleichzeitig dieselbe Nummer an', () => {
  const l = [{ id: 'a', nr: 3, erfasst: '2026-11-21T09:00:00Z', nrFest: { am: 'x' } }, { id: 'b', nr: 3, erfasst: '2026-11-21T09:00:01Z' }, { id: 'c', nr: 2, erfasst: '2026-11-21T08:00:00Z' }];
  assert.deepEqual(K.nummernPruefen(l), []);
  assert.deepEqual(l.map(x => x.nr), [3, 4, 2], 'die nicht feste bekommt die nächste freie');
});

/* ---------- Codes, Tastatur-Layout, QR ---------- */
t('Code ↔ Projekt/R-Nummer in beide Richtungen', () => {
  for (const [nr, r, code] of [['26.0612', 2, 'LK260612R002'], ['22.00114', 17, 'LK2200114R017'], ['26.0560', 1000, 'LK260560R1000']]) {
    assert.equal(K.rCode(nr, r), code);
    assert.deepEqual(K.codeLesen(code), { art: 'R', projekt: nr, nr: r, code });
  }
  assert.equal(K.uCode(2), 'LKU0002'); assert.deepEqual(K.codeLesen('LKU0002'), { art: 'U', nr: 2, code: 'LKU0002' });
  assert.equal(K.pCode(1), 'LKP0001'); assert.deepEqual(K.codeLesen('LKP0001'), { art: 'P', nr: 1, code: 'LKP0001' });
  assert.ok(/^[A-Z0-9]+$/.test(K.rCode('26.0612', 2)), 'nur Buchstaben und Ziffern');
  assert.deepEqual(K.sucheLesen('26.0612 R2'), K.codeLesen('LK260612R002'), 'Suche von Hand = Scan');
  assert.deepEqual(K.sucheLesen('26.0612-r 2'), K.codeLesen('LK260612R002'));
  assert.deepEqual(K.sucheLesen('u2'), K.codeLesen('LKU0002'));
  assert.equal(K.sucheLesen('Brandschutt'), null);
});
// Scanner mit US-Layout am Terminal mit DE-Layout (und umgekehrt): dieselbe Taste, anderes Zeichen
const US_DE = { y: 'z', z: 'y', Y: 'Z', Z: 'Y', '-': 'ß', '/': '-', ':': 'Ö', ';': 'ö', '#': '§', '[': 'ü', ']': '+', '?': '_', '&': '/', '_': '?', '=': '´', '(': ')', ')': '=', '*': '(', '@': '"', '"': 'Ä', "'": 'ä' };
const DE_US = Object.fromEntries(Object.entries(US_DE).map(([a, b]) => [b, a]));
const tippen = (text, karte) => [...text].map(c => karte[c] || c).join('');
t('verstümmelte Eingabe: US/DE vertauscht, Groß/klein, Zeichen drumherum', () => {
  for (const code of ['LK260612R002', 'LKU0002', 'LKP0001', 'LK2200114R017']) {
    assert.equal(tippen(code, US_DE), code, 'US-Scanner an DE-Terminal: unverändert ' + code);
    assert.equal(tippen(code, DE_US), code, 'DE-Scanner an US-Terminal: unverändert ' + code);
    for (const roh of [tippen(']Q1' + code, US_DE), code.toLowerCase(), ' ' + code + '\r\n', 'xx' + code + 'yy', tippen('#' + code + '#', US_DE)])
      assert.equal(K.codeLesen(roh).code, code, 'gefunden in „' + roh + '“');
  }
  const link = 'https://x.de/#p=26.0612&r=2';
  assert.notEqual(tippen(link, US_DE), link, 'ein Link käme verstümmelt an – deshalb kein Link im Code');
  assert.equal(K.codeLesen('LK26.0612R2'), null, 'Punkt gehört nicht in den Code');
});
let jsQR = null;
try { jsQR = require(process.env.JSQR || 'jsqr'); } catch (e) { assert.ok(!process.env.LAGERKIT_QR_PFLICHT, 'jsQR fehlt – QR nicht gelesen'); }
t('QR (SVG) lässt sich wieder lesen', () => {
  for (const code of ['LK260612R002', 'LKU0002', 'LKP0001', 'LK2200114R017', 'LK260612R1000']) {
    const m = K.qrMatrix(code);
    assert.equal(m.length, 21, 'Version 1 (21 × 21) – Punkte ca. 0,7 mm bei 18 mm');
    const svg = K.qrSvg(code, 18, 2);
    assert.match(svg, /width="18mm" height="18mm"/); assert.match(svg, /viewBox="-2 -2 25 25"/);
    if (!jsQR) continue;
    // SVG-Pfad zurück in ein Bild (8 px je Modul, 4 Module Ruhezone) und lesen
    const s = 8, rand = 4, g = (21 + 2 * rand) * s, px = new Uint8ClampedArray(g * g * 4).fill(255);
    for (const [, x, y] of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g))
      for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) { const i = (((+y + rand) * s + yy) * g + (+x + rand) * s + xx) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
    const r = jsQR(px, g, g);
    assert.ok(r, 'QR lesbar: ' + code); assert.equal(r.data, code);
    assert.equal(K.codeLesen(r.data).code, code);
  }
});

/* ---------- Zusammenführen gemeinsamer Dateien (zwei PCs) ---------- */
const platte = () => { let txt = null; return { get txt() { return txt; }, set txt(v) { txt = v; }, io: { lesen: async () => txt, schreiben: async v => { txt = v; }, warten: async () => {} } }; };
await at('zweiter PC schreibt zwischen Lesen und Zurücklesen', async () => {
  const P = platte();
  const a = { id: 'pa1', nr: 1, code: 'LKP0001', name: 'Regal A · Fach 1', angelegt: '2026-11-01T08:00:00Z', geaendert: '2026-11-01T08:00:00Z' };
  const b = { id: 'pb1', nr: 1, code: 'LKP0001', name: 'Regal B · Fach 1', angelegt: '2026-11-01T08:00:05Z', geaendert: '2026-11-01T08:00:05Z' };
  let einmal = true;
  const d = await K.sicherSchreiben(P.io, 'einst', { eintraege: [a] }, { warten: 0, zwischen: async () => {
    if (!einmal) return; einmal = false;   // der andere PC liest den alten Stand, legt seinen Platz an und überschreibt
    await P.io.schreiben(JSON.stringify(K.mergen('einst', null, { eintraege: [b] })));
  } });
  assert.deepEqual(d.plaetze.map(x => x.name).sort(), ['Regal A · Fach 1', 'Regal B · Fach 1'], 'beide Plätze da');
  assert.deepEqual(d.plaetze.map(x => x.code).sort(), ['LKP0001', 'LKP0002'], 'doppelte Platznummer aufgelöst (der später angelegte rückt)');
});
await at('Vermerke beider PCs bleiben, die eigene Änderung gilt', async () => {
  const P = platte();
  const basis = { id: 'u1', nr: 1, was: 'Asche', gefunden: 'Regal A oben', geaendert: '2026-11-20T08:00:00Z', sperren: [], fristen: [] };
  P.txt = JSON.stringify(K.mergen('ohne', null, { eintraege: [basis] }));
  const pc1 = Object.assign({}, basis, { geaendert: '2026-11-21T09:00:00Z', platz: 'pa2', sperren: [{ id: 's1', wer: 'Tst', warum: 'Streitfall', am: '2026-11-21T09:00:00Z' }], _basis: basis });
  const pc2 = Object.assign({}, basis, { _basis: basis, geaendert: '2026-11-21T09:00:02Z', was: 'Asche, nass', fristen: [{ id: 'f1', bis: '2027-06-30', wer: 'Mbe', warum: 'Rückfrage', am: '2026-11-21T09:00:02Z' }] });
  await K.sicherSchreiben(P.io, 'ohne', { eintraege: [pc2] }, { warten: 0 });
  const d = await K.sicherSchreiben(P.io, 'ohne', { eintraege: [pc1] }, { warten: 0 });   // PC 1 schreibt später, seine Uhr geht nach
  const u = d.proben[0];
  assert.equal(u.sperren.length, 1); assert.equal(u.fristen.length, 1, 'Sperre und Verlängerung beide erhalten');
  assert.ok(Date.parse(u.geaendert) > Date.parse('2026-11-21T09:00:02Z'), 'eigener Stempel hinter den der Platte gesetzt');
  assert.equal(u.was, 'Asche, nass', 'Feld des anderen PCs bleibt (PC 1 hat „Was“ nicht geändert)');
  assert.equal(u.platz, 'pa2', 'Feld von PC 1 gilt, obwohl seine Uhr nachgeht');
  assert.ok(!('_basis' in u), 'Hilfsfeld nie in der Datei');
});
await at('unlesbare oder neuere Datei wird nie überschrieben', async () => {
  const P = platte(); P.txt = '{ kaputt';
  await assert.rejects(K.sicherSchreiben(P.io, 'ohne', { eintraege: [{ id: 'x', nr: 1, geaendert: 'z' }] }, { warten: 0 }), /nicht lesbar/);
  assert.equal(P.txt, '{ kaputt');
  P.txt = JSON.stringify({ format: 'spektron-lagerkit-ohne-projekt', version: 2, proben: [] });
  await assert.rejects(K.sicherSchreiben(P.io, 'ohne', { eintraege: [{ id: 'x', nr: 1, geaendert: 'z' }] }, { warten: 0 }), /neueren LagerKit-Fassung/);
  assert.match(P.txt, /"version":2/);
  assert.equal(K.dateiLesen('projekt', JSON.stringify({ format: 'spektron-lagerkit', version: 2, proben: [] })).neuer, true, 'Projektdatei neuer → nur ansehen');
});
await at('immer wieder überschrieben: nach 4 Versuchen Fehler statt Stillschweigen', async () => {
  const P = platte();
  await assert.rejects(K.sicherSchreiben(P.io, 'ohne', { eintraege: [{ id: 'x', nr: 1, geaendert: '2026-11-21T09:00:00Z' }] }, { warten: 0, zwischen: async () => { await P.io.schreiben(JSON.stringify(K.leer('ohne'))); } }), /4 Versuchen/);
});
t('Versionsstempel in jeder Datei', () => {
  for (const art of ['projekt', 'ohne', 'einst', 'index']) { const o = K.mergen(art, null, { eintraege: [] }); assert.equal(o.version, 1); assert.equal(o.app.name, 'LagerKit'); }
});

/* ---------- Index neu aufbauen ---------- */
t('Index-Eintrag aus der Projektdatei', () => {
  const lager = { proben: [
    probe({ id: 'r1', nr: 1, was: 'Brandschutt', ort: 'EG Küche', platz: 'pa1', quelle: { liste: 'asbestProben', id: 1, nr: 4, label: 'P4', titel: 'Probe 4' } }),
    probe({ id: 'r2', nr: 2, was: 'Putz', ort: 'EG Flur', platz: 'pa1', sperren: [{ id: 's', wer: 'Tst', warum: 'Streit', am: '2026-09-01T00:00:00Z' }] }),
    probe({ id: 'r3', nr: 3, was: 'storniert', storniert: { am: 'x', wer: 'Tst' }, nrFest: { am: 'x' } }),
    probe({ id: 'r4', nr: 4, was: 'weg', ereignisse: [{ id: 'e', art: 'entsorgt', wer: 'Tst', am: '2026-11-21T09:00:00Z' }] }),
    { id: 'r5', nr: 0, weg: '2026-11-21T09:00:00Z' },
  ] };
  const personen = [{ ordnerKuerzel: 'Dr. Pr' }];
  const e = K.indexEintrag(lager, { ordner: '26.0612 Musterweg Beispielstadt Dr. Pr', personen, uebergabe: '2026-08-20', asbest: new Set(['P4']), monate: 3, gelesen: '2026-11-21T09:00:00Z' });
  assert.deepEqual([e.nr, e.ort, e.kuerzel], ['26.0612', 'Musterweg Beispielstadt', 'Dr. Pr']);
  assert.deepEqual(e.proben.map(k => k.id), ['r1', 'r2', 'r4'], 'storniert und gelöschte leere Zeile fehlen');
  assert.equal(e.proben[0].bis, '2026-11-30'); assert.equal(e.proben[0].asbest, true); assert.equal(e.proben[0].rest, 'Probe 4');
  assert.deepEqual(e.proben.map(k => K.kurzStatus(k, '2026-12-01')), ['faellig', 'faellig', 'entsorgt']);
  assert.ok(e.proben[1].sperre);
  // Neuaufbau ersetzt den alten Index ganz (Projekte ohne Datei fallen weg)
  const alt = K.mergen('index', null, { eintraege: [Object.assign({}, e, { id: 'weg', ordner: 'weg' })] });
  const neu = K.mergen('index', alt, { eintraege: [e], ersetzen: true });
  assert.deepEqual(neu.projekte.map(x => x.id), [e.id]);
});

/* ---------- LabelKit und ResultKit (nur lesen) ---------- */
t('Laborproben aus LabelKit, Asbest aus ResultKit', () => {
  const D = require('./daten.cjs');
  const l = K.laborproben(D.LABELKIT);
  assert.deepEqual(l.map(x => x.titel), ['Probe 1', 'Probe 2', 'Probe 4', 'Probe 5', 'Probe 6', 'Probe 7', 'Brandgeruch-Probe 1']);
  const p4 = l.find(x => x.label === 'P4');
  assert.deepEqual([p4.was, p4.ort, p4.attribute, p4.probenahme, p4.artLager], ['Fliesenkleber', 'Haus A, EG Bad, Boden', 'fest gebunden', '2026-11-18', 'Materialprobe']);
  assert.equal(l.find(x => x.nr === 6).storniert, true);
  assert.deepEqual([...K.asbestProben(JSON.stringify(D.ERGEBNISSE))], ['P4'], 'P5 „kein Asbest nachgewiesen“, „< 0,1 %“ zählt nicht');
  assert.equal(K.asbestProben('kaputt').size, 0);
});

/* ---------- Ordnername wie in der Projektzentrale ---------- */
t('SPEKTRON-ORDNERNAME byte-gleich mit der Projektzentrale', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const block = s => { const a = s.indexOf('/* SPEKTRON-ORDNERNAME v1'), e = s.indexOf('/* SPEKTRON-ORDNERNAME-ENDE */'); return a < 0 || e < a ? null : s.slice(a, e); };
  const pz = path.join(__dirname, '..', '..', 'projektzentrale', 'index.html');
  if (fs.existsSync(pz)) assert.equal(block(html), block(fs.readFileSync(pz, 'utf8')));
  else assert.ok(!process.env.LAGERKIT_PZ_PFLICHT, '../projektzentrale fehlt – Ordnername nicht verglichen');
  assert.deepEqual(K.leseProjektordner('26.0612 Musterweg Beispielstadt Dr.Pr', [{ ordnerKuerzel: 'Dr. Pr' }]).kuerzel, 'Dr. Pr');
});

console.log(`Kern: ${n} Prüfungen grün${jsQR ? ', QR gelesen mit jsQR' : ' (QR-Lesetest ohne jsQR übersprungen)'}`);
})().catch(e => { console.error(e); process.exitCode = 1; });
