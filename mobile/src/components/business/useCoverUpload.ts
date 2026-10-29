import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import type { Venue } from '../../lib/api';
import { venueApi } from '../../lib/venueApi';

/** Pick a photo from the phone and save it as the venue's cover (İşletme Profili and the panel's card). */
export function useCoverUpload(venue: Venue, token: string, onSaved: () => void) {
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
  return { pick, busy, note };
}
