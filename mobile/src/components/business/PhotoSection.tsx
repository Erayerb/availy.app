import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../Pressable';

import type { Venue } from '../../lib/api';
import { venueApi } from '../../lib/venueApi';
import { themed } from '../../theme';
import { VenuePhoto } from '../VenuePhoto';
import { panel } from './panelStyles';

type Props = { venue: Venue; token: string; onSaved: () => void };

/** The cover photo, kept on the server: shown on the venue page and the home tiles to everyone. */
export function PhotoSection({ venue, token, onSaved }: Props) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setNote(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) return setNote({ ok: false, text: 'Fotoğraf okunamadı.' });
    setBusy(true);
    try {
      await venueApi.savePhoto(token, venue.id, `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
      setNote({ ok: true, text: '✓ Kapak fotoğrafı kaydedildi.' });
      onSaved();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    }
    setBusy(false);
  };

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Kapak fotoğrafı</Text>
      <Text style={panel.muted}>Mekan sayfasında ve ana sayfadaki kartta herkese görünür.</Text>
      <View style={styles.row}>
        <VenuePhoto venueId={venue.id} category={venue.category} photoAt={venue.photo_at} size={96} height={72} radius={12} />
        <Pressable style={[panel.secondary, styles.button]} onPress={pick} disabled={busy}>
          <Text style={panel.secondaryText}>{busy ? 'Yükleniyor…' : venue.photo_at ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}</Text>
        </Pressable>
      </View>
      {note && <Text style={note.ok ? panel.success : panel.error}>{note.text}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  button: { flex: 1 },
}));
