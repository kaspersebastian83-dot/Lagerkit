// Unveränderter LAGERKIT-KERN aus LagerKit 0.1.0 (main 5fb23c4) – nur für tests/kern-020.cjs: so verhält sich ein PC, der noch 0.1.0 hat.
/* ===== LAGERKIT-KERN – Regeln ohne Browserteile (in Node testbar: tests/kern-laden.cjs) =====
   Frist („Aufbewahren bis“), Nummern R1, R2 …, Codes für QR und Scanner, Zusammenführen gemeinsamer Dateien,
   Index der Übersicht, Laborproben aus LabelKit, „Asbest nachgewiesen“ aus ResultKit, Übergabe aus BüroKit.
   Datumsangaben sind Kalendertage als Text „JJJJ-MM-TT“; Zeitpunkte ISO-Zeit. */
(function (root) {
'use strict';
const VERSION = 1;                       // Dateifassung aller LagerKit-Dateien
const FORMAT = {
  projekt: 'spektron-lagerkit',                 // <Projekt>/_Spektron/LagerKit/<Nr>_Lager.json
  ohne: 'spektron-lagerkit-ohne-projekt',       // _LagerKit\Ohne-Projekt.json
  einst: 'spektron-lagerkit-einstellungen',     // _LagerKit\Einstellungen.json
  index: 'spektron-lagerkit-index',             // _LagerKit\Index.json (nur Zwischenspeicher)
};
const ARTEN = ['Materialprobe', 'Brandschutt/Asche', 'Löschmittel', 'Bohrkern-Rest', 'Wischprobe (Doppel)', 'Brandgeruch-Probe', 'Sonstige'];
const BEHAELTER = ['Glas', 'Beutel', 'Eimer', 'Kiste'];
const STANDARD_MONATE = 3;
const BALD_TAGE = 30;

/* ---------- Kalendertage ---------- */
const zwei = n => String(n).padStart(2, '0');
const DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;
function gueltig(s) {
  const m = DATUM.exec(String(s || '')); if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
/** letzter Tag des Monats; m0 = Monat ab 0, darf über 11 hinausgehen */
function monatsende(jahr, m0) {
  const d = new Date(Date.UTC(jahr, m0 + 1, 0));
  return d.getUTCFullYear() + '-' + zwei(d.getUTCMonth() + 1) + '-' + zwei(d.getUTCDate());
}
/** Stichtag + n Monate, bis Monatsende: 18.11.2026 + 3 → 28.02.2027 */
function fristAb(tag, monate) {
  if (!gueltig(tag)) return '';
  const [j, m] = tag.split('-').map(Number);
  return monatsende(j, m - 1 + (Number.isFinite(+monate) ? +monate : STANDARD_MONATE));
}
function plusTage(tag, n) {
  const [j, m, d] = tag.split('-').map(Number), x = new Date(Date.UTC(j, m - 1, d + n));
  return x.getUTCFullYear() + '-' + zwei(x.getUTCMonth() + 1) + '-' + zwei(x.getUTCDate());
}
const de = tag => gueltig(tag) ? tag.slice(8, 10) + '.' + tag.slice(5, 7) + '.' + tag.slice(0, 4) : '';
/** „18.11.2026“, „1.2.26“, „2026-11-18“ → „2026-11-18“; sonst '' */
function ausDe(text) {
  const t = String(text || '').trim();
  if (gueltig(t)) return t;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(t); if (!m) return '';
  const j = m[3].length === 2 ? 2000 + +m[3] : +m[3], s = j + '-' + zwei(m[2]) + '-' + zwei(m[1]);
  return gueltig(s) ? s : '';
}
/** Kalendertag eines Zeitpunkts in Würselen (Europe/Berlin) */
function berlinTag(zeit) {
  if (gueltig(zeit)) return zeit;
  const t = Date.parse(zeit); if (!Number.isFinite(t)) return '';
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t));
    const g = k => p.find(x => x.type === k).value; return g('year') + '-' + g('month') + '-' + g('day');
  } catch (e) { return new Date(t).toISOString().slice(0, 10); }
}
const heuteTag = jetzt => berlinTag((jetzt || new Date()).toISOString());

/* ---------- Ordnername (Projektzentrale, byte-gleich) ---------- */
const PROJ_RE = /^(\d{2})\.(\d{2,6})(?:[\s_-]+(.*))?$/;
/* SPEKTRON-ORDNERNAME v1 – in allen Apps identisch halten.
   Liest den Ordnernamen von hinten: Am Ende wird ein Kürzel der Mitarbeiterliste gesucht (bis zu drei Wörter, längster Treffer
   zuerst; verglichen ohne Groß-/Kleinschreibung, Leerzeichen und Punkte, also „Dr. Ka“ = „Dr.Ka“ = „dr ka“). Alles zwischen
   Projektnummer und Kürzel ist der Ort, mit oder ohne Straße. Nichts wird geraten: Kein Treffer → Ort = ganzer Rest, Hinweis.
   Ohne Mitarbeiterliste wird nichts abgetrennt (Verhalten wie vor 1.12). Kennung bleibt immer der volle Ordnername. */
