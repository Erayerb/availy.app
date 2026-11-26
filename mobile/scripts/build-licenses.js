/**
 * Builds src/lib/licenses.json for Hakkında > Lisanslar ve veri kaynakları: every package the app ships with
 * (npm's production tree), its licence and copyright line, the full text of each licence once, and the fonts
 * and icons that are not npm packages. Run from mobile/ after adding or updating a package:
 *   node scripts/build-licenses.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

function licenseFile(dir) {
  const name = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  return name ? read(path.join(dir, name)) : '';
}

const copyrightLines = (text) =>
  [...new Set(text.split('\n').map((l) => l.trim()).filter((l) => /^(copyright|\(c\)|©)/i.test(l)))].slice(0, 3);

function licenseOf(pkg) {
  const l = pkg.license ?? pkg.licenses;
  if (typeof l === 'string') return l;
  if (Array.isArray(l)) return l.map((x) => x.type ?? x).join(' OR ');
  return l?.type ?? 'Belirtilmemiş';
}

const dirs = execSync('npm ls --omit=dev --all --parseable', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  .trim()
  .split('\n')
  .slice(1); // the first line is the app itself

const seen = new Map();
const texts = {};
for (const dir of dirs) {
  const pkg = JSON.parse(read(path.join(dir, 'package.json')) || '{}');
  if (!pkg.name || seen.has(pkg.name + pkg.version)) continue;
  const license = licenseOf(pkg).replace(/^\((.*)\)$/, '$1');
  const text = licenseFile(dir);
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
  const copyright = copyrightLines(text);
  seen.set(pkg.name + pkg.version, {
    name: pkg.name,
    version: pkg.version,
    license,
    copyright: copyright.length ? copyright : author ? [`© ${author.replace(/\s*[<(].*$/, '')}`] : [],
  });
  // One full text per licence, its copyright lines taken out (each package's own are listed with it)
  if (text && !texts[license]) texts[license] = text.split('\n').filter((l) => !/^\s*(copyright|\(c\)|©)/i.test(l)).join('\n').trim();
}

const packages = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
// Not npm packages: the icon font and the two Google fonts' font files (the packages' code is MIT)
// Venue data: Overture places (CDLA, its text must go with the shared data) and Foursquare OS Places (Apache 2.0:
// the licence, its NOTICE line and a note that we changed the data)
const FOURSQUARE = `Copyright 2024 Foursquare Labs, Inc. All rights reserved.
Licensed under the Apache License, Version 2.0.

availo, Foursquare Open Source Places kayıtlarını değiştirerek kullanır: yalnızca İstanbul'daki açık ve son iki yılda güncellenmiş kafe, restoran ve benzeri yerler alınır, kategoriler availo kategorilerine çevrilir, aynı yerin tekrarları birleştirilir ve kullanıcılar mekan eklerken bilgileri düzeltebilir. Değişiklikler: Kasım 2026 (ilk aktarım); her yenilemede aynı işlemler tekrarlanır.`;
const extras = [
  { group: 'data', name: 'Overture Maps Foundation, Places', license: 'CDLA-Permissive-2.0', text: read(path.join(ROOT, 'assets/licenses/CDLA-Permissive-2.0.txt')).trim() },
  { group: 'data', name: 'Foursquare Open Source Places', license: 'Apache-2.0', text: `${FOURSQUARE}\n\n${texts['Apache-2.0'] ?? ''}`.trim() },
  { group: 'font', name: 'Tabler Icons (ikon yazı tipi)', license: 'MIT', text: read(path.join(ROOT, 'assets/fonts/tabler-icons.LICENSE')).trim() },
  { group: 'font', name: 'Figtree (yazı tipi)', license: 'OFL-1.1', text: read(path.join(ROOT, 'node_modules/@expo-google-fonts/figtree/LICENSE_FONT')).trim() },
  { group: 'font', name: 'Tinos (yazı tipi)', license: 'OFL-1.1', text: read(path.join(ROOT, 'node_modules/@expo-google-fonts/tinos/LICENSE_FONT')).trim() },
];
if (!texts['Apache-2.0']) throw new Error('Apache-2.0 metni bulunamadı');
for (const e of extras) if (!e.text) throw new Error(`Lisans metni bulunamadı: ${e.name}`);

fs.writeFileSync(path.join(ROOT, 'src/lib/licenses.json'), JSON.stringify({ extras, packages, texts }) + '\n');
console.log(`${packages.length} paket, ${Object.keys(texts).length} lisans metni`);
