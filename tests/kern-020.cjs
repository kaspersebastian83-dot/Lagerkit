// LagerKit 0.2.0 – Kern in Node: Inventur-Abgleich (alle Fälle), Erinnerung nach drei Monaten, LKB-Reservierung mit einem zweiten PC
// (nie überlappend, abgebrochener Druck gibt nichts frei), Blanko-Code zuordnen (genau einmal) und über beide Codes finden, „wohin“-
// Vorbelegung, fester Beleg (nie überschrieben), 0.1.0-Datei ↔ 0.2.0 ohne Verlust (mit dem echten Kern aus 0.1.0, tests/alt/).
// node tests/kern-020.cjs
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const K = require('./kern-laden.cjs');
// Ein PC, der noch LagerKit 0.1.0 hat: unveränderter Kern aus main (5fb23c4), in einer eigenen Umgebung
const ALT = (() => { const ctx = { console, Intl, Date }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, 'alt', 'kern-0.1.0.js'), 'utf8'), ctx, { filename: 'kern-0.1.0.js' }); return ctx.LagerKern; })();
let n = 0; const t = (name, fn) => { try { fn(); } catch (e) { e.message = name + ': ' + e.message; throw e; } n++; };
const at = async (name, fn) => { try { await fn(); } catch (e) { e.message = name + ': ' + e.message; throw e; } n++; };
const tick = ms => new Promise(r => setTimeout(r, ms));
const zufallMs = max => Math.floor(Math.random() * (max + 1));
/** Gemeinsame Datei im Speicher, Lesen und Schreiben dauern zufällig etwas (wie das Netzlaufwerk) */
function platte(start) {
  const P = { text: start == null ? null : start, schreibt: 0 };
  P.io = (max = 4) => ({ lesen: async () => { await tick(zufallMs(max)); return P.text; }, schreiben: async x => { await tick(zufallMs(max)); P.text = x; P.schreibt++; }, warten: ms => tick(ms) });
  P.json = () => JSON.parse(P.text);
  return P;
}
/** Ordner im Speicher für feste Belege */
function ordner() {
  const O = { dateien: new Map(), ueberschrieben: [] };
  O.io = (max = 3) => ({ namen: async () => { await tick(zufallMs(max)); return [...O.dateien.keys()]; }, lesen: async name => { await tick(zufallMs(max)); return O.dateien.has(name) ? O.dateien.get(name) : null; },
    schreiben: async (name, x) => { await tick(zufallMs(max)); if (O.dateien.has(name)) O.ueberschrieben.push(name); O.dateien.set(name, x); }, warten: ms => tick(ms) });
  return O;
}
const PL = [{ id: 'pa1', nr: 1, code: 'LKP0001', name: 'Regal A · Fach 1' }, { id: 'pa2', nr: 2, code: 'LKP0002', name: 'Regal A · Fach 2' }, { id: 'pb3', nr: 3, code: 'LKP0003', name: 'Regal B · Fach 3' }];
const k = (key, o) => Object.assign({ key, id: key.split('|')[1], titel: 'R' + key.slice(-1), status: 'lager', entsorgt: null, platz: 'pa1', seit: '2026-08-01', projekt: { ordner: '26.0612 X', nr: '26.0612' } }, o);