const maNorm = s => String(s ?? '').normalize('NFC').toLowerCase().replace(/[\s.]+/g, '');
function leseProjektordner(name, personen){
  const m = PROJ_RE.exec(String(name).normalize('NFC').trim());
  if (!m) return null;
  const rest = (m[3] || '').trim();
  const r = { nr: `${m[1]}.${m[2]}`, yy: m[1], ort: rest, key: (+m[1]) * 1e6 + (+m[2]), kuerzel: '', hinweis: '' };
  if (!Array.isArray(personen) || !personen.length) return r;
  const woerter = [...rest.matchAll(/[^\s_]+/g)];
  for (let n = Math.min(3, woerter.length); n >= 1; n--){
    const ende = maNorm(woerter.slice(-n).map(w => w[0]).join(''));
    const p = personen.find(x => x && maNorm(x.ordnerKuerzel) === ende);
    if (!p) continue;
    r.kuerzel = String(p.ordnerKuerzel).trim();
    r.ort = rest.slice(0, woerter[woerter.length - n].index).replace(/[\s_-]+$/, '');
    if (!r.ort) r.hinweis = 'Im Ordnernamen fehlt der Ort.';
    return r;
  }
  r.hinweis = rest ? 'Kein bekanntes Kürzel am Ende des Ordnernamens.' : 'Im Ordnernamen fehlen Ort und Kürzel.';
  return r;
}
/* SPEKTRON-ORDNERNAME-ENDE */
/** Mitarbeiterliste (_Spektron-Mitarbeiter.json, gepflegt in der Projektzentrale) – nur lesen, wie LexiKit.
    → null (fehlt) | { kaputt } | { personen: [{ kuerzel, name, ordnerKuerzel, aktiv }] } */
function mitarbeiterLesen(text) {
  if (text == null) return null;
  let o; try { o = JSON.parse(text); } catch (e) { return { kaputt: 'keine lesbare JSON-Datei' }; }
  if (!o || o.format !== 'spektron-mitarbeiter' || !Array.isArray(o.personen)) return { kaputt: 'unbekanntes Format' };
  const personen = o.personen.filter(p => p && typeof p.ordnerKuerzel === 'string' && p.ordnerKuerzel.trim())
    .map(p => ({ kuerzel: p.ordnerKuerzel.trim(), ordnerKuerzel: p.ordnerKuerzel.trim(), name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : p.ordnerKuerzel.trim(), aktiv: p.aktiv !== false }));
  return personen.length ? { personen } : { kaputt: 'keine Personen in der Liste' };
}
/** „26.0612“ → { yy:'26', zahl:'0612', key } ; Projekte vor 26.0560 heißen „Vor Spektron“ */
function projektNr(text) {
  const m = /(?<!\d)(\d{2})\.(\d{2,6})(?!\d)/.exec(String(text || '').normalize('NFC'));
  return m ? { nr: m[1] + '.' + m[2], yy: m[1], zahl: m[2], key: (+m[1]) * 1e6 + (+m[2]) } : null;
}
const AB_KEY = 26 * 1e6 + 560;
const vorSpektron = nr => { const p = projektNr(nr); return !!p && p.key < AB_KEY; };

/* ---------- Codes (QR, Scanner, Suche) – nur Buchstaben und Ziffern, damit US- und DE-Tastatur gleich tippen ----------
   LK260612R002 = Projekt 26.0612, R2 · LKU0002 = Herkunft unklar U2 · LKP0001 = Regalplatz Nr. 1 */
function rCode(nr, n) {
  const p = projektNr(nr); if (!p || !(n >= 1)) return '';
  return 'LK' + p.yy + p.zahl + 'R' + String(n).padStart(3, '0');
}
const uCode = n => n >= 1 ? 'LKU' + String(n).padStart(4, '0') : '';
const pCode = n => n >= 1 ? 'LKP' + String(n).padStart(4, '0') : '';
const CODE_RE = /LK(?:(\d{2})(\d{2,6})R(\d{3,5})|U(\d{4,6})|P(\d{4,6}))/;
/** Eingabe (Scan, auch verstümmelt: Groß/klein, Zeichen davor/danach, Leerraum) → { art:'R'|'U'|'P', … } | null */
function codeLesen(text) {
  const t = String(text || '').normalize('NFKC').toUpperCase().replace(/\s+/g, '');
  const m = CODE_RE.exec(t); if (!m) return null;
  if (m[1]) return { art: 'R', projekt: m[1] + '.' + m[2], nr: +m[3], code: 'LK' + m[1] + m[2] + 'R' + m[3] };
  if (m[4]) return { art: 'U', nr: +m[4], code: 'LKU' + m[4] };
  return { art: 'P', nr: +m[5], code: 'LKP' + m[5] };
}
/** Suche von Hand: „26.0612 R2“, „26.0612-r 2“, „U2“ → wie ein Scan; sonst codeLesen */
function sucheLesen(text) {
  const t = String(text || '').normalize('NFC').trim();
  let m = /^(\d{2})[.,](\d{2,6})\s*[-–·/]?\s*R\s*(\d{1,5})$/i.exec(t);
  if (m) return { art: 'R', projekt: m[1] + '.' + m[2], nr: +m[3], code: rCode(m[1] + '.' + m[2], +m[3]) };
  m = /^U\s*(\d{1,6})$/i.exec(t);
  if (m) return { art: 'U', nr: +m[1], code: uCode(+m[1]) };
  return codeLesen(t);
}

