import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { BackButton } from '../components/BackButton';
import { QrScanner } from '../components/QrScanner';
import type { User } from '../lib/auth';
import { friendQrPayload, friendsApi, inviteMessage, parseFriendCode, type FriendLists, type Person, type Relation } from '../lib/friends';
import { shareText } from '../lib/shareVenue';
import { colors } from '../theme';

type Props = { user: User | null; onBack: () => void; onRegister: () => void };

const EMPTY: FriendLists = { friends: [], incoming: [], outgoing: [] };

/** v2: find friends by user name, my QR code and invite link, requests and friends. */
export function FriendsScreen({ user, onBack, onRegister }: Props) {
  const token = user?.token;
  const [lists, setLists] = useState<FriendLists>(EMPTY);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Person & { relation: Relation })[]>([]);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = useCallback(() => {
    if (token) friendsApi.list(token).then(setLists).catch(() => {});
  }, [token]);
  useEffect(reload, [reload]);

  // Search as the user types (user names start with the text)
  useEffect(() => {
    if (!token || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      friendsApi.search(token, query).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [token, query]);

  if (!user || user.isGuest || !user.username || !token) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <BackButton onPress={onBack} />
          <Text style={styles.title}>Arkadaşlar</Text>
        </View>
        <Text style={styles.muted}>Arkadaş eklemek ve seni bulmalarını sağlamak için kayıt ol (kullanıcı adı seçersin).</Text>
        <Pressable style={styles.primary} onPress={onRegister}>
          <Text style={styles.primaryText}>Kayıt ol</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const add = async (username: string) => {
    try {
      const result = await friendsApi.add(token, username);
      setNote({
        ok: true,
        text: result.relation === 'friend' ? `@${result.username} artık arkadaşın.` : `@${result.username} kişisine istek gönderildi.`,
      });
      reload();
      setResults((list) => list.map((p) => (p.id === result.id ? { ...p, relation: result.relation } : p)));
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Eklenemedi.' });
    }
  };

  const remove = async (person: Person) => {
    await friendsApi.remove(token, person.id).catch(() => {});
    reload();
    setResults((list) => list.map((p) => (p.id === person.id ? { ...p, relation: 'none' } : p)));
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Arkadaşlar</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Beni ekle</Text>
        <View style={styles.qr}>
          <QRCode value={friendQrPayload(user.username)} size={160} backgroundColor={colors.surface} color={colors.text} />
        </View>
        <Text style={[styles.username, styles.centered]}>@{user.username}</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.secondary, styles.flex]}
            onPress={async () => {
              const result = await shareText(inviteMessage(user.username!));
              if (result) setNote({ ok: true, text: result });
            }}
          >
            <Text style={styles.secondaryText}>Davet bağlantısını paylaş</Text>
          </Pressable>
          <Pressable style={[styles.primary, styles.flex]} onPress={() => setScanning(true)}>
            <Text style={styles.primaryText}>📷 QR okut</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>Bağlantıyı WhatsApp'tan ya da Instagram hikayesinden paylaşabilirsin.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Kullanıcı adıyla bul</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="@kullaniciadi"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {results.map((p) => (
          <PersonRow key={p.id} person={p}>
            {p.relation === 'none' && <Action label="Ekle" onPress={() => add(p.username)} />}
            {p.relation === 'incoming' && <Action label="Kabul et" onPress={() => add(p.username)} />}
            {p.relation === 'outgoing' && <Text style={styles.muted}>İstek gönderildi</Text>}
            {p.relation === 'friend' && <Text style={styles.muted}>Arkadaşın</Text>}
          </PersonRow>
        ))}
        {query.trim().length >= 2 && results.length === 0 && <Text style={styles.muted}>Bu adla kimse bulunamadı.</Text>}
      </View>

      {note && <Text style={note.ok ? styles.success : styles.error}>{note.text}</Text>}

      {lists.incoming.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gelen istekler</Text>
          {lists.incoming.map((p) => (
            <PersonRow key={p.id} person={p}>
              <Action label="Kabul et" onPress={() => add(p.username)} />
              <Action label="Reddet" quiet onPress={() => remove(p)} />
            </PersonRow>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Arkadaşların · {lists.friends.length}</Text>
        {lists.friends.length === 0 && <Text style={styles.muted}>Henüz arkadaşın yok. QR'ını göster ya da kullanıcı adıyla ara.</Text>}
        {lists.friends.map((p) => (
          <PersonRow key={p.id} person={p}>
            <Action label="Çıkar" quiet onPress={() => remove(p)} />
          </PersonRow>
        ))}
        {lists.outgoing.length > 0 && <Text style={styles.label}>Gönderdiğin istekler</Text>}
        {lists.outgoing.map((p) => (
          <PersonRow key={p.id} person={p}>
            <Action label="İptal" quiet onPress={() => remove(p)} />
          </PersonRow>
        ))}
        <Text style={styles.muted}>Yakında: arkadaşlarının (gizli olmayan) check-in'leri ana sayfada görünecek.</Text>
      </View>

      <QrScanner
        visible={scanning}
        title="Arkadaşının QR'ını okut"
        onClose={() => setScanning(false)}
        onScanned={(data) => {
          setScanning(false);
          const username = parseFriendCode(data);
          if (username) add(username);
          else setNote({ ok: false, text: 'Bu bir availy arkadaş QR kodu değil.' });
        }}
      />
    </ScrollView>
  );
}

function PersonRow({ person, children }: { person: Person; children: React.ReactNode }) {
  return (
    <View style={styles.person}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{person.name.slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.text}>{person.name}</Text>
        <Text style={styles.muted}>@{person.username}</Text>
      </View>
      {children}
    </View>
  );
}

function Action({ label, onPress, quiet = false }: { label: string; onPress: () => void; quiet?: boolean }) {
  return (
    <Pressable onPress={onPress} style={quiet ? styles.actionQuiet : styles.action} hitSlop={6}>
      <Text style={quiet ? styles.actionQuietText : styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 4 },
  text: { fontSize: 15, color: colors.text, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.textMuted },
  username: { fontSize: 18, fontWeight: '800', color: colors.text },
  centered: { textAlign: 'center' },
  qr: { alignItems: 'center', paddingVertical: 6 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  action: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.primary },
  actionText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  actionQuiet: { paddingVertical: 7, paddingHorizontal: 10 },
  actionQuietText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  primary: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700', textAlign: 'center' },
  secondary: { paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  success: { color: colors.success, fontWeight: '600' },
  error: { color: colors.danger },
});
