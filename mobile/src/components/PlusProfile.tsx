import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { safetyApi } from '../lib/safety';
import { plusProfileApi, userCoverUrl } from '../lib/userPhoto';
import { colors, themed } from '../theme';
import { FRAME_COLORS } from './Avatar';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

/** Profil ayarları > "availo+ profilin": a cover photo and a coloured frame round the photo, seen by
 * everyone who opens the profile. Without availo+: what it would give, and the way to it. */
export function PlusProfile({ token, username, plus, onUpgrade }: { token: string; username: string; plus: boolean; onUpgrade: () => void }) {
  const [cover, setCover] = useState<string | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => {
    safetyApi
      .profile(token, username)
      .then((p) => {
        setCover(p.cover_at ?? null);
        setFrame(p.frame_color ?? null);
      })
      .catch(() => {});
  }, [token, username]);
  useEffect(load, [load, plus]);

  const chooseCover = async () => {
    setNote(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 1], quality: 0.4, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) return setNote('Fotoğraf okunamadı.');
      const saved = await plusProfileApi.saveCover(token, `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
      setCover(saved.cover_at);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Kaydedilemedi.');
    }
  };

  const pickFrame = (color: string | null) => {
    setFrame(color);
    plusProfileApi.setFrame(token, color).catch((e) => {
      setNote(e instanceof Error ? e.message : 'Kaydedilemedi.');
      load();
    });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        availo+ profilin
      </Text>
      {!plus ? (
        <>
          <Text style={styles.muted}>Kapak fotoğrafı ve fotoğrafının etrafında renkli bir çerçeve; profiline bakan herkes görür.</Text>
          <Pressable style={styles.primary} onPress={onUpgrade}>
            <Text style={styles.primaryText}>availo+'ya geç</Text>
          </Pressable>
        </>
      ) : (
        <>
          {cover && <Image source={{ uri: userCoverUrl(username, cover) }} style={styles.cover} />}
          <View style={styles.row}>
            <Pressable style={styles.secondary} onPress={chooseCover}>
              <Text style={styles.secondaryText}><Icon name="photo" size={15} color={colors.text} /> {cover ? 'Kapağı değiştir' : 'Kapak fotoğrafı seç'}</Text>
            </Pressable>
            {cover && (
              <Pressable
                style={styles.secondary}
                onPress={() => plusProfileApi.removeCover(token).then(() => setCover(null)).catch(() => {})}
              >
                <Text style={styles.secondaryText}>Kaldır</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.muted}>Çerçeve rengi</Text>
          <View style={styles.row}>
            <Pressable onPress={() => pickFrame(null)} style={[styles.swatch, styles.none, frame === null && styles.selected]} accessibilityLabel="Çerçeve yok">
              <Icon name="x" size={14} color={colors.textMuted} />
            </Pressable>
            {Object.entries(FRAME_COLORS).map(([name, hex]) => (
              <Pressable
                key={name}
                onPress={() => pickFrame(name)}
                style={[styles.swatch, { backgroundColor: hex }, frame === name && styles.selected]}
                accessibilityLabel={`${name} çerçeve`}
              />
            ))}
          </View>
        </>
      )}
      {note && <Text style={styles.error}>{note}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  title: { fontSize: 16, fontWeight: '800', color: colors.gold },
  muted: { fontSize: 13, color: colors.textMuted },
  cover: { width: '100%', aspectRatio: 3, borderRadius: 12, backgroundColor: colors.cream },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  secondary: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.cream },
  secondaryText: { fontSize: 14, fontWeight: '700', color: colors.text },
  primary: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  none: { borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  selected: { borderWidth: 3, borderColor: colors.text },
  error: { fontSize: 13, color: colors.danger },
}));
