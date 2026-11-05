import * as Print from 'expo-print';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { Venue } from '../../lib/api';
import { doorPosterHtml } from '../../lib/doorPoster';
import { venueDoorLink } from '../../lib/share';
import { Pressable } from '../Pressable';
import { Text } from '../Text';
import { panel } from './panelStyles';

/** İşletme profili > Kapı QR'ı: printed on the door; customers scan it and land on the venue's check-in. */
export function DoorQrSection({ venue }: { venue: Venue }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = venueDoorLink(venue.id);

  const print = async () => {
    setError(null);
    const html = doorPosterHtml(venue.name, link);
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
          <Text style={panel.muted}>Yazdırıp kapına as. Müşterin okutunca mekan sayfan açılır ve check-in yapar; check-in yine mekanda olmayı ister.</Text>
          <View style={{ alignSelf: 'center', padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12 }}>
            <QRCode value={link} size={170} />
          </View>
          <Pressable style={panel.primary} onPress={print}>
            <Text style={panel.primaryText}>Yazdır ya da PDF kaydet</Text>
          </Pressable>
          {error && <Text style={panel.error}>{error}</Text>}
        </>
      )}
    </View>
  );
}
