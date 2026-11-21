// QR-Erzeuger und Kern-Block aus index.html holen und in Node ausführen (die App bleibt eine einzige HTML-Datei).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const block = (anfang, ende) => { const a = html.indexOf(anfang), e = html.indexOf(ende); if (a < 0 || e < a) throw new Error(anfang + ' fehlt in index.html'); return html.slice(a, e); };
vm.runInThisContext(block('/* ===== QR-ERZEUGER', '/* ===== Ende QR-ERZEUGER ===== */'), { filename: 'index.html#qr' });
vm.runInThisContext(block('/* ===== LAGERKIT-KERN', '/* ===== Ende LAGERKIT-KERN ===== */'), { filename: 'index.html#kern' });
module.exports = globalThis.LagerKern;
