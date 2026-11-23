import * as Print from 'expo-print';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { Venue } from '../../lib/api';
import { doorPosterHtml, doorStickerHtml } from '../../lib/doorPoster';
import { venueDoorLink } from '../../lib/share';
import { Pressable } from '../Pressable';
import { Text } from '../Text';
import { Logo } from '../Logo';
import { panel } from './panelStyles';

/** İşletme profili > Kapı QR'ı: printed on the door; customers scan it and land on the venue's check-in. */
export function DoorQrSection({ venue }: { venue: Venue }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = venueDoorLink(venue.id);

  const print = async (kind: 'sticker' | 'poster') => {
    setError(null);
    const html = kind === 'sticker' ? doorStickerHtml(venue.name, link) : doorPosterHtml(venue.name, link);
    try {
      if (Platform.OS === 'web') {
        const page = window.open('', '_blank');
        if (!page) throw new Error('blocked');
        page.document.write(html);
        page.document.close();
        page.print();
      } else {
        await Print.printAsync({ html });
      }
    } catch {
      setError('Yazdırma açılamadı, tekrar dene.');
    }
  };

  return (
    <View style={panel.card}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={panel.sectionTitle}>Kapı QR'ı</Text>
        <Text style={panel.muted}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={panel.muted}>
            Kapına ya da masalara yapıştır. Müşterin okutunca mekan sayfan açılır ve tek dokunuşla check-in yapar (yine mekanda olmayı
            ister). Geçenler "availo'da" olduğunu görür.
          </Text>
          {/* The sticker as it prints: dark, the mark, the question, the code */}
          <View style={styles.sticker}>
            <View style={styles.stickerTop}>
              <Logo size={24} color="#FBF4E8" />
              <Text style={styles.stickerDa}>availo'da</Text>
            </View>
            <Text style={styles.stickerQ}>Şu an burası nasıl?</Text>
            <View style={styles.stickerCode}>
              <QRCode value={link} size={130} />
            </View>
            <Text style={styles.stickerHow}>Okut, check-in yap, puan kazan</Text>
            <Text style={styles.stickerName} numberOfLines={1}>{venue.name}</Text>
          </View>
          <Pressable style={panel.primary} onPress={() => print('sticker')}>
            <Text style={panel.primaryText}>Çıkartmayı yazdır (9×9 cm, sayfada 4 tane)</Text>
          </Pressable>
          <Pressable style={panel.secondary} onPress={() => print('poster')}>
            <Text style={panel.secondaryText}>Büyük afiş (A4)</Text>
          </Pressable>
          {error && <Text style={panel.error}>{error}</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sticker: { alignSelf: 'center', width: 250, height: 250, borderRadius: 28, backgroundColor: '#17110E', padding: 14, alignItems: 'center', justifyContent: 'space-between' },
  stickerTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stickerDa: { color: '#FBF4E8', fontSize: 20, fontWeight: '700', marginLeft: 1 },
  stickerQ: { color: '#FBF4E8', fontSize: 14, fontWeight: '800' },
  stickerCode: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 5 },
  stickerHow: { color: '#FFB4A8', fontSize: 11, fontWeight: '800' },
  stickerName: { color: '#FBF4E8', fontSize: 10, opacity: 0.85, maxWidth: 210 },
});