/* ---------- QR-Code als SVG (Erzeuger: qrcode-generator, MIT, siehe README) ---------- */
/** Code → Matrix (true = dunkel). Version 1, Fehlerkorrektur M, Modus alphanumerisch (bis 20 Zeichen). */
function qrMatrix(code) {
  const Q = root.qrcode; if (typeof Q !== 'function') throw new Error('QR-Erzeuger fehlt');
  const q = Q(0, 'M'); q.addData(String(code), 'Alphanumeric'); q.make();
  const n = q.getModuleCount(), m = [];
  for (let r = 0; r < n; r++) { const z = []; for (let c = 0; c < n; c++) z.push(q.isDark(r, c)); m.push(z); }
  return m;
}
/** SVG mit Ruhezone (rand Module), Größe in mm; nur Rechtecke als ein Pfad – druckt auch ohne Hintergrundgrafik */
function qrSvg(code, mm, rand) {
  const m = qrMatrix(code), n = m.length, r = rand == null ? 2 : rand, g = n + 2 * r;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) d += 'M' + x + ' ' + y + 'h1v1h-1z';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="qr" role="img" aria-label="QR-Code ${code}" viewBox="${-r} ${-r} ${g} ${g}" width="${mm}mm" height="${mm}mm" shape-rendering="crispEdges"><rect x="${-r}" y="${-r}" width="${g}" height="${g}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/* ---------- Einträge mit Verlauf ---------- */
const zufall = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const neueId = () => (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : 'id-' + zufall() + zufall());
const text = (v, max) => typeof v === 'string' ? v.normalize('NFC').slice(0, max || 400) : '';
const warumOk = s => (String(s || '').match(/\p{L}/gu) || []).length >= 3;
const LISTEN = ['fristen', 'sperren', 'plaetze', 'ereignisse', 'gedruckt', 'codes', 'ansLabor', 'umbenannt'];
/** letzter Eintrag nach Zeit (dann id) */
/** Zeitpunkt in ms (ISO mit oder ohne Millisekunden gleich behandelt); unlesbar = ganz früh */
const ms = v => { const t = Date.parse(v); return Number.isFinite(t) ? t : -Infinity; };
const letzter = liste => (liste || []).slice().sort((a, b) => (ms(a.am) - ms(b.am)) || String(a.id).localeCompare(String(b.id))).pop() || null;

/** Aktive Sperre „Nicht entsorgen“ (letzte, nicht aufgehoben) */
function sperre(p) { const s = letzter(p && p.sperren); return s && !s.aufgehoben ? s : null; }
/** Entsorgt? Letztes „entsorgt“/„entsorgtZurueck“ entscheidet */
function entsorgt(p) {
  const e = letzter((p && p.ereignisse || []).filter(x => x.art === 'entsorgt' || x.art === 'entsorgtZurueck'));
  return e && e.art === 'entsorgt' ? e : null;
}
function nichtGefunden(p) {
  const e = letzter((p && p.ereignisse || []).filter(x => x.art === 'entsorgt' || x.art === 'nichtGefunden' || x.art === 'gefunden' || x.art === 'eingeraeumt'));
  return e && e.art === 'nichtGefunden' ? e : null;
}
/** Von Hand gesetztes Datum oder Verlängerung (die jüngste gilt) */
const handFrist = p => letzter((p && p.fristen || []).filter(f => gueltig(f.bis)));

/* ---------- Frist (Plan E6) ----------
   Mit übergebenem Bericht: Übergabe + n Monate, bis Monatsende – nie früher als die vorläufige Frist (der Bericht schiebt nur nach
   hinten). Ohne Bericht: vorläufig Probenahme + n Monate (Datum unbekannt: ab dem Erfassen). Von Hand / verlängert gilt vor der Regel.
   ctx = { monate, uebergabe: Tag|'' } */
function frist(p, ctx) {
  const monate = ctx && ctx.monate > 0 ? ctx.monate : STANDARD_MONATE, ueb = ctx && gueltig(ctx.uebergabe) ? ctx.uebergabe : '';
  const start = gueltig(p.probenahme) ? p.probenahme : berlinTag(p.erfasst || '');
  const vorlaeufig = fristAb(start, monate), ausBericht = ueb ? fristAb(ueb, monate) : '';
  const regel = ausBericht && ausBericht > vorlaeufig ? ausBericht : vorlaeufig;
  const h = handFrist(p);
  if (h) return { bis: h.bis, quelle: 'hand', regel, ueb, start, hand: h };
  return { bis: regel, quelle: ueb ? 'bericht' : 'vorlaeufig', regel, ueb, start, hand: null };
}
/** Zustand für Listen: status lager|bald|faellig|entsorgt|storniert, dazu Sperre, Hinweise */
function zustand(p, ctx, heute) {
  const f = frist(p, ctx), t = heute || heuteTag();
  const z = { frist: f, bis: f.bis, sperre: sperre(p), entsorgt: entsorgt(p), nichtGefunden: nichtGefunden(p), status: 'lager', keinBericht: false };
  if (p.storniert) z.status = 'storniert';
  else if (z.entsorgt) z.status = 'entsorgt';
  else if (f.bis && f.bis < t) z.status = 'faellig';
  else if (f.bis && f.bis <= plusTage(t, BALD_TAGE)) z.status = 'bald';
  z.keinBericht = z.status === 'faellig' && f.quelle === 'vorlaeufig';   // nur Hinweis, keine Sperre
  return z;
}
function fristText(f) {
  if (!f || !f.bis) return '';
  if (f.quelle === 'hand') return (f.hand && f.hand.art === 'verlaengert' ? 'verlängert' : 'von Hand') + (f.hand && f.hand.wer ? ' · ' + f.hand.wer : '');
  if (f.quelle === 'bericht') return 'Bericht übergeben ' + de(f.ueb);
  return 'vorläufig · noch kein Bericht';
}

