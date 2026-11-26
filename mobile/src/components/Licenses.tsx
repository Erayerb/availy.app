import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';
import { colors, themed } from '../theme';
import data from '../lib/licenses.json';

type Package = { name: string; version: string; license: string; copyright: string[] };
const TEXTS = data.texts as Record<string, string>;
const PACKAGES = data.packages as Package[];
// The full text for a package's licence ("MIT OR Apache-2.0" uses the first one there is)
const textFor = (license: string) => TEXTS[license] ?? license.split(/ OR | AND /).map((l) => TEXTS[l]).find(Boolean);

/**
 * Hakkında > Lisanslar ve veri kaynakları: what the data and licences ask to be shown. Venue data and map
 * credits, the fonts and icons with their full licence texts, and every open source package in the app.
 * The package list comes from scripts/build-licenses.js.
 */
export function Licenses() {
  const [open, setOpen] = useState<string | null>(null); // an extra's name, 'packages', or 'text:<licence>'
  const toggle = (key: string) => setOpen((now) => (now === key ? null : key));
  const extras = (group: string) =>
    data.extras
      .filter((extra) => extra.group === group)
      .map((extra) => (
        <View key={extra.name}>
          <Pressable onPress={() => toggle(extra.name)} style={styles.row} accessibilityRole="button">
            <Text style={[styles.line, styles.flex]}>{extra.name}</Text>
            <Text style={styles.license}>{extra.license} {open === extra.name ? '▴' : '▾'}</Text>
          </Pressable>
          {open === extra.name && <Text style={styles.licenseText}>{extra.text}</Text>}
        </View>
      ));
  const counts = PACKAGES.reduce<Record<string, number>>((all, p) => ({ ...all, [p.license]: (all[p.license] ?? 0) + 1 }), {});

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Lisanslar ve veri kaynakları</Text>

      <Text style={styles.heading}>Mekan verileri</Text>
      <Text style={styles.line}>• © OpenStreetMap katkıcıları. Veriler Open Database License (ODbL) ile kullanılır: openstreetmap.org/copyright</Text>
      <Text style={styles.line}>• Haritada olmayan mekanları eklerken önerilen yerler ve işletme doğrulaması için iletişim bilgileri:</Text>
      {extras('data')}
      <Text style={styles.muted}>Doluluk yalnızca kullanıcıların check-in'lerinden hesaplanır.</Text>

      <Text style={styles.heading}>Harita ve adres</Text>
      <Text style={styles.line}>• iPhone'da harita Apple Haritalar, Android'de Google Haritalar'dır; her biri kendi kullanım koşullarına tabidir (haritanın köşesindeki yazı).</Text>
      <Text style={styles.line}>• Adres: OpenStreetMap Nominatim. Yer araması: Photon (komoot, Apache 2.0). İkisinin verisi de © OpenStreetMap katkıcıları (ODbL).</Text>

      <Text style={styles.heading}>Yazı tipleri ve ikonlar</Text>
      {extras('font')}

      <Text style={styles.heading}>Açık kaynak yazılımlar</Text>
      <Text style={styles.muted}>
        availo {PACKAGES.length} açık kaynak paketi kullanır. Her birinin telif sahibi ve lisansı aşağıda; lisans metni için lisansın adına dokun.
      </Text>
      <View style={styles.chips}>
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([license, n]) => (
            <Pressable key={license} style={styles.chip} onPress={() => toggle(`text:${license}`)} accessibilityRole="button">
              <Text style={styles.chipText}>{license} · {n}</Text>
            </Pressable>
          ))}
      </View>
      {open?.startsWith('text:') && (
        <Text style={styles.licenseText}>{textFor(open.slice(5)) ?? 'Bu lisansın metni paketin içinde yer alır.'}</Text>
      )}
      <Pressable onPress={() => toggle('packages')} style={styles.row} accessibilityRole="button">
        <Text style={[styles.link, styles.flex]}>{open === 'packages' ? 'Paket listesini gizle' : 'Paket listesini göster'}</Text>
      </Pressable>
      {open === 'packages' &&
        PACKAGES.map((p) => (
          <View key={p.name + p.version} style={styles.pkg}>
            <Text style={styles.pkgName}>
              {p.name} <Text style={styles.muted}>{p.version} · {p.license}</Text>
            </Text>
            {p.copyright.map((line) => (
              <Text key={line} style={styles.muted}>{line}</Text>
            ))}
          </View>
        ))}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: { padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6 },
    title: { fontSize: 15, fontWeight: '800', color: colors.text },
    heading: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 8 },
    line: { fontSize: 14, color: colors.text, lineHeight: 20 },
    muted: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    flex: { flex: 1 },
    license: { fontSize: 13, fontWeight: '600', color: colors.primary },
    licenseText: { fontSize: 11, color: colors.textMuted, lineHeight: 16, padding: 10, borderRadius: 10, backgroundColor: colors.background },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
    chipText: { fontSize: 12, color: colors.text },
    link: { fontSize: 14, fontWeight: '700', color: colors.primary },
    pkg: { paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    pkgName: { fontSize: 13, fontWeight: '600', color: colors.text },
  }),
);
