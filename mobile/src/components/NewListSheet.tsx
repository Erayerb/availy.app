import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { useLocation } from '../context/LocationContext';
import { fetchVenuesByIds, searchVenues, type Venue } from '../lib/api';
import { toggleTag, type Tag } from '../lib/filters';
import { sortByDistance } from '../lib/geo';
import { listsApi, MAX_LIST_NAME, type VenueList, type Visibility } from '../lib/lists';
import { colors, themed } from '../theme';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { SettingsLink, SettingsSection, TINT } from './Settings';
import { TagChips } from './TagChips';
import { Text, TextInput } from './Text';
import { VenueRow } from './VenueRow';

const AUDIENCES: { id: Visibility; title: string; subtitle: string; icon: IconName; tint: string }[] = [
  { id: 'private', title: 'Gizli', subtitle: 'Yalnızca sen görürsün.', icon: 'lock', tint: TINT.dark },
  { id: 'friends', title: 'Arkadaşlarım', subtitle: 'Arkadaşların profilinde görür.', icon: 'users', tint: TINT.blue },
  { id: 'link', title: 'Herkes', subtitle: 'Arkadaşların görür; bağlantıyı paylaştığın herkes de açabilir.', icon: 'world', tint: TINT.green },
];

type Props = {
  visible: boolean;
  token: string;
  onClose: () => void;
  onCreated: (id: number) => void;
  // Düzenle: the same steps, filled in with this list; saving changes it instead of making a new one
  edit?: VenueList | null;
  onDelete?: () => void;
};

/** "＋ Yeni liste": 1) name and who sees it, 2) pick venues (suggestions and filters), then create. */
export function NewListSheet({ visible, token, onClose, onCreated, edit = null, onDelete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [picked, setPicked] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [found, setFound] = useState<Venue[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { point } = useLocation();

  // Start fresh each time it opens
  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setName(edit?.name ?? '');
    setVisibility(edit?.visibility ?? 'private');
    setPicked(edit?.venue_ids ?? []);
    setQuery('');
    setTags([]);
    setError(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: suggestions (nearest open places) or search results, narrowed by the filters
  useEffect(() => {
    if (!visible || step !== 2) return;
    const q = query.trim();
    if (q.length === 1) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchVenues(q, null, tags, controller.signal)
        .then((all) => {
          if (q) return setFound(all.slice(0, 12));
          // Editing: the list's own venues stay on top, so they can be taken out
          if (edit) {
            const rest = (point ? sortByDistance(all, point) : all).filter((v) => !edit.venue_ids.includes(v.id)).slice(0, 12);
            fetchVenuesByIds(edit.venue_ids, controller.signal)
              .then((mine) => setFound([...mine, ...rest]))
              .catch(() => setFound(rest));
            return;
          }
          const near = point ? sortByDistance(all, point) : all;
          setFound([...near].sort((a, b) => Number(b.open_now) - Number(a.open_now)).slice(0, 12));
        })
        .catch(() => {});
    }, q ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, step, query, tags, point?.lat, point?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setSaving(true);
    try {
      if (edit) {
        if (name.trim() !== edit.name || visibility !== edit.visibility) await listsApi.update(token, edit.id, { name, visibility });
        // Only the venues that changed
        const added = picked.filter((id) => !edit.venue_ids.includes(id));
        const removed = edit.venue_ids.filter((id) => !picked.includes(id));
        for (const id of added) await listsApi.setVenue(token, edit.id, id, true);
        for (const id of removed) await listsApi.setVenue(token, edit.id, id, false);
        onCreated(edit.id);
      } else {
        const list = await listsApi.create(token, name, visibility, picked);
        onCreated(list.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liste oluşturulamadı.');
    }
    setSaving(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.head}>
          <Pressable onPress={step === 1 ? onClose : () => setStep(1)} hitSlop={10}>
            <Text style={styles.link}>{step === 1 ? 'Vazgeç' : '‹ Geri'}</Text>
          </Pressable>
          <Text style={styles.headTitle}>{edit ? 'Listeyi düzenle' : 'Yeni liste'}</Text>
          <Text style={styles.step}>{step}/2</Text>
        </View>

        {step === 1 ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Listenin adı</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Kadıköy'de ders çalışılacak yerler"
              placeholderTextColor={colors.placeholder}
              maxLength={MAX_LIST_NAME}
              // A new list starts typing its name; editing opens without the keyboard
              autoFocus={!edit}
              style={styles.input}
            />
            <SettingsSection title="Kimler görsün?">
              {AUDIENCES.map((a) => (
                <SettingsLink
                  key={a.id}
                  icon={a.icon}
                  tint={a.tint}
                  title={a.title}
                  subtitle={a.subtitle}
                  selected={visibility === a.id}
                  onPress={() => setVisibility(a.id)}
                />
              ))}
            </SettingsSection>
            {visibility === 'link' && (
              <Text style={styles.muted}>
                <Icon name="link" size={13} color={colors.textMuted} /> Liste oluşunca paylaşma bağlantısı hazır olur.
              </Text>
            )}
            <Pressable
              onPress={() => setStep(2)}
              disabled={!name.trim()}
              style={({ pressed }) => [styles.primary, !name.trim() && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Devam · mekanları seç</Text>
            </Pressable>
            {edit && onDelete && (
              <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteButton}>
                <Text style={styles.delete}>Listeyi sil</Text>
              </Pressable>
            )}
          </ScrollView>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Mekan adı ya da semt"
                placeholderTextColor={colors.placeholder}
                style={styles.input}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
                <TagChips selected={tags} onToggle={(tag) => setTags((t) => toggleTag(t, tag))} />
              </ScrollView>
              <Text style={styles.label}>{query.trim() ? 'Arama sonuçları' : point ? 'Yakınındaki öneriler' : 'Öneriler'}</Text>
              {found.length === 0 && <Text style={styles.muted}>Bu filtrelerle mekan bulunamadı.</Text>}
              {found.map((v) => {
                const on = picked.includes(v.id);
                return (
                  <VenueRow
                    key={v.id}
                    venue={v}
                    onPress={() => setPicked((ids) => (on ? ids.filter((x) => x !== v.id) : [...ids, v.id]))}
                    action={
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on && <Icon name="check" size={14} color={colors.onPrimary} />}
                      </View>
                    }
                  />
                );
              })}
            </ScrollView>
            <View style={styles.footer}>
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable onPress={create} disabled={saving} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>
                  {saving
                  ? 'Kaydediliyor…'
                  : edit
                    ? `Kaydet · ${picked.length} mekan`
                    : picked.length
                      ? `Listeyi oluştur · ${picked.length} mekan`
                      : 'Boş liste oluştur'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10 },
  headTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  step: { fontSize: 13, color: colors.textMuted, minWidth: 40, textAlign: 'right' },
  link: { fontSize: 15, fontWeight: '600', color: colors.primary, minWidth: 40 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  label: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginTop: 4 },
  input: { padding: 14, borderRadius: 14, backgroundColor: colors.cream, fontSize: 16, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  tagRow: { gap: 8, paddingRight: 8 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: { padding: 16, paddingBottom: 30, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  primary: { paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', marginTop: 4 },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  error: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  deleteButton: { alignSelf: 'center', marginTop: 12 },
  delete: { fontSize: 14, fontWeight: '600', color: colors.danger },
}));