/* ---------- Übergabe des Berichts (BüroKit-Aufgaben, nur lesen) ----------
   aufgaben = [{ id, art, erstellt }], vermerke = [{ aufgabe, schritt, wert, zeit, id }]. Zählt die zuletzt übergebene Mitteilung, die
   nicht zurückgenommen ist („geloescht“ = aus der Liste genommen / Zurückholen; „zurueck“ = vom Büro zurückgegeben, geplant). → Tag|'' */
function uebergabeTag(aufgaben, vermerke) {
  const zurueck = new Map();
  const vs = (vermerke || []).filter(v => v && (v.schritt === 'geloescht' || v.schritt === 'zurueck'))
    .sort((a, b) => String(a.zeit).localeCompare(String(b.zeit)) || String(a.id).localeCompare(String(b.id)));
  for (const v of vs) zurueck.set(v.aufgabe, v.wert !== false);
  let beste = '';
  for (const a of aufgaben || []) {
    if (!a || a.art !== 'gutachten' || zurueck.get(a.id)) continue;
    const t = berlinTag(a.erstellt || ''); if (t && t > beste) beste = t;
  }
  return beste;
}
/** Eine BüroKit-Aufgabe (spektron-buerokit v1) oder eine frühere Büroübergabe (spektron-buero v1) aus Text → Teile oder null */
function bueroAufgabeLesen(text, idAusName) {
  let o; try { o = JSON.parse(text); } catch (e) { return null; }
  if (o && o.format === 'spektron-buerokit' && o.typ === 'aufgabe' && o.id === idAusName) return { aufgabe: { id: o.id, art: o.art, erstellt: o.erstellt } };
  if (o && o.format === 'spektron-buerokit' && o.typ === 'vermerk' && o.id === idAusName) return { vermerk: { id: o.id, aufgabe: o.aufgabe, schritt: o.schritt, wert: o.wert !== false, zeit: o.zeit } };
  return null;
}
function altUebergabeLesen(auftragText, rueckmeldungen, id) {
  let o; try { o = JSON.parse(auftragText); } catch (e) { return null; }
  if (!o || o.format !== 'spektron-buero' || o.id !== id) return null;
  const vermerke = [];
  for (const t of rueckmeldungen || []) { let e; try { e = JSON.parse(t); } catch (x) { continue; } if (e && e.orderId === id && e.type === 'withdraw') vermerke.push({ id: e.id, aufgabe: id, schritt: 'geloescht', wert: true, zeit: e.at }); }
  return { aufgabe: { id, art: 'gutachten', erstellt: o.created }, vermerke };
}

/* ---------- „Asbest nachgewiesen“ aus _Ergebnisse.json (ResultKit) – gleiche Regel wie ResultKit uebersicht.ts asbestBefund ---------- */
const ASBEST = /asbest|chrysotil|amosit|krokydolith|tremolit|aktinolith|anthophyllit/i;
const POSITIV = /nachgewiesen|positiv|enthalten|gefunden|^ja$|chrysotil|amosit|krokydolith|tremolit|aktinolith|anthophyllit/i;
const NEGATIV = /nicht|kein|negativ|n\.\s*n\.|^<|unter/i;
const GEHALT = /^asbestgehalt\b/i;
const gehaltPositiv = w => GEHALT.test(w.p.trim()) && /\d/.test(w.r) && !/^\s*</.test(w.r) && !NEGATIV.test(w.r.trim());
function asbestGefunden(werte) {
  const a = (werte || []).filter(w => w && typeof w.p === 'string' && typeof w.r === 'string' && ASBEST.test(w.p) && !/^[-–—]?$/.test(w.r.trim()));
  return a.some(w => (POSITIV.test(w.r.trim()) && !NEGATIV.test(w.r.trim())) || gehaltPositiv(w));
}
/** _Ergebnisse.json (Text) → Set der LabelKit-Proben „P4“ mit Asbest nachgewiesen; unlesbar/fremd → leeres Set */
function asbestProben(text) {
  const aus = new Set(); let o;
  try { o = JSON.parse(text); } catch (e) { return aus; }
  if (!o || o.format !== 'spektron-ergebnisse' || o.version !== 1 || !Array.isArray(o.berichte)) return aus;
  const je = new Map();
  for (const b of o.berichte) for (const s of (b && b.proben) || []) {
    const l = String(s && s.label || '').toUpperCase(); if (!/^P\d+$/.test(l)) continue;
    je.set(l, (je.get(l) || []).concat(s.werte || []));
  }
  for (const [l, w] of je) if (asbestGefunden(w)) aus.add(l);
  return aus;
}

