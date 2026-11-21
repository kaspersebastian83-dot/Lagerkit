// Erfundenes Archiv für die Tests – keine echten Projekte, Personen oder Kunden.
const MA = { format: 'spektron-mitarbeiter', version: 1, personen: [
  { ordnerKuerzel: 'Dr. Pr', appKuerzel: 'DrPr', name: 'Dr. Paula Probe', aktiv: true },
  { ordnerKuerzel: 'Tst', appKuerzel: 'Tst', name: 'Tim Test', aktiv: true },
  { ordnerKuerzel: 'Mbe', appKuerzel: 'Mbe', name: 'Mia Beispiel', aktiv: true },
] };
const P = {
  neu: '26.0612 Musterweg Beispielstadt Dr. Pr',     // Spektron-Projekt mit LabelKit, ResultKit, ohne Bericht
  bericht: '26.0571 Testgasse Beispieldorf Tst',     // Bericht übergeben → fällig, eine Probe gesperrt
  ohne: '26.0590 Probeweg Musterort Mbe',            // kein Bericht → vorläufig fällig (gelber Hinweis)
  zurueck: '26.0601 Zurückweg Testheim Tst',          // Bericht übergeben und wieder zurückgeholt → „ohne Bericht“
  alt: '25.0310 Altweg Altstadt Tst',                // vor Spektron, noch ohne _Spektron
};
const PL = [['pa1', 1, 'Regal A · Fach 1'], ['pa2', 2, 'Regal A · Fach 2'], ['pb3', 3, 'Regal B · Fach 3'], ['pbl', 4, 'Boden links']]
  .map(([id, nr, name]) => ({ id, nr, code: 'LKP' + String(nr).padStart(4, '0'), name, angelegt: '2026-11-01T08:00:00.000Z', angelegtVon: 'Tst', geaendert: '2026-11-01T08:00:00.000Z', nichtMehr: null, umbenannt: [], gedruckt: [] }));
const EINST = { format: 'spektron-lagerkit-einstellungen', version: 1, app: { name: 'LagerKit', version: '0.1.0' }, fristMonate: 3, plaetze: PL };
const probe = (o) => Object.assign({ id: 'id-' + Math.random().toString(36).slice(2, 10), erfasst: '2026-07-14T09:00:00.000Z', erfasstVon: 'Tst', geaendert: '2026-07-14T09:00:00.000Z',
  was: '', ort: '', attribute: '', art: 'Sonstige', behaelter: '', probenahme: '', probenahmeUnbekannt: false, von: '', platz: '', notiz: '', verdacht: false, quelle: null,
  codes: [], fristen: [], sperren: [], plaetze: [], ereignisse: [], gedruckt: [], ansLabor: [], wohin: '' }, o);
