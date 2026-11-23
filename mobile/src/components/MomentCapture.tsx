import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { momentsApi, type Audience } from '../lib/moments';
import { socialApi } from '../lib/social';
import { notifyVenuesChanged } from '../lib/venueEvents';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

// Wide enough to see the room, small enough to send quickly (and under the server's size limit)
const WIDTH = 1080;

type Props = { token: string; checkinId: number };

/**
 * After a check-in: "Şu anı paylaş". The camera only (no gallery), so the photo is really from now.
 * Phone app only: in a browser we cannot tell a fresh photo from an old file.
 */
export function MomentCapture({ token, checkinId }: Props) {
  const [audience, setAudience] = useState<Audience>('everyone');
  // The photo taken, waiting for "Paylaş" (the audience can still be changed)
  const [shot, setShot] = useState<{ uri: string; base64: string } | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Start from the choice in Gizlilik ayarları
  useEffect(() => {
    socialApi.privacy(token).then((p) => p.moment_audience && setAudience(p.moment_audience)).catch(() => {});
  }, [token]);

  if (Platform.OS === 'web') return null;

  const take = async () => {
    setMessage(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setMessage('Fotoğraf için kamera izni gerekli.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (result.canceled || !result.assets[0]) return;
    try {
      // Re-encoding also drops the photo's hidden details (location, device)
      const small = await manipulateAsync(result.assets[0].uri, [{ resize: { width: WIDTH } }], {
        compress: 0.6,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!small.base64) throw new Error('Fotoğraf okunamadı.');
      setShot({ uri: small.uri, base64: small.base64 });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Fotoğraf okunamadı.');
    }
  };

  const share = async () => {
    if (!shot) return;
    setState('sending');
    setMessage(null);
    try {
      const saved = await momentsApi.add(token, checkinId, `data:image/jpeg;base64,${shot.base64}`, audience);
      setState('done');
      setMessage(`Paylaşıldı${audience === 'friends' ? ' (sadece arkadaşların)' : ''} · +${saved.points ?? 5} puan. Mekan kapandıktan 1 saat sonra silinir.`);
      notifyVenuesChanged();
    } catch (e) {
      setState('idle');
      setMessage(e instanceof Error ? e.message : 'Fotoğraf paylaşılamadı.');
    }
  };

  const audienceChips = (
    <View style={styles.audience}>
      {(
        [
          { id: 'everyone', label: 'Herkes' },
          { id: 'friends', label: 'Sadece arkadaşlarım' },
        ] as const
      ).map((o) => (
        <Pressable
          key={o.id}
          onPress={() => setAudience(o.id)}
          style={[styles.chip, audience === o.id && styles.chipOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: audience === o.id }}
        >
          <Text style={[styles.chipText, audience === o.id && styles.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (state === 'done' && shot) {
    return (
      <View style={[styles.box, styles.doneRow]}>
        <Image source={{ uri: shot.uri }} style={styles.thumb} />
        <Text style={[styles.note, styles.flex]}>{message}</Text>
      </View>
    );
  }

  if (shot) {
    // Taken: look at it, choose who sees it, then share (or take it again)
    return (
      <View style={styles.box}>
        <Image source={{ uri: shot.uri }} style={styles.preview} resizeMode="cover" />
        <Text style={styles.label}>Kimler görsün?</Text>
        {audienceChips}
        <View style={styles.buttons}>
          {/* Vazgeç: the photo is thrown away, nothing is shared */}
          <Pressable
            onPress={() => {
              setShot(null);
              setMessage(null);
            }}
            disabled={state === 'sending'}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityLabel="Fotoğrafı sil, paylaşma"
          >
            <Text style={styles.secondaryText}>Vazgeç</Text>
          </Pressable>
          <Pressable onPress={take} disabled={state === 'sending'} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>Yeniden çek</Text>
          </Pressable>
          <Pressable onPress={share} disabled={state === 'sending'} style={({ pressed }) => [styles.button, styles.flex, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>{state === 'sending' ? 'Gönderiliyor…' : 'Paylaş · +5 puan'}</Text>
          </Pressable>
        </View>
        {message && <Text style={styles.error}>{message}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}><InlineIcon name="camera" /> Şu anı paylaş</Text>
      <Text style={styles.note}>Ortamın fotoğrafı mekan kapanana kadar sayfasında “Şu an burada” olarak görünür. İnsanları yakından çekme.</Text>
      <Pressable onPress={take} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Fotoğraf çek · +5 puan</Text>
      </Pressable>
      {message && <Text style={styles.error}>{message}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.cream, alignSelf: 'stretch' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  note: { fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  audience: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.text },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextOn: { color: colors.background },
  button: { paddingVertical: 11, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  error: { fontSize: 13, color: colors.danger },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 54, height: 54, borderRadius: 10 },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  buttons: { flexDirection: 'row', gap: 8 },
  secondary: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  flex: { flex: 1 },
}));