/* ---------- Laborproben aus der LabelKit-Datei (nur lesen; Texte werden in LagerKit nie bearbeitet) ---------- */
const LK_LISTEN = [['proben', 'PAK'], ['chloridProben', 'Chlorid'], ['asbestProben', 'Asbest'], ['sonstigeProben', 'Sonstige'], ['brandgeruchProben', 'Brandgeruch']];
const t2 = v => typeof v === 'string' ? v.normalize('NFC').trim() : (typeof v === 'number' ? String(v) : '');
const verbinde = (...t) => t.map(t2).filter(Boolean).join(', ');
function lkDatum(v) { return ausDe(t2(v)); }
/** LabelKit-Datei (JSON) → [{ liste, id, nr, label, art, storniert, was, ort, attribute, probenahme, matrix, artLager, titel }] */
function laborproben(lk) {
  const aus = [];
  if (!lk || typeof lk !== 'object') return aus;
  for (const [liste, art] of LK_LISTEN) {
    for (const p of Array.isArray(lk[liste]) ? lk[liste] : []) {
      if (!p || typeof p !== 'object') continue;
      const bg = liste === 'brandgeruchProben';
      const nr = bg ? Number(p.id) : Number(p._nr != null ? p._nr : p.chloridNr);
      if (!Number.isFinite(nr) || nr < 1) continue;
      let was, ort, attribute, artLager;
      if (liste === 'proben' || liste === 'chloridProben') {
        was = 'Wischprobe (Doppel) ' + art; ort = t2(p.z2); attribute = verbinde(p.z3, p.z4); artLager = 'Wischprobe (Doppel)';
      } else if (liste === 'asbestProben') {
        was = t2(p.z3) || t2(p.matrix) || 'Asbest Material'; ort = t2(p.z2); attribute = verbinde(p.z4, p.zustand); artLager = 'Materialprobe';
      } else if (liste === 'sonstigeProben' && /bohrkern/i.test(t2(p.matrix))) {
        was = 'Bohrkern-Rest' + (t2(p.bkId || p.bkBez) ? ' ' + t2(p.bkId || p.bkBez) : '') + (p.bkVon !== undefined && p.bkVon !== '' && p.bkBis !== undefined && p.bkBis !== '' ? ' · ' + t2(p.bkVon) + '–' + t2(p.bkBis) + ' cm' : '');
        ort = t2(p.z2); attribute = t2(p.bkMaterial); artLager = 'Bohrkern-Rest';
      } else if (liste === 'sonstigeProben') {
        was = t2(p.z3) || t2(p.matrix) || 'Sonstige Probe'; ort = t2(p.z2); attribute = t2(p.z4); artLager = /wisch/i.test(t2(p.matrix)) ? 'Wischprobe (Doppel)' : 'Sonstige';
      } else {
        was = 'Brandgeruch-Probe' + (t2(p.z1) ? ' · ' + t2(p.z1) : ''); ort = t2(p.z2) || t2(lk.brandgeruchOrt); attribute = ''; artLager = 'Brandgeruch-Probe';
      }
      const titel = bg ? 'Brandgeruch-Probe ' + nr : 'Probe ' + nr;
      aus.push({ liste, id: p.id, nr, label: bg ? 'B' + nr : 'P' + nr, art, storniert: !!p.storniert, was, ort, attribute,
        probenahme: bg ? lkDatum(lk.brandgeruchDatum) : lkDatum(p.datum), matrix: t2(p.matrix), artLager, titel });
    }
  }
  return aus.sort((a, b) => (a.liste === 'brandgeruchProben') - (b.liste === 'brandgeruchProben') || a.nr - b.nr);
}
const quelleKey = q => q ? q.liste + ':' + q.id : '';

/* ---------- Nummern R1, R2 … (Regel wie LabelKit 5.1) ----------
   Fest beim ersten Druck. Danach stornieren statt löschen; eine Nummer wird nie neu vergeben. Eine ganz leere Zeile darf weg –
   solange im Projekt keine Nummer fest ist, rücken die übrigen nach (wie LabelKit), sonst bleiben alle Nummern stehen. */
const istFest = p => !!(p && (p.nrFest || p.storniert));
const da = proben => (proben || []).filter(p => p && !p.weg);   // „weg“ = gelöschte ganz leere Zeile (bleibt als Vermerk, damit kein PC sie zurückbringt)
const festeDa = proben => da(proben).some(istFest);
const naechsteNr = proben => da(proben).reduce((m, p) => Math.max(m, Number(p.nr) || 0), 0) + 1;
/** „Ganz leer“: nicht fest, nicht aus LabelKit, kein Text. Was LagerKit selbst vorbelegt (Probenahme, Von, Art, Platz) zählt nicht. */
function ganzLeer(p) {
  if (!p || istFest(p) || p.quelle) return false;
  return !['was', 'ort', 'attribute', 'notiz', 'behaelter', 'gefunden'].some(k => t2(p[k])) && !p.verdacht && !(p.fristen || []).length && !(p.sperren || []).length;
}
function renummerieren(proben, am) {
  if (festeDa(proben)) return [];
  const geaendert = [];
  da(proben).sort((a, b) => (a.nr || 0) - (b.nr || 0)).forEach((p, i) => { if (p.nr !== i + 1) { p.nr = i + 1; if (am) p.geaendert = am; geaendert.push(p); } });
  return geaendert;
}
/** Löschen: ganz leer → weg; sonst stornieren (Name Pflicht). → 'weg' | 'storniert' | Fehlertext */
function loeschen(proben, id, wer, grund, am) {
  const i = proben.findIndex(p => p.id === id && !p.weg); if (i < 0) return 'Die Probe gibt es nicht mehr.';
  const p = proben[i];
  if (p.storniert) return 'Die Probe ist schon storniert.';
  if (ganzLeer(p)) { p.weg = am; p.nr = 0; p.geaendert = am; renummerieren(proben, am); return 'weg'; }
  if (!String(wer || '').trim()) return 'Bitte oben bei „Du bist“ deinen Namen wählen.';
  if (!p.nrFest) p.nrFest = { am, anlass: 'storniert' };
  p.storniert = { am, wer: String(wer).trim(), grund: text(grund, 300).trim() };
  p.geaendert = am;
  return 'storniert';
}
function nummernFestlegen(proben, ids, anlass, am) {
  let n = 0;
  for (const p of proben) if (ids.includes(p.id) && !istFest(p)) { p.nrFest = { am, anlass }; p.geaendert = am; n++; }
  return n;
}
/** Doppelte Nummern nach dem Zusammenführen (zwei PCs legten gleichzeitig „R3“ an): die nicht feste bekommt die nächste freie */
function nummernPruefen(proben) {
  const nach = new Map(), doppelt = [];
  const sortiert = proben.slice().sort((a, b) => (istFest(b) - istFest(a)) || (ms(a.erfasst) - ms(b.erfasst)) || String(a.id).localeCompare(String(b.id)));
  for (const p of sortiert) {
    if (p.weg) continue;
    if (!nach.has(p.nr)) { nach.set(p.nr, p); continue; }
    if (!istFest(p)) { p.nr = naechsteNr(proben); nach.set(p.nr, p); } else doppelt.push(p.nr);
  }
  return doppelt;   // beide fest = beide gedruckt: bleibt sichtbar als Warnung, nichts wird geraten
}