const lager = (ordner, proben) => ({ format: 'spektron-lagerkit', version: 1, app: { name: 'LagerKit', version: '0.1.0' }, projekt: { nr: ordner.slice(0, 7), ordner }, proben, ansLabor: [], gespeichertAm: '2026-07-14T09:00:00.000Z' });
const aufgabe = (id, ordner, erstellt) => ({ format: 'spektron-buerokit', version: 1, typ: 'aufgabe', id, erstellt, von: 'Tst', projekt: { name: ordner, nr: ordner.slice(0, 7) }, art: 'gutachten', titel: 'Gutachten', word: 'Mitteilungen/1. Mitteilung.docx', empfaenger: [{ id: 'e1', gruppe: 'versicherung', label: 'Auftraggeber', details: 'Muster AG, Musterstraße 1' }] });
const vermerk = (id, aufgabeId, schritt, zeit) => ({ format: 'spektron-buerokit', version: 1, typ: 'vermerk', id, aufgabe: aufgabeId, zeit, von: 'Tst', schritt, wert: true });
const LABELKIT = { version: '5.3.2', gespeichertAm: '2026-11-18T16:00:00.000Z', nrSchutz: 1, projekt: { nr: '26.0612' },
  proben: [{ id: 1, _nr: 1, datum: '18.11.2026', z1: '26.0612', z2: 'Haus A, EG Küche Brandraum', z3: 'Decke', z4: 'Untersicht', matrix: 'Wischprobe', cm2: '600', nrFest: { am: '2026-11-18T15:00:00Z', anlass: 'Etiketten' } }],
  chloridProben: [{ id: 2, _nr: 2, chloridNr: 2, datum: '18.11.2026', z1: '26.0612', z2: 'Haus A, EG Flur', z3: 'Wand', z4: 'Ansicht', matrix: 'Wischprobe', cm2: '100' }],
  asbestProben: [{ id: 1, _nr: 4, datum: '18.11.2026', z1: '26.0612', z2: 'Haus A, EG Bad, Boden', z3: 'Fliesenkleber', z4: 'fest gebunden', zustand: '', matrix: 'Material (NWG 1 %)' },
    { id: 2, _nr: 5, datum: '18.11.2026', z1: '26.0612', z2: 'Haus A, OG Flur, Decke', z3: 'Spachtelmasse', z4: '', zustand: '', matrix: 'Material (NWG 0,1 %)' },
    { id: 3, _nr: 6, datum: '18.11.2026', z1: '26.0612', z2: 'Haus A, KG', z3: 'Kleber', storniert: { am: '2026-11-18T15:00:00Z', kuerzel: 'DrPr', grund: 'doppelt' }, nrFest: { am: '2026-11-18T15:00:00Z', anlass: 'storniert' } }],
  sonstigeProben: [{ id: 1, _nr: 7, datum: '18.11.2026', z1: '26.0612', z2: 'Haus A, KG Heizungsraum', z3: 'Brandschutt', z4: 'Boden', matrix: 'Feststoff' }],
  brandgeruchProben: [{ id: 1, z1: 'Textil', z2: 'Haus A, OG KiZ' }], brandgeruchDatum: '18.11.2026' };
const FREMD = Object.assign({}, LABELKIT, { projekt: { nr: '26.0999' }, sonstigeProben: [{ id: 9, _nr: 9, datum: '01.01.2026', z1: '26.0999', z2: 'FREMDES PROJEKT', z3: 'nie lesen', matrix: 'Feststoff' }] });
const ERGEBNISSE = { format: 'spektron-ergebnisse', version: 1, projekt: '26.0612', uebernommen: '2026-11-20T10:00:00Z', app: { name: 'ResultKit', version: '2.6.0' }, vollstaendig: false, stand: '', dateien: [], auftrag: null,
  berichte: [{ id: 'b1', bericht: 'AR-26-XX-000001-01', labor: 'Eurofins', auftragsreferenz: '26.0612', sources: {}, proben: [
    { label: 'P4', ref: 'Probe 4', desc: 'Haus A, EG Bad, Boden, Fliesenkleber', werte: [{ p: 'Asbestart', r: 'Chrysotil', u: '' }, { p: 'Asbestgehalt', r: '5 - 20', u: '%' }] },
    { label: 'P5', ref: 'Probe 5', desc: 'Haus A, OG Flur, Decke, Spachtelmasse', werte: [{ p: 'Asbestart', r: 'kein Asbest nachgewiesen', u: '' }, { p: 'Asbestgehalt', r: '< 0,1', u: '%' }] }] }],
  ersetzt: [], offen: [], hinweise: [] };

