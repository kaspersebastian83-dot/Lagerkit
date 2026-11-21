// Spektron-Look byte-gleich mit BerichtKit und LexiKit, spektron-ordner.js byte-gleich mit der Projektzentrale, Offline-Dateien
// vollständig, kein Netz, App-Farbe mit genug Kontrast, QR-Erzeuger mit Lizenzhinweis. node tests/dateien.cjs
// (liegen ../berichtkit, ../lexikit, ../projektzentrale daneben, wird verglichen; mit LAGERKIT_LOOK_PFLICHT=1 müssen sie daneben liegen)
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const pflicht = !!process.env.LAGERKIT_LOOK_PFLICHT, verglichen = [];
// 1. Spektron-Look
const look = t => { const a = t.indexOf('/* ===== SPEKTRON-LOOK v'), e = t.indexOf('/* ===== Ende SPEKTRON-LOOK v'); return a < 0 || e < 0 ? null : t.slice(a, e); };
const eigen = look(html);
assert.ok(eigen && eigen.startsWith('/* ===== SPEKTRON-LOOK v1'), 'Look-Block v1 in index.html');
assert.equal(html.split('/* ===== SPEKTRON-LOOK v').length, 2, 'Look-Block genau einmal');
for (const app of ['berichtkit', 'lexikit']) {
  const f = path.join(ROOT, '..', app, 'index.html');
  if (fs.existsSync(f)) { assert.equal(eigen, look(fs.readFileSync(f, 'utf8')), 'Spektron-Look nicht byte-gleich mit ' + app); verglichen.push(app); }
  else assert.ok(!pflicht, '../' + app + ' fehlt – Look nicht verglichen');
}
// 2. App-Farbe nach dem Block, Kontrast auf Weiß mindestens 4,5 : 1
const farbe = /--sp-app:(#[0-9a-f]{6});\s*--sp-app-dunkel:(#[0-9a-f]{6})/i.exec(html.slice(html.indexOf('/* ===== Ende SPEKTRON-LOOK v')));
assert.ok(farbe, 'App-Farbe nach dem Block');
const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const kontrast = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
for (const f of [farbe[1], farbe[2]]) assert.ok(kontrast(f, '#ffffff') >= 4.5, f + ' auf Weiß unter 4,5 : 1');
const belegt = ['#5469b8', '#2f87a6', '#7a5ca8', '#4179b2', '#b0683c', '#2f7d6d', '#3a8a83', '#8a5f0f', '#2c3e60', '#5b6b78'];   // Leiste, LexiKit, FinanzKit, TeamKit, Büro
assert.ok(!belegt.includes(farbe[1].toLowerCase()), 'App-Farbe schon vergeben');
// 3. spektron-ordner.js byte-gleich mit der Projektzentrale (Vorlage)
const so = fs.readFileSync(path.join(ROOT, 'spektron-ordner.js'), 'utf8');
assert.match(so, /^\/\* SPEKTRON-ORDNER v1 /); assert.match(so, /\/\* SPEKTRON-ORDNER-ENDE \*\/\n?$/);
const pz = path.join(ROOT, '..', 'projektzentrale', 'spektron-ordner.js');
if (fs.existsSync(pz)) { assert.equal(so, fs.readFileSync(pz, 'utf8'), 'spektron-ordner.js nicht byte-gleich mit der Projektzentrale'); verglichen.push('projektzentrale'); }
else assert.ok(!pflicht, '../projektzentrale fehlt – spektron-ordner.js nicht verglichen');
// 4. Offline: jede Datei im Service Worker gibt es, jede eingebundene Datei ist dabei
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const a of assets) if (a !== './') assert.ok(fs.existsSync(path.join(ROOT, a)), 'fehlt: ' + a);
for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) assert.ok(assets.includes('./' + m[1]), 'nicht offline: ' + m[1]);
// 5. Kein Netz: keine Netzaufrufe in der App, Inhaltsregel lässt nur die eigene Adresse zu
for (const v of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource', 'import(']) assert.ok(!html.includes(v), 'Netzaufruf in index.html: ' + v);
assert.match(html, /connect-src 'self'/);
assert.ok(!/<script[^>]+src="https?:/.test(html), 'kein fremdes Skript');
// 6. QR-Erzeuger eingebettet, mit Lizenzhinweis (auch im README)
assert.match(html, /QR Code Generator for JavaScript[\s\S]{0,200}Copyright \(c\) 2009 Kazuhiko Arase[\s\S]{0,200}MIT license/);
assert.match(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'), /Kazuhiko Arase.*MIT/);
console.log(`Dateien: Look/Ordner verglichen mit ${verglichen.join(', ') || '(nichts daneben)'}, Farbe ${farbe[1]} (${kontrast(farbe[1], '#ffffff').toFixed(2)} : 1), ${assets.length} Offline-Dateien, kein Netz`);