/* ---------- Zusammenführen (zwei PCs) ----------
   Einträge nach id; der Eintrag mit der jüngeren Änderung („geaendert“) gilt, die Verlaufslisten (Fristen, Sperren, Plätze, Ereignisse,
   Drucke, Codes) werden vereinigt – nie geht ein Vermerk verloren. Fest/storniert bleibt, wenn eine Seite es hat. */
function eintragMergen(a, b) {
  if (!a) return JSON.parse(JSON.stringify(b));
  if (!b) return JSON.parse(JSON.stringify(a));
  const neuer = ms(b.geaendert) > ms(a.geaendert) ? b : a, alt = neuer === a ? b : a;
  const out = JSON.parse(JSON.stringify(neuer));
  for (const k of LISTEN) {
    const ids = new Map();
    for (const x of [...(alt[k] || []), ...(neuer[k] || [])]) {
      if (!x) continue; const key = x.id || x.code || JSON.stringify(x), d = ids.get(key);
      ids.set(key, d ? Object.assign({}, d, x, d.aufgehoben && !x.aufgehoben ? { aufgehoben: d.aufgehoben } : {}) : Object.assign({}, x));
    }
    if (ids.size) out[k] = [...ids.values()].sort((x, y) => (ms(x.am) - ms(y.am)) || String(x.id || '').localeCompare(String(y.id || '')));
  }
  for (const k of ['nrFest', 'storniert']) if (!out[k] && alt[k]) out[k] = alt[k];
  if (out.nrFest && alt.nrFest && ms(alt.nrFest.am) < ms(out.nrFest.am)) out.nrFest = alt.nrFest;
  return out;
}
function listeMergen(disk, eigene) {
  const nach = new Map((disk || []).map(x => [x.id, x]));
  for (const x of eigene || []) nach.set(x.id, eintragMergen(nach.get(x.id), x));
  return [...nach.values()];
}
/** Inhalt eines Eintrags ohne Verlauf und Stempel (Nummer zählt nicht: die kann beim Zusammenführen weiterrücken) */
const inhalt = x => JSON.stringify(Object.keys(x || {}).filter(k => !LISTEN.includes(k) && k !== 'geaendert' && k !== 'nr' && k !== 'code').sort().map(k => [k, x[k]]));
/** Felder, die diese Seite gegenüber dem zuletzt gelesenen Stand (_basis) geändert hat; ohne _basis null (ganzer Eintrag gilt) */
function geaenderteFelder(x) {
  const b = x && x._basis; if (!b) return null;
  return [...new Set([...Object.keys(x), ...Object.keys(b)])].filter(k => !LISTEN.includes(k) && k !== 'geaendert' && k !== '_basis' && JSON.stringify(x[k]) !== JSON.stringify(b[k]));
}
/** Eigene Änderung auf den Stand der Platte legen: nur die geänderten Felder (ein anderer PC kann andere Felder geändert haben) */
function aufPlatteLegen(d, x) {
  const f = geaenderteFelder(x); if (!d || !f) { const y = Object.assign({}, x); delete y._basis; return y; }
  const y = JSON.parse(JSON.stringify(d));
  for (const k of f) { if (x[k] === undefined) delete y[k]; else y[k] = JSON.parse(JSON.stringify(x[k])); }
  for (const k of LISTEN) if (x[k]) y[k] = x[k];
  y.geaendert = x.geaendert;
  return y;
}
/** Steht alles Eigene in der Datei (geänderte Felder bzw. ganzer Inhalt gleich, alle Vermerke da)? */
function enthaelt(disk, eigene) {
  const nach = new Map((disk || []).map(x => [x.id, x]));
  return (eigene || []).every(x => {
    const d = nach.get(x.id); if (!d) return false;
    const f = geaenderteFelder(x);
    if (f ? f.some(k => JSON.stringify(d[k]) !== JSON.stringify(x[k])) : inhalt(d) !== inhalt(x)) return false;
    return LISTEN.every(k => (x[k] || []).every(e => (d[k] || []).some(f => (f.id || f.code) === (e.id || e.code) && (!e.aufgehoben || f.aufgehoben))));
  });
}
/* Die vier Dateiarten: Schlüssel der Liste, Prüfung beim Lesen */
const DATEIEN = {
  projekt: { format: FORMAT.projekt, feld: 'proben' },
  ohne: { format: FORMAT.ohne, feld: 'proben' },
  einst: { format: FORMAT.einst, feld: 'plaetze' },
  index: { format: FORMAT.index, feld: 'projekte' },
};
/** Text → null (keine Datei) | { kaputt, neuer? } | Inhalt */
function dateiLesen(art, txt) {
  const G = DATEIEN[art];
  if (txt == null || txt === '') return null;
  let j; try { j = JSON.parse(String(txt).replace(/^﻿/, '')); } catch (e) { return { kaputt: 'keine lesbare JSON-Datei' }; }
  if (!j || j.format !== G.format || !Array.isArray(j[G.feld])) return { kaputt: 'fremdes Format' };
  if (!(j.version >= 1)) return { kaputt: 'unbekannte Fassung' };
  if (j.version > VERSION) return { kaputt: 'aus einer neueren LagerKit-Fassung', neuer: true, inhalt: j };
  return j;
}
function leer(art, extra) {
  const G = DATEIEN[art], o = { format: G.format, version: VERSION, app: { name: 'LagerKit', version: (root.LAGERKIT_VERSION || '') } };
  o[G.feld] = [];
  if (art === 'einst') o.fristMonate = STANDARD_MONATE;
  if (art === 'projekt') { o.projekt = {}; o.ansLabor = []; }
  return Object.assign(o, extra || {});
}
/** Platte + eigene Änderungen → vereinigt. eigene = { eintraege: [...], felder?: { fristMonate, … mit geaendertFelder } } */
function mergen(art, disk, eigene) {
  const G = DATEIEN[art], base = disk && !disk.kaputt ? disk : leer(art);
  const out = Object.assign({}, base, { format: G.format, version: VERSION, app: { name: 'LagerKit', version: (root.LAGERKIT_VERSION || '') } });
  // Eigene Änderung gilt (zuletzt gespeichert gewinnt) – auch wenn die Uhr dieses PCs hinter der des anderen geht: der Stempel wird
  // dann knapp hinter den der Platte gesetzt. Vermerke (Fristen, Sperren, Plätze, Ereignisse …) gehen dabei nie verloren.
  const aufPlatte = new Map(((base[G.feld]) || []).map(x => [x.id, x]));
  const gelegt = (eigene.eintraege || []).map(x => {
    const d = eigene.ersetzen ? null : aufPlatte.get(x.id), y = aufPlatteLegen(d, x);
    if (d && ms(d.geaendert) >= ms(y.geaendert)) y.geaendert = new Date(Math.max(0, ms(d.geaendert)) + 1).toISOString();
    return y;
  });
  out[G.feld] = listeMergen(eigene.ersetzen ? [] : base[G.feld], gelegt);
  if (art === 'projekt') { nummernPruefen(out.proben); out.ansLabor = listeMergen(base.ansLabor || [], eigene.ansLabor || []); }
  if (art === 'ohne') nummernPruefen(out.proben);
  if (art === 'einst') platzNummernPruefen(out.plaetze);
  if (eigene.felder) {   // einzelne Felder (Standardfrist, Projektangaben): die jüngere Änderung gilt
    const f = eigene.felder, d = base.felderGeaendert || {};
    out.felderGeaendert = Object.assign({}, d);
    for (const k of Object.keys(f.werte || {})) if (ms(f.am) > ms(d[k])) { out[k] = f.werte[k]; out.felderGeaendert[k] = f.am; }
  }
  return out;
}
function enthaeltAlles(art, disk, eigene) {
  if (!disk || disk.kaputt) return false;
  const G = DATEIEN[art];
  if (!enthaelt(disk[G.feld], eigene.eintraege)) return false;
  if (art === 'projekt' && !enthaelt(disk.ansLabor || [], eigene.ansLabor || [])) return false;
  if (eigene.felder) { const d = disk.felderGeaendert || {}; for (const k of Object.keys(eigene.felder.werte || {})) if (ms(d[k]) < ms(eigene.felder.am)) return false; }
  return true;
}
/** Sicher schreiben (wie LexiKit 0.4.0): neu lesen, vereinigen, schreiben, nach 1,5 s zurücklesen, prüfen, sonst noch einmal.
    Eine unlesbare oder neuere Datei wird nie überschrieben. io = { lesen() → Text|null, schreiben(text), warten(ms) } → Stand der Platte */