function archiv() {
  const a = {};
  const j = (pfad, o) => { a[pfad] = JSON.stringify(o, null, 1); };
  j('_Spektron-Mitarbeiter.json', MA);
  // neues Projekt: Projektdaten, LabelKit (eigene und fremde Datei), ResultKit
  j(P.neu + '/_Spektron/_Projekt.json', { ortstermin: '2026-11-18', objekt: 'Musterhaus' });
  j(P.neu + '/_Spektron/LabelKit/26.0612_Daten.json', LABELKIT);
  j(P.neu + '/_Spektron/LabelKit/26.0999_Daten.json', FREMD);
  j(P.neu + '/_Spektron/ResultKit/_Ergebnisse.json', ERGEBNISSE);
  a[P.neu + '/Mitteilungen/'] = null;
  // Bericht übergeben am 20.07.2026 → Frist 31.10.2026 → fällig
  j(P.bericht + '/_Spektron/Buero/aufgaben/a-bericht-0001.json', aufgabe('a-bericht-0001', P.bericht, '2026-07-20T10:00:00.000Z'));
  j(P.bericht + '/_Spektron/LagerKit/26.0571_Lager.json', lager(P.bericht, [
    probe({ id: 'b-r1', nr: 1, code: 'LK260571R001', was: 'Brandschutt', ort: 'EG Küche Brandraum, Boden', art: 'Brandschutt/Asche', probenahme: '2026-07-14', von: 'Tst', platz: 'pa1', nrFest: { am: '2026-07-14T10:00:00Z', anlass: 'Etikett' } }),
    probe({ id: 'b-r2', nr: 2, code: 'LK260571R002', was: 'Kabelreste geschmolzen', ort: 'KG Heizungsraum', probenahme: '2026-07-14', von: 'Tst', platz: 'pa2', nrFest: { am: '2026-07-14T10:00:00Z', anlass: 'Etikett' },
      sperren: [{ id: 's1', wer: 'Dr. Pr', warum: 'Streitfall, Gutachten angefochten', am: '2026-09-03T08:00:00.000Z' }] }),
    probe({ id: 'b-r3', nr: 3, code: 'LK260571R003', was: 'Gipskarton verrußt', ort: 'EG Flur, Wand', probenahme: '2026-07-14', von: 'Tst', platz: 'pa1', nrFest: { am: '2026-07-14T10:00:00Z', anlass: 'Etikett' } }),
  ]));
  // kein Bericht: Probenahme 05.07.2026 → vorläufig 31.10.2026 → fällig mit Hinweis
  j(P.ohne + '/_Spektron/LagerKit/26.0590_Lager.json', lager(P.ohne, [
    probe({ id: 'o-r1', nr: 1, code: 'LK260590R001', was: 'Löschpulver', ort: 'KG Technikraum, Boden', art: 'Löschmittel', probenahme: '2026-07-05', von: 'Mbe', platz: 'pb3', nrFest: { am: '2026-07-05T10:00:00Z', anlass: 'Etikett' } }),
  ]));
  // Bericht übergeben (08.08.2026) und wieder zurückgeholt → zählt wie ohne Bericht: Probenahme 01.09.2026 → bis 31.12.2026 (nicht fällig, nicht bald)
  j(P.zurueck + '/_Spektron/Buero/aufgaben/a-zurueck-0001.json', aufgabe('a-zurueck-0001', P.zurueck, '2026-08-08T10:00:00.000Z'));
  j(P.zurueck + '/_Spektron/Buero/vermerke/v-zurueck-0001.json', vermerk('v-zurueck-0001', 'a-zurueck-0001', 'geloescht', '2026-08-09T10:00:00.000Z'));
  j(P.zurueck + '/_Spektron/LagerKit/26.0601_Lager.json', lager(P.zurueck, [
    probe({ id: 'z-r1', nr: 1, code: 'LK260601R001', was: 'Putz verrußt', ort: 'OG Bad, Wand', probenahme: '2026-09-01', von: 'Tst', platz: 'pb3', nrFest: { am: '2026-09-01T10:00:00Z', anlass: 'Etikett' } }),
  ]));
  a[P.alt + '/Laboraufträge/'] = null;
  return a;
}
module.exports = { MA, P, PL, EINST, archiv, LABELKIT, ERGEBNISSE, probe, lager, aufgabe, vermerk };
