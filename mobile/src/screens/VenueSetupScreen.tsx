import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { NewVenueForm } from '../components/NewVenueForm';
import { useSearch } from '../hooks/useSearch';
import { accountApi, send } from '../lib/accountApi';
import { categoryLabel } from '../lib/filters';
import { shortLocation } from '../lib/location';
import { colors, themed } from '../theme';

type Props = {
  token: string | null;
  onDone: (venueId: number) => void;
  onLogout: () => void;
};

/** After business sign up: claim an existing venue (one business per venue) or add a new one on the server. */
export function VenueSetupScreen({ token, onDone, onLogout }: Props) {
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [query, setQuery] = useState('');
  const { venues, loading, error } = useSearch(query, null, []);
  // Venues that already have a business account
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    send<number[]>('GET', '/v1/venues/taken')
      .then((ids) => setTaken(new Set(ids)))
      .catch(() => {});
  }, []);

  const choose = async (venueId: number) => {
    if (!token) return;
    try {
      await accountApi.setVenue(token, venueId);
      onDone(venueId);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Seçilemedi.');
    }
  };

  if (mode === 'new' && token) {
    return (
      <NewVenueForm
        token={token}
        business
        title="Mekanını ekle"
        intro="Mekanın listede yoksa ekle; müşterilere hemen görünür. Konumu haritadan seç ya da mekandaysan kendi konumunu kullan."
        onBack={() => setMode('pick')}
        onAdded={(venue) => onDone(venue.id)}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <FlatList
        contentContainerStyle={styles.content}
        data={venues}
        keyExtractor={(v) => String(v.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Mekanını seç</Text>
            <Text style={styles.subtitle}>İşletmeni listeden bul ya da yeni ekle.</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Mekan ara"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              autoCorrect={false}
            />
            <Pressable style={styles.secondary} onPress={() => setMode('new')}>
              <Text style={styles.secondaryText}>+ Listede yok mu? Yeni mekan ekle</Text>
            </Pressable>
            {note && <Text style={styles.error}>{note}</Text>}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{error ?? (loading ? 'Yükleniyor…' : 'Sonuç yok')}</Text>}
        renderItem={({ item }) => {
          const owned = taken.has(item.id);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed, owned && styles.owned]}
              onPress={() => (owned ? setNote(`${item.name} başka bir işletme hesabına bağlı.`) : choose(item.id))}
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowSub}>
                {categoryLabel(item.category)} · {shortLocation(item.neighborhood, item.district)}
                {owned ? ' · başka bir işletmeye bağlı' : ''}
              </Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable onPress={onLogout} style={styles.logout} hitSlop={10}>
            <Text style={styles.logoutText}>Çıkış yap</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40, gap: 12 },
  header: { gap: 12, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.cream,
    fontSize: 16,
    color: colors.text,
  },
  row: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  pressed: { opacity: 0.7 },
  owned: { opacity: 0.45 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 16 },
  secondary: {
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14 },
  logout: { alignItems: 'center', paddingVertical: 16 },
  logoutText: { color: colors.textMuted, textDecorationLine: 'underline' },
}));