async function sicherSchreiben(io, art, eigene, opt) {
  opt = opt || {}; const versuche = opt.versuche || 4;
  for (let v = 0; v < versuche; v++) {
    let disk = dateiLesen(art, await io.lesen());
    if (disk && disk.kaputt && !disk.neuer && opt.kaputtErsetzen) disk = null;   // nur der Index: er ist eine Kopie der Projektdateien
    if (disk && disk.kaputt) throw Object.assign(new Error(disk.neuer ? 'Die Datei stammt aus einer neueren LagerKit-Fassung – bitte LagerKit neu laden. LagerKit überschreibt sie nicht.' : 'Die Datei ist nicht lesbar (' + disk.kaputt + ') – LagerKit überschreibt sie nicht.'), { kaputt: true, neuer: !!disk.neuer });
    if (disk && enthaeltAlles(art, disk, eigene) && !opt.immer) return disk;
    const out = mergen(art, disk, eigene);
    out.gespeichertAm = new Date().toISOString();
    if (opt.vorSchreiben) await opt.vorSchreiben(disk);
    await io.schreiben(JSON.stringify(out, null, art === 'index' ? 0 : 1) + '\n');
    if (opt.zwischen) await opt.zwischen(v);   // nur Tests: hier schreibt „ein anderer PC“
    await io.warten(opt.warten == null ? 1500 : opt.warten);
    const nach = dateiLesen(art, await io.lesen());
    if (nach && !nach.kaputt && enthaeltAlles(art, nach, eigene)) return nach;
    opt.immer = false;
  }
  throw new Error('Die Änderungen ließen sich nach ' + versuche + ' Versuchen nicht sicher speichern – vermutlich schreibt gerade ein anderer PC. Bitte gleich noch einmal.');
}

