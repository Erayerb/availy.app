import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { safetyApi } from '../lib/safety';
import { plusProfileApi, userCoverUrl } from '../lib/userPhoto';
import { colors, themed } from '../theme';
import { FRAME_COLORS } from './Avatar';
import { GradientFill } from './GradientFill';
import { Icon } from './Icon';
import { PlusBadge } from './PlusBadge';
import { ProfilePhoto } from './ProfilePhoto';
import { Pressable } from './Pressable';
import { Text } from './Text';

const FRAME_NAMES: Record<string, string> = {
  gold: 'Altın',
  red: 'Kırmızı',
  blue: 'Mavi',
  green: 'Yeşil',
  purple: 'Mor',
  pink: 'Pembe',
  orange: 'Turuncu',
  teal: 'Turkuaz',
  indigo: 'Lacivert',
  silver: 'Gümüş',
  brown: 'Kahve',
  black: 'Siyah',
};

/** Profil ayarları > "Profilini güzelleştir" (availo+): how others see my profile, live — a cover photo and
 * the frame round my photo. Without availo+ the same preview, locked, and the way to it. */
export function PlusProfile({
  token,
  username,
  plus,
  onUpgrade,
  framed = false,
  children,
}: {
  token: string;
  username: string;
  plus: boolean;
  onUpgrade: () => void;
  framed?: boolean; // Semt elçisi's gold frame when no colour is chosen
  children?: ReactNode; // under the name (e-mail, customer code...)
}) {
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
    if (!plus) return onUpgrade();
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
    if (!plus) return onUpgrade();
    setFrame(color);
    plusProfileApi.setFrame(token, color).catch((e) => {
      setNote(e instanceof Error ? e.message : 'Kaydedilemedi.');
      load();
    });
  };

  return (
    <View style={styles.wrap}>
      {/* The profile as others see it: cover (availo+), photo (tap to change) and frame */}
      <Pressable onPress={chooseCover} style={styles.preview} accessibilityLabel="Kapak fotoğrafını değiştir">
        {plus && cover ? (
          <Image source={{ uri: userCoverUrl(username, cover) }} style={styles.cover} />
        ) : (
          <View style={styles.cover}>
            <GradientFill colors={['#7A2E1F', '#C8102E']} />
            <View style={styles.coverEmpty}>
              <Icon name="photo" size={22} color="#fff" />
              <Text style={styles.coverEmptyText}>Kapak fotoğrafı ekle</Text>
            </View>
          </View>
        )}
        {plus && cover && (
          <Pressable
            style={styles.removeCover}
            hitSlop={8}
            onPress={() => plusProfileApi.removeCover(token).then(() => setCover(null)).catch(() => {})}
            accessibilityLabel="Kapağı kaldır"
          >
            <Icon name="trash" size={16} color="#fff" />
          </Pressable>
        )}
        <View style={styles.avatar}>
          <ProfilePhoto username={username} token={token} size={76} framed={framed && !frame} frameColor={plus ? frame : null} />
        </View>
      </Pressable>
      <Text style={styles.name}>
        @{username}
        {plus && <PlusBadge />}
      </Text>
      {children}

      <View style={styles.head}>
        <Text style={styles.label}>Profilini güzelleştir · çerçeve rengi</Text>
        {!plus && <Text style={styles.plus}>availo+</Text>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.frames}>
        <Pressable onPress={() => pickFrame(null)} style={styles.frameItem} accessibilityLabel="Çerçevesiz">
          <View style={[styles.swatch, styles.none, plus && frame === null && styles.selected]}>
            <Icon name="x" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.frameName}>Yok</Text>
        </Pressable>
        {Object.entries(FRAME_COLORS).map(([key, hex]) => (
          <Pressable key={key} onPress={() => pickFrame(key)} style={styles.frameItem} accessibilityLabel={`${FRAME_NAMES[key]} çerçeve`}>
            <View style={[styles.swatch, { borderColor: hex }, plus && frame === key && styles.selected]}>
              <View style={[styles.swatchInner, { backgroundColor: hex }]} />
              {plus && frame === key && (
                <View style={styles.check}>
                  <Icon name="check" size={12} color="#fff" />
                </View>
              )}
            </View>
            <Text style={[styles.frameName, plus && frame === key && styles.frameNameOn]}>{FRAME_NAMES[key]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {!plus && (
        <Pressable style={styles.primary} onPress={onUpgrade}>
          <Text style={styles.primaryText}>availo+ ile aç</Text>
        </Pressable>
      )}
      {note && <Text style={styles.error}>{note}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  plus: { fontSize: 13, fontWeight: '800', color: colors.gold },
  preview: { marginBottom: 32 },
  cover: { width: '100%', aspectRatio: 3, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.cream },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  coverEmptyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  removeCover: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  avatar: { position: 'absolute', left: 14, bottom: -34 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  label: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted },
  frames: { gap: 12, paddingVertical: 4, paddingRight: 8 },
  frameItem: { alignItems: 'center', gap: 4, width: 56 },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  swatchInner: { width: 18, height: 18, borderRadius: 9, opacity: 0.35 },
  none: { borderColor: colors.border, borderWidth: 2 },
  selected: { transform: [{ scale: 1.08 }] },
  check: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  frameName: { fontSize: 11.5, color: colors.textMuted },
  frameNameOn: { color: colors.text, fontWeight: '800' },
  primary: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { fontSize: 13, color: colors.danger },
}));