(async () => {
/* ---------- Codes ---------- */
t('LKB-Code in beide Richtungen, auch verstümmelt', () => {
  assert.equal(K.bCode(13), 'LKB0013');
  assert.deepEqual(K.codeLesen('LKB0013'), { art: 'B', nr: 13, code: 'LKB0013' });
  assert.deepEqual(K.codeLesen('  lkb0013\n'), { art: 'B', nr: 13, code: 'LKB0013' }, 'klein, Leerraum');
  assert.equal(K.codeLesen('ÄLKB0013ß').code, 'LKB0013', 'Zeichen davor und danach');
  assert.equal(K.codeLesen('LKB013'), null, 'zu kurz: kein Code');
  assert.equal(K.codeLesen('LK260612R002').art, 'R', 'R-Codes unverändert');
  assert.equal(/^[A-Z0-9]+$/.test(K.bCode(99999)), true, 'nur Buchstaben und Ziffern');
  // gleicher QR wie die übrigen Codes: Version 1 (21 × 21 Module) → bei 18 mm gleich große Module wie auf dem Proben-Etikett
  if (typeof globalThis.qrcode === 'function') { assert.equal(K.qrMatrix('LKB0013').length, 21); assert.equal(K.qrMatrix('LKB0013').length, K.qrMatrix('LK260612R002').length); }
  // Ein 0.1.0-PC kennt LKB nicht – er hält es für keinen Code (nichts passiert), statt etwas Falsches zu öffnen
  assert.equal(ALT.codeLesen('LKB0013'), null);
});

/* ---------- Inventur: Abgleich ---------- */
t('Inventur-Abgleich: da · fehlt · woanders gebucht · als entsorgt eingetragen · unbekannter Code', () => {
  const da = k('A|r1'), fehlt = k('A|r2'), woanders = k('B|r3', { platz: 'pb3' }), weg = k('B|r4', { status: 'entsorgt', entsorgt: { wer: 'Tst', am: '2026-11-01T10:00:00Z' } });
  const ohnePlatz = k('C|r5', { platz: '' }), ng = k('A|r6', { nichtGefunden: { wer: 'Tst', am: '2026-10-01T10:00:00Z' } });
  const erwartet = [da, fehlt, ng, Object.assign({}, weg, { platz: 'pa1' })];
  const e = K.inventurAbgleich('pa1', erwartet, [{ code: 'LK260612R001', k: da }, { code: 'X', k: woanders }, { code: 'Y', k: weg }, { code: 'LKB0077', k: null, frei: true },
    { code: 'LK260612R001', k: da }, { code: 'LKB0077', k: null }, { code: 'Z', k: ohnePlatz }, { code: 'LK260612R006', k: ng }, { code: 'LKX9', k: null }]);
  assert.deepEqual(e.da.map(x => x.key), ['A|r1', 'A|r6'], 'doppelt gescannt zählt einmal; „nicht gefunden“ eingetragen, aber da → da');
  assert.deepEqual(e.fehlt.map(x => x.key), ['A|r2'], 'eine entsorgte Probe fehlt nie');
  assert.deepEqual(e.woanders.map(x => x.key), ['B|r3', 'C|r5'], 'auch: ohne Regalplatz gebucht');
  assert.deepEqual(e.entsorgt.map(x => x.key), ['B|r4']);
  assert.deepEqual(e.unbekannt, [{ code: 'LKB0077', frei: true }, { code: 'LKX9', frei: false }]);
  // Nichts davon wird geändert: der Abgleich ist rein
  assert.equal(woanders.platz, 'pb3'); assert.equal(weg.status, 'entsorgt');
  // leerer Platz, nichts gescannt
  assert.deepEqual(K.inventurAbgleich('pa2', [], []), { da: [], fehlt: [], woanders: [], entsorgt: [], unbekannt: [] });
  // Prüfung für die Datei: feste Texte, keine Verweise auf die Übersicht
  const pr = K.inventurPruefung(PL[0], e, { lauf: 'l1', wer: 'Tst', start: '2026-11-21T09:00:00Z', fertig: '2026-11-21T09:05:00Z' });
  assert.deepEqual([pr.platz, pr.platzName, pr.da.length, pr.fehlt[0].titel, pr.woanders[0].platz, pr.korrekturen], ['pa1', 'Regal A · Fach 1', 2, 'R2', 'pb3', []]);
  assert.equal(pr.entsorgt[0].entsorgt.wer, 'Tst');
  assert.ok(!JSON.stringify(pr).includes('"status"'), 'nur das Nötige');
});
t('zuletzt geprüft je Platz aus den Inventur-Dateien', () => {
  const l = K.letzteInventur([{ pruefungen: [{ platz: 'pa1', fertig: '2026-08-20T09:00:00Z' }, { platz: 'pa2', fertig: '2026-10-02T21:30:00Z' }] }, { pruefungen: [{ platz: 'pa1', fertig: '2026-11-03T08:00:00Z' }] }, null]);
  assert.deepEqual(l, { pa1: '2026-11-03', pa2: '2026-10-02' });
});
await at('Inventur-Datei: zwei Durchgänge am selben Tag bleiben beide erhalten', async () => {
  const P = platte(null);
  const p1 = K.inventurPruefung(PL[0], K.inventurAbgleich('pa1', [], []), { id: 'i1', wer: 'Tst', fertig: '2026-11-21T09:00:00Z' });
  const p2 = K.inventurPruefung(PL[1], K.inventurAbgleich('pa2', [], []), { id: 'i2', wer: 'Tst', fertig: '2026-11-21T09:00:01Z' });
  await Promise.all([p1, p2].map(p => K.sicherSchreiben(P.io(), 'inventur', { eintraege: [p], felder: { werte: { tag: '2026-11-21', wer: 'Tst' }, am: '1970-01-01T00:00:00.000Z' } }, { warten: 15 })));
  assert.deepEqual(P.json().pruefungen.map(x => x.id).sort(), ['i1', 'i2']);
  assert.equal(P.json().format, 'spektron-lagerkit-inventur');
  assert.equal(K.inventurName('2026-11-21', 'Dr. Ka'), '2026-11-21_DrKa.json');
});

/* ---------- Erinnerung nach drei Monaten ---------- */
t('Erinnerung: benutzter Platz, letzte Prüfung > 3 Monate oder nie und erste Probe seit 3 Monaten', () => {
  const proben = [k('A|1', { platz: 'pa1', seit: '2026-05-10' }), k('A|2', { platz: 'pa2', seit: '2026-10-01' }), k('A|3', { platz: 'pb3', seit: '2026-01-01', status: 'entsorgt', entsorgt: { wer: 'x' } })];
  // pa1: zuletzt 21.08. → am 21.11. genau drei Monate: noch nicht fällig; am 22.11. fällig
  assert.deepEqual(K.inventurFaellig(PL, proben, { pa1: '2026-08-21' }, '2026-11-21'), []);
  assert.deepEqual(K.inventurFaellig(PL, proben, { pa1: '2026-08-21' }, '2026-11-22'), ['pa1']);
  // nie geprüft: pa1 (Probe seit Mai) fällig, pa2 (erst seit Oktober) nicht, pb3 nur Entsorgtes = unbenutzt
  assert.deepEqual(K.inventurFaellig(PL, proben, {}, '2026-11-21'), ['pa1']);
  assert.deepEqual(K.inventurFaellig(PL, proben, {}, '2027-01-02'), ['pa1', 'pa2']);
  // frisch geprüft: nichts fällig, auch wenn die Proben alt sind
  assert.deepEqual(K.inventurFaellig(PL, proben, { pa1: '2026-11-20', pa2: '2026-11-20' }, '2026-11-21'), []);
  // Ohne Datum (Index aus 0.1.0 hat kein „seit“): keine Erinnerung statt einer falschen
  assert.deepEqual(K.inventurFaellig(PL, [k('A|9', { platz: 'pa1', seit: undefined })], {}, '2027-06-01'), []);
  assert.deepEqual([K.plusMonate('2026-11-30', 3), K.plusMonate('2026-08-31', 3), K.plusMonate('2027-11-30', 3)], ['2027-02-28', '2026-11-30', '2028-02-29']);
});
t('„seit“: letzte Umbuchung auf den jetzigen Platz, sonst das Erfassen', () => {
  assert.equal(K.seitTag({ platz: 'pa2', erfasst: '2026-05-01T08:00:00Z', plaetze: [{ id: 'a', von: 'pa1', nach: 'pa2', am: '2026-09-03T08:00:00Z' }, { id: 'b', von: 'pa2', nach: 'pa1', am: '2026-09-04T08:00:00Z' }, { id: 'c', von: 'pa1', nach: 'pa2', am: '2026-10-05T08:00:00Z' }] }), '2026-10-05');
  assert.equal(K.seitTag({ platz: 'pa1', erfasst: '2026-05-01T08:00:00Z', plaetze: [] }), '2026-05-01');
});

/* ---------- Blanko: Nummern reservieren ---------- */
const EINST = { format: 'spektron-lagerkit-einstellungen', version: 1, app: { name: 'LagerKit', version: '0.1.0' }, fristMonate: 3, plaetze: PL.map(p => Object.assign({ angelegt: '2026-11-01T08:00:00.000Z', geaendert: '2026-11-01T08:00:00.000Z', gedruckt: [], umbenannt: [] }, p)) };
const ueberlappt = l => l.some((a, i) => l.some((b, j) => i < j && a.von <= b.bis && b.von <= a.bis));
await at('Reservierung: ein PC – fortlaufend, abgebrochener Druck gibt nichts frei', async () => {
  const P = platte(JSON.stringify(EINST));
  const a = await K.blankoReservieren(P.io(), { n: 12, wer: 'Tst', warten: 10 });
  assert.deepEqual([a.bereich.von, a.bereich.bis], [1, 12]);
  // Druck abgebrochen: nichts passiert mit dem Bereich – der nächste beginnt dahinter
  const b = await K.blankoReservieren(P.io(), { n: 5, wer: 'Tst', warten: 10 });
  assert.deepEqual([b.bereich.von, b.bereich.bis], [13, 17]);
  assert.deepEqual(P.json().blankoBereiche.map(x => [x.von, x.bis, x.wer]), [[1, 12, 'Tst'], [13, 17, 'Tst']], 'beide stehen in Einstellungen.json');
  assert.equal(P.json().plaetze.length, 3, 'Regalplätze bleiben');
  // Merkt sich der PC eine höhere eigene Nummer (Datei inzwischen älter/zurückgespielt), geht es dort weiter – nie zurück
  const c = await K.blankoReservieren(P.io(), { n: 1, wer: 'Tst', mindest: 40, warten: 10 });
  assert.equal(c.bereich.von, 40);
  const d = await K.blankoReservieren(P.io(), { n: 2, wer: 'Tst', warten: 10 });
  assert.equal(d.bereich.von, 41, 'Lücke 18–39 wird nie nachträglich vergeben');
  await assert.rejects(K.blankoReservieren(platte('kaputt{').io(), { n: 1, warten: 5 }), /nicht lesbar/, 'unlesbare Einstellungen: nichts reserviert');
});
await at('Reservierung: mehrere PCs gleichzeitig – gedruckte Bereiche überlappen nie', async () => {
  let versucht = 0, abgelehnt = 0;
  for (let runde = 0; runde < 12; runde++) {
    const P = platte(JSON.stringify(EINST)), gedruckt = [];
    // Drei PCs reservieren fast gleichzeitig (viel dichter als im Büro). Klappt es einmal nicht, meldet LagerKit das und druckt nichts.
    const pc = async (wer, mal) => { for (let i = 0; i < mal; i++) { await tick(zufallMs(25));
      try { const r = await K.blankoReservieren(P.io(5), { n: 1 + zufallMs(11), wer, warten: 12, versuche: 12 }); gedruckt.push(Object.assign({ wer }, r.bereich)); }
      catch (e) { assert.match(e.message, /kein freier Nummernbereich/); abgelehnt++; } } };
    await Promise.all([pc('Tst', 4), pc('Mbe', 4), pc('DrPr', 3)]);
    versucht += 11;
    assert.ok(!ueberlappt(gedruckt), 'Runde ' + runde + ': gedruckte Bereiche überlappen: ' + JSON.stringify(gedruckt.map(b => [b.wer, b.von, b.bis])));
    const disk = P.json().blankoBereiche;
    for (const g of gedruckt) assert.ok(disk.some(b => b.id === g.id && !b.verworfen), 'gedruckter Bereich steht in der Datei');
    // ein verworfener Bereich wird nie wieder vergeben: jede neue Reservierung liegt hinter allen bisherigen
    const max = Math.max(...disk.map(b => b.bis)), r = await K.blankoReservieren(P.io(), { n: 3, wer: 'Tst', warten: 5 });
    assert.equal(r.bereich.von, max + 1);
  }
  assert.ok(abgelehnt <= versucht / 10, abgelehnt + ' von ' + versucht + ' abgelehnt');
});
await at('Reservierung: ein 0.1.0-PC schreibt dazwischen (Regalplatz) – nichts geht verloren', async () => {
  for (let runde = 0; runde < 8; runde++) {
    const P = platte(JSON.stringify(EINST)), gedruckt = [];
    const neu = async () => { for (let i = 0; i < 3; i++) { const r = await K.blankoReservieren(P.io(5), { n: 6, wer: 'Tst', warten: 12, versuche: 12 }); gedruckt.push(r.bereich); } };
    const alt = async () => { for (let i = 0; i < 3; i++) { const am = new Date(Date.now() + i).toISOString(); await ALT.sicherSchreiben(P.io(5), 'einst', { eintraege: [{ id: 'neu' + runde + i, nr: 10 + i, code: ALT.pCode(10 + i), name: 'Neu ' + i, angelegt: am, geaendert: am, gedruckt: [], umbenannt: [] }] }, { warten: 12 }); } };
    await Promise.all([neu(), alt()]);
    assert.ok(!ueberlappt(gedruckt));
    const d = P.json();
    for (const g of gedruckt) assert.ok(d.blankoBereiche.some(b => b.id === g.id), 'Reservierung überlebt den 0.1.0-PC');
    assert.equal(d.plaetze.filter(p => p.id.startsWith('neu')).length, 3, 'Plätze des 0.1.0-PCs bleiben');
  }
});

/* ---------- Blanko: zuordnen und finden ---------- */
await at('Zuordnen: genau einmal – auch wenn zwei PCs denselben Code gleichzeitig scannen', async () => {
  const P = platte(JSON.stringify(Object.assign({}, EINST, { blankoBereiche: [{ id: 'b1', von: 1, bis: 12, wer: 'Tst', am: '2026-11-20T08:00:00Z', geaendert: '2026-11-20T08:00:00Z' }] })));
  const st0 = K.blankoStand(P.json(), 'LKB0013');
  assert.equal(st0.reserviert, null, 'nicht reserviert → kein freies Blanko-Etikett');
  assert.equal(K.blankoStand(P.json(), 'LKB0007').reserviert.id, 'b1');
  const a = await K.blankoZuordnen(P.io(), { code: 'LKB0007', ordner: '26.0612 X', u: false, probe: 'p1', wer: 'Tst', am: '2026-11-21T09:00:00Z' }, { warten: 10 });
  assert.deepEqual(a, { ok: true });
  const b = await K.blankoZuordnen(P.io(), { code: 'LKB0007', ordner: '26.0590 Y', u: false, probe: 'p2', wer: 'Mbe', am: '2026-11-21T09:01:00Z' }, { warten: 10 });
  assert.equal(b.schon.probe, 'p1', 'zweites Zuordnen: die vorhandene Probe wird genannt');
  assert.equal(K.blankoStand(P.json(), 'LKB0007').zuordnung.ordner, '26.0612 X', 'die erste bleibt');
  for (let runde = 0; runde < 15; runde++) {
    const Q = platte(P.text), code = 'LKB000' + (1 + (runde % 6));
    const r = await Promise.all(['q1', 'q2', 'q3'].map((probe, i) => K.blankoZuordnen(Q.io(5), { code, ordner: 'O' + i, u: false, probe, wer: 'Tst', am: new Date(Date.UTC(2026, 10, 21, 9, 0, runde, i)).toISOString() }, { warten: 12 })));
    const ok = r.filter(x => x.ok);
    assert.equal(ok.length, 1, 'Runde ' + runde + ': genau ein PC darf zuordnen – ' + JSON.stringify(r));
    const sieger = K.blankoStand(Q.json(), code).zuordnung.probe;
    for (const x of r.filter(y => y.schon)) assert.equal(x.schon.probe, sieger, 'die anderen öffnen die Probe des Siegers');
  }
});
t('Finden über beide Codes: R-Nummer bleibt die Bezeichnung, der Blanko-Code steht in codes und im Index', () => {
  const lager = { format: 'spektron-lagerkit', version: 1, proben: [{ id: 'p1', nr: 5, code: '', was: 'Brandschutt', ort: 'EG', probenahme: '2026-11-18', erfasst: '2026-11-21T09:00:00Z', platz: 'pa1',
    codes: [{ code: 'LKB0007', art: 'blanko', am: '2026-11-21T09:00:00Z', wer: 'Tst' }], fristen: [], sperren: [], plaetze: [], ereignisse: [], gedruckt: [] }] };
  const e = K.indexEintrag(lager, { ordner: '26.0612 Musterweg Tst', personen: [{ ordnerKuerzel: 'Tst' }], monate: 3 });
  assert.deepEqual([e.proben[0].nr, e.proben[0].blanko, K.rCode(e.nr, e.proben[0].nr)], [5, ['LKB0007'], 'LK260612R005']);
  assert.equal(K.codeLesen('LKB0007').code, e.proben[0].blanko[0], 'Scan-Code = Code in der Probe');
  // eine Probe mit Blanko-Etikett ist nie „ganz leer“: der Code ist vergeben, also stornieren statt löschen
  assert.equal(K.ganzLeer(Object.assign({}, lager.proben[0], { was: '', ort: '' })), false);
  assert.equal(K.loeschen(JSON.parse(JSON.stringify(lager.proben)).map(p => Object.assign(p, { was: '', ort: '' })), 'p1', 'Tst', '', '2026-11-21T10:00:00Z'), 'storniert');
});

/* ---------- Entsorgungsliste: wohin und fester Beleg ---------- */
t('„wohin“: bei „Asbest nachgewiesen“ vorbelegt Asbestabfall, sonst leer (freiwillig)', () => {
  assert.equal(K.wohinVorschlag({ asbest: true }), 'Asbestabfall');
  assert.equal(K.wohinVorschlag({ verdacht: true }), '', 'Verdacht allein belegt nichts vor');
  assert.equal(K.wohinVorschlag({}), '');
  assert.deepEqual(K.WOHIN, ['Restmüll', 'Gefährlicher Abfall / Entsorger', 'Asbestabfall', 'zurück an Auftraggeber', 'Sonstiges']);
  assert.equal(K.wohinText('Sonstiges', '  Rückgabe Labor '), 'Sonstiges: Rückgabe Labor');
  assert.equal(K.wohinText('Sonstiges', ''), 'Sonstiges');
  assert.equal(K.wohinText('Restmüll', 'egal'), 'Restmüll');
  assert.equal(K.wohinText('irgendwas'), '', 'nur die Liste');
});
await at('Beleg: nächste laufende Nummer, eine vorhandene Datei wird nie geändert', async () => {
  const O = ordner();
  const alt = '{"id":"alt","tag":"2026-11-21"}\n';
  O.dateien.set('2026-11-21_Tst_1.json', alt);
  const b = id => ({ format: K.FORMAT.beleg, version: 1, id, tag: '2026-11-21', am: '2026-11-21T10:00:00Z', wer: 'Tst', proben: [{ titel: 'R1', ergebnis: 'entsorgt', wohin: 'Restmüll', eingetragen: true }] });
  assert.equal(await K.belegSchreiben(O.io(), b('x1'), { warten: 5 }), '2026-11-21_Tst_2.json');
  assert.equal(O.dateien.get('2026-11-21_Tst_1.json'), alt, 'alter Beleg unverändert');
  // zwei PCs, gleiches Kürzel, gleicher Augenblick: zwei Dateien, keine überschrieben (die Lücke im Zufall wird mehrmals geprüft)
  for (let i = 0; i < 10; i++) await Promise.all([K.belegSchreiben(O.io(4), b('a' + i), { warten: 10 }), K.belegSchreiben(O.io(4), b('b' + i), { warten: 10 })]);
  const ids = [...O.dateien.values()].map(x => JSON.parse(x).id);
  for (let i = 0; i < 10; i++) { assert.ok(ids.includes('a' + i) && ids.includes('b' + i), 'beide Belege da (' + i + ')'); }
  assert.equal(new Set(ids).size, ids.length, 'jeder Beleg genau einmal');
  assert.ok(O.dateien.get('2026-11-21_Tst_1.json') === alt && O.dateien.get('2026-11-21_Tst_2.json').includes('"x1"'), 'feste Belege bleiben, wie sie sind');
  // der Fall, den das Netzlaufwerk möglich macht: zwei schreiben zugleich dieselbe neue Datei – der Verlierer nimmt die nächste Nummer,
  // der Gewinner bleibt unberührt
  assert.ok(O.ueberschrieben.every(n => ids.includes(JSON.parse(O.dateien.get(n)).id)));
  assert.equal(K.kuerzelDatei('Dr. Ka'), 'DrKa'); assert.match('2026-11-21_DrKa_3.json', K.BELEG_RE);
  assert.equal(K.dateiLesen('beleg', O.dateien.get('2026-11-21_Tst_2.json')).proben[0].wohin, 'Restmüll');
});

/* ---------- 0.1.0 ↔ 0.2.0 ---------- */
await at('Projektdatei: ein 0.1.0-PC ändert eine Probe – Blanko-Code, wohin, Inventur-Vermerke bleiben', async () => {
  const ev = [{ id: 'e1', art: 'entsorgt', wer: 'Tst', am: '2026-11-21T10:00:00.000Z', wohin: 'Asbestabfall' }, { id: 'e2', art: 'entsorgtZurueck', bei: 'inventur', wer: 'Mbe', warum: 'doch da – Inventur', am: '2026-11-22T10:00:00.000Z' },
    { id: 'e3', art: 'nichtGefunden', bei: 'inventur', wer: 'Mbe', am: '2026-11-22T10:01:00.000Z' }];
  const p020 = { id: 'p1', nr: 1, code: 'LK260612R001', was: 'Brandschutt', ort: 'EG', probenahme: '2026-07-14', erfasst: '2026-07-14T09:00:00.000Z', geaendert: '2026-11-22T10:01:00.000Z', platz: 'pa1', notiz: '', wohin: 'Asbestabfall',
    codes: [{ code: 'LKB0007', art: 'blanko', am: '2026-11-21T09:00:00.000Z', wer: 'Tst' }], fristen: [], sperren: [], plaetze: [{ id: 'm1', von: 'pb3', nach: 'pa1', wer: 'Mbe', warum: 'Inventur 22.11.2026 auf Regal A · Fach 1 gefunden', am: '2026-11-22T10:02:00.000Z' }], ereignisse: ev, gedruckt: [], ansLabor: [] };
  const datei = { format: 'spektron-lagerkit', version: 1, app: { name: 'LagerKit', version: '0.2.0' }, projekt: { nr: '26.0612', ordner: '26.0612 X' }, proben: [p020, { id: 'p2', nr: 2, was: 'Putz', geaendert: '2026-07-14T09:00:00.000Z', codes: [], ereignisse: [] }], ansLabor: [], gespeichertAm: '2026-11-22T10:02:00.000Z' };
  const P = platte(JSON.stringify(datei));
  // 0.1.0 liest, ändert wie seine App (Kopie mit _basis): Notiz und eine Sperre; eine zweite Probe nur das Was
  const disk = ALT.dateiLesen('projekt', P.text), a = JSON.parse(JSON.stringify(disk.proben[0])), b = JSON.parse(JSON.stringify(disk.proben[1]));
  a._basis = disk.proben[0]; a.notiz = 'Rückfrage Auftraggeber'; a.sperren = [{ id: 's1', wer: 'DrPr', warum: 'Streitfall', am: '2026-11-23T08:00:00.000Z' }]; a.geaendert = '2026-11-23T08:00:00.000Z';
  b._basis = disk.proben[1]; b.was = 'Putz verrußt'; b.geaendert = '2026-11-23T08:00:00.000Z';
  await ALT.sicherSchreiben(P.io(), 'projekt', { eintraege: [a, b] }, { warten: 10 });
  const nach = P.json(), q = nach.proben.find(x => x.id === 'p1');
  assert.equal(q.notiz, 'Rückfrage Auftraggeber'); assert.equal(q.sperren.length, 1, 'die 0.1.0-Änderung gilt');
  assert.deepEqual(q.codes, p020.codes, 'Blanko-Code bleibt');
  assert.equal(q.wohin, 'Asbestabfall', 'wohin an der Probe bleibt');
  assert.deepEqual(q.ereignisse, ev, 'Ereignisse mit wohin und „bei: inventur“ bleiben vollständig');
  assert.deepEqual(q.plaetze, p020.plaetze, 'Umbuchung aus der Inventur bleibt');
  assert.equal(nach.proben.find(x => x.id === 'p2').was, 'Putz verrußt');
  // und umgekehrt: 0.2.0 liest die Datei und rechnet wie gewohnt
  const k2 = K.kurzProbe(q, { monate: 3 }, null);
  assert.deepEqual([k2.blanko, k2.entsorgt, !!k2.sperre, k2.wohin], [['LKB0007'], null, true, 'Asbestabfall'], 'zurückgenommen → nicht entsorgt; Sperre aus 0.1.0 gilt');
});
await at('Projektdatei aus 0.1.0 in 0.2.0: nichts fehlt, nichts geht verloren', async () => {
  const p010 = { id: 'p9', nr: 3, code: 'LK260571R003', was: 'Gipskarton', ort: 'EG Flur', art: 'Sonstige', probenahme: '2026-07-14', erfasst: '2026-07-14T09:00:00.000Z', geaendert: '2026-07-14T09:00:00.000Z', platz: 'pa1',
    codes: [], fristen: [], sperren: [], plaetze: [], ereignisse: [], gedruckt: [], ansLabor: [], wohin: '' };
  const P = platte(JSON.stringify({ format: 'spektron-lagerkit', version: 1, app: { name: 'LagerKit', version: '0.1.0' }, projekt: {}, proben: [p010], ansLabor: [] }));
  const k0 = K.kurzProbe(K.dateiLesen('projekt', P.text).proben[0], { monate: 3 }, null);
  assert.deepEqual([k0.blanko, k0.seit, k0.wohin], [[], '2026-07-14', '']);
  // 0.2.0 trägt „entsorgt“ mit wohin ein (wie „Eintragen“), dann ändert 0.1.0 dieselbe Probe – nichts geht verloren
  const d = K.dateiLesen('projekt', P.text), x = JSON.parse(JSON.stringify(d.proben[0])); x._basis = d.proben[0];
  x.ereignisse = [{ id: 'z1', art: 'entsorgt', wer: 'Tst', am: '2026-11-21T10:00:00.000Z', wohin: 'Restmüll' }]; x.wohin = 'Restmüll'; x.geaendert = '2026-11-21T10:00:00.000Z';
  await K.sicherSchreiben(P.io(), 'projekt', { eintraege: [x] }, { warten: 10 });
  const d2 = ALT.dateiLesen('projekt', P.text), y = JSON.parse(JSON.stringify(d2.proben[0])); y._basis = d2.proben[0];
  y.ereignisse = y.ereignisse.concat({ id: 'z2', art: 'entsorgtZurueck', wer: 'Mbe', warum: 'steht noch im Regal', am: '2026-11-22T10:00:00.000Z' }); y.geaendert = '2026-11-22T10:00:00.000Z';
  await ALT.sicherSchreiben(P.io(), 'projekt', { eintraege: [y] }, { warten: 10 });
  const z = P.json().proben[0];
  assert.deepEqual(z.ereignisse.map(e => [e.id, e.wohin || '']), [['z1', 'Restmüll'], ['z2', '']]);
  assert.equal(z.wohin, 'Restmüll');
});
await at('Einstellungen: ein 0.1.0-PC legt einen Platz an – reservierte und vergebene Blanko-Codes bleiben', async () => {
  const P = platte(JSON.stringify(EINST));
  const r = await K.blankoReservieren(P.io(), { n: 12, wer: 'Tst', warten: 10 });
  await K.blankoZuordnen(P.io(), { code: 'LKB0003', ordner: '26.0612 X', u: false, probe: 'p1', wer: 'Tst', am: '2026-11-21T09:00:00.000Z' }, { warten: 10 });
  const am = '2026-11-22T08:00:00.000Z';
  await ALT.sicherSchreiben(P.io(), 'einst', { eintraege: [{ id: 'pneu', nr: 9, code: 'LKP0009', name: 'Boden rechts', angelegt: am, geaendert: am, gedruckt: [], umbenannt: [] }] }, { warten: 10 });
  await ALT.sicherSchreiben(P.io(), 'einst', { eintraege: [], felder: { werte: { fristMonate: 6, fristWer: 'Mbe' }, am } }, { warten: 10 });
  const d = P.json();
  assert.deepEqual([d.plaetze.length, d.fristMonate], [4, 6]);
  assert.deepEqual(d.blankoBereiche.map(b => b.id), [r.bereich.id]);
  assert.equal(K.blankoStand(d, 'LKB0003').zuordnung.probe, 'p1');
  // der Index eines 0.1.0-PCs kennt den Blanko-Code nicht (Zwischenspeicher) – die Zuordnung in den Einstellungen findet die Probe trotzdem
  const alterIndex = ALT.kurzProbe({ id: 'p1', nr: 1, codes: [{ code: 'LKB0003', art: 'blanko' }], fristen: [], sperren: [], ereignisse: [] }, { monate: 3 }, null);
  assert.equal(alterIndex.blanko, undefined);
  assert.equal(K.blankoStand(d, 'LKB0003').zuordnung.ordner, '26.0612 X');
});

console.log(`Kern 0.2.0: ${n} Prüfungen grün (mit dem Kern aus 0.1.0 als zweitem PC)`);
})().catch(e => { console.error(e); process.exitCode = 1; });
