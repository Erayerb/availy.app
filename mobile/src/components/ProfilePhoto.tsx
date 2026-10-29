import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { userPhotoApi } from '../lib/userPhoto';
import { colors, themed } from '../theme';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

const PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.4,
  base64: true,
};

/** My profile photo with a ✎ badge: choose one, take one with the camera, or remove it. */
export function ProfilePhoto({ username, token, size = 72 }: { username: string; token: string; size?: number }) {
  const [version, setVersion] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // iOS cannot open the photo picker or the camera while our menu is still closing (it fails
  // silently), so the chosen action waits until the menu is gone
  const pending = useRef<(() => void) | null>(null);
  const after = (action: () => void) => {
    pending.current = action;
    setMenu(false);
    // onDismiss runs only on iOS; elsewhere the menu is gone after its fade
    if (Platform.OS !== 'ios') setTimeout(runPending, 250);
  };
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };

  const save = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) return setNote('Fotoğraf okunamadı.');
    setBusy(true);
    try {
      const saved = await userPhotoApi.save(token, `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
      setVersion(saved.photo_at);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Kaydedilemedi.');
    }
    setBusy(false);
  };

  const choose = async () => {
    setNote(null);
    try {
      await save(await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS));
    } catch {
      setNote('Fotoğraflar açılamadı. Telefonun Ayarlar > availy (Expo Go) > Fotoğraflar iznine bak.');
    }
  };

  const takePhoto = async () => {
    setNote(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setNote("Fotoğraf çekmek için kamera izni gerekli (Ayarlar'dan açabilirsin).");
    try {
      await save(await ImagePicker.launchCameraAsync(PICK_OPTIONS));
    } catch {
      setNote('Kamera açılamadı.');
    }
  };

  const remove = async () => {
    await userPhotoApi.remove(token).catch(() => {});
    setVersion(new Date().toISOString()); // shows the letter again
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setMenu(true)} disabled={busy} accessibilityLabel="Profil fotoğrafını düzenle">
        <Avatar key={version ?? 'start'} username={username} size={size} version={version} />
        <View style={styles.badge}>
          <Icon name={busy ? 'hourglass' : 'pencil'} size={14} color={colors.onPrimary} />
        </View>
      </Pressable>
      {note && <Text style={styles.error}>{note}</Text>}

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)} onDismiss={runPending}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Profil fotoğrafı</Text>
          <Option icon="photo" label="Fotoğraf seç" onPress={() => after(choose)} />
          {/* The web version has no camera here */}
          {Platform.OS !== 'web' && <Option icon="camera" label="Fotoğraf çek" onPress={() => after(takePhoto)} />}
          <Option icon="trash" label="Fotoğrafı sil" danger onPress={() => after(remove)} />
          <Pressable style={styles.cancel} onPress={() => setMenu(false)}>
            <Text style={styles.cancelText}>Vazgeç</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function Option({ icon, label, onPress, danger }: { icon: 'photo' | 'camera' | 'trash'; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.option} onPress={onPress}>
      <Icon name={icon} size={22} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.optionText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { alignSelf: 'flex-start', gap: 6 },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: colors.danger, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    paddingBottom: 36,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
    gap: 4,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  optionText: { fontSize: 16, fontWeight: '600', color: colors.text },
  danger: { color: colors.danger },
  cancel: { marginTop: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.text },
}));