/* ---------- Index der Übersicht (Zwischenspeicher, jederzeit neu aufbaubar) ---------- */
/** Ein Projekt → Eintrag im Index. info = { ordner, personen, uebergabe, asbest:Set, monate, stand:{t,size}, lk: laborproben } */
function indexEintrag(lager, info) {
  const o = leseProjektordner(info.ordner, info.personen) || { nr: (projektNr(info.ordner) || {}).nr || '', ort: '', kuerzel: '' };
  const ctx = { monate: info.monate, uebergabe: info.uebergabe };
  const proben = da((lager && lager.proben) || []).filter(p => !p.storniert && !ganzLeer(p)).map(p => kurzProbe(p, ctx, info));
  return { id: info.ordner, ordner: info.ordner, nr: o.nr, ort: o.ort, kuerzel: o.kuerzel, uebergabe: info.uebergabe || '', asbest: [...(info.asbest || [])], gelesen: info.gelesen || new Date().toISOString(),
    geaendert: info.gelesen || new Date().toISOString(), stand: info.stand || null, proben };
}
function kurzProbe(p, ctx, info) {
  const f = frist(p, ctx), s = sperre(p), e = entsorgt(p), ng = nichtGefunden(p);
  const q = p.quelle || null, asb = !!(q && info && info.asbest && info.asbest.has(String(q.label || '').toUpperCase()));
  return { id: p.id, nr: p.nr, code: p.code || '', was: p.was || '', ort: p.ort || '', attribute: p.attribute || '', art: p.art || '', behaelter: p.behaelter || '',
    probenahme: p.probenahme || '', unbekannt: !!p.probenahmeUnbekannt, von: p.von || '', platz: p.platz || '', bis: f.bis, quelle: f.quelle, fristHand: f.hand ? { art: f.hand.art, wer: f.hand.wer } : null,
    sperre: s ? { wer: s.wer, warum: s.warum, am: s.am } : null, entsorgt: e ? { wer: e.wer, am: e.am } : null, nichtGefunden: ng ? { wer: ng.wer, am: ng.am } : null,
    asbest: asb, verdacht: !!p.verdacht, rest: q ? q.titel || '' : '', nachtraeglich: !!p.nachtraeglich, festNr: !!p.nrFest, ausU: p.ausU || '' };
}
/** Status aus einem Index-Eintrag (Frist steht schon drin, „heute“ entscheidet) */
function kurzStatus(k, heute) {
  const t = heute || heuteTag();
  if (k.entsorgt) return 'entsorgt';
  if (k.bis && k.bis < t) return 'faellig';
  if (k.bis && k.bis <= plusTage(t, BALD_TAGE)) return 'bald';
  return 'lager';
}

/* ---------- Regalplätze ---------- */
const naechsterPlatzNr = plaetze => (plaetze || []).reduce((m, p) => Math.max(m, Number(p.nr) || 0), 0) + 1;
/** Doppelte Platznummern nach dem Zusammenführen: der später angelegte bekommt die nächste freie Nummer */
function platzNummernPruefen(plaetze) {
  const nach = new Map();
  for (const p of plaetze.slice().sort((a, b) => (ms(a.angelegt) - ms(b.angelegt)) || String(a.id).localeCompare(String(b.id)))) {
    if (nach.has(p.nr) && !(p.gedruckt || []).length) { p.nr = naechsterPlatzNr(plaetze); p.code = pCode(p.nr); }
    nach.set(p.nr, p);
  }
  return plaetze;
}
/** Sortierung wie im Regal: „Regal A · Fach 2“ vor „Regal A · Fach 10“, unbenutzte zuletzt */
const platzSort = (a, b) => (!!a.nichtMehr - !!b.nichtMehr) || String(a.name).localeCompare(String(b.name), 'de', { numeric: true });

const api = { VERSION, FORMAT, ARTEN, BEHAELTER, STANDARD_MONATE, BALD_TAGE, gueltig, monatsende, fristAb, plusTage, de, ausDe, berlinTag, heuteTag,
  PROJ_RE, maNorm, leseProjektordner, mitarbeiterLesen, projektNr, vorSpektron, rCode, uCode, pCode, codeLesen, sucheLesen, qrMatrix, qrSvg,
  neueId, text, warumOk, letzter, sperre, entsorgt, nichtGefunden, handFrist, frist, zustand, fristText, uebergabeTag, bueroAufgabeLesen, altUebergabeLesen,
  asbestGefunden, asbestProben, laborproben, quelleKey, istFest, da, festeDa, naechsteNr, ganzLeer, renummerieren, loeschen, nummernFestlegen, nummernPruefen,
  eintragMergen, listeMergen, enthaelt, geaenderteFelder, aufPlatteLegen, dateiLesen, leer, mergen, enthaeltAlles, sicherSchreiben, indexEintrag, kurzProbe, kurzStatus,
  naechsterPlatzNr, platzNummernPruefen, platzSort, LISTEN };
root.LagerKern = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
/* ===== Ende LAGERKIT-KERN ===== */
