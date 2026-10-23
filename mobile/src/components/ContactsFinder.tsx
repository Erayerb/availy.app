import * as Contacts from 'expo-contacts/legacy';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { friendsApi, smsInviteMessage, type Person, type Relation } from '../lib/friends';
import { colors, themed } from '../theme';

type Found = Person & { relation: Relation; phone: string };
// One row per contact: an availy user (Ekle) or someone to invite (Davet et)
type Row = { key: string; name: string; phone: string; user: Found | null };

// Long address books: the first ones, the rest by searching
const SHOWN = 60;

type Props = {
  token: string;
  me: string; // my user name, for the invite text
  onAdd: (username: string) => Promise<void>;
  onOpenUser: (username: string) => void;
};

/** Opens the SMS app with the invite text for one contact. */
function smsInvite(phone: string, text: string) {
  const body = encodeURIComponent(text);
  // iOS uses "&body=", Android "?body="
  Linking.openURL(`sms:${phone.replace(/[^\d+]/g, '')}${Platform.OS === 'ios' ? '&' : '?'}body=${body}`).catch(() => {});
}

/**
 * "Rehberden bul" (optional): the contacts permission, and the user's own number if they want to be
 * found too (phones do not tell apps their own number); the numbers are compared on the server and not stored.
 */
export function ContactsFinder({ token, me, onAdd, onOpenUser }: Props) {
  const [step, setStep] = useState<'closed' | 'phone' | 'done'>('closed');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');

  const search = async () => {
    setBusy(true);
    setNote(null);
    try {
      // Optional: without it the user still finds others, only others cannot find them
      if (phone.trim()) await friendsApi.setPhone(token, phone);
      const permission = await Contacts.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        setBusy(false);
        return setNote(
          permission.canAskAgain === false
            ? "Rehber izni kapalı. Telefonun Ayarlar'ından availy'ye kişiler izni verebilirsin."
            : 'Rehber izni verilmedi.',
        );
      }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers] });
      const contacts = data
        .map((c) => ({ name: c.name || 'İsimsiz', phones: (c.phoneNumbers ?? []).map((p) => p.number ?? '').filter(Boolean) }))
        .filter((c) => c.phones.length > 0);
      const people = await friendsApi.matchContacts(token, contacts.flatMap((c) => c.phones));
      const byPhone = new Map(people.map((p) => [p.phone, p]));
      const list: Row[] = contacts.map((c, i) => {
        const user = c.phones.map((p) => byPhone.get(p)).find(Boolean) ?? null;
        return { key: `${i}`, name: c.name, phone: user?.phone ?? c.phones[0], user };
      });
      // availy users first, then everyone else by name
      list.sort((a, b) => Number(!!b.user) - Number(!!a.user) || a.name.localeCompare(b.name, 'tr'));
      setRows(list);
      setStep('done');
      setNote(
        people.length === 0
          ? 'Rehberinde availy kullanan kimse bulunamadı; tanıdıklarını davet edebilirsin.'
          : `Rehberinde ${people.length} availy kullanıcısı var.`,
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Rehbere bakılamadı.');
    }
    setBusy(false);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>📱 Rehberden bul</Text>
        <Text style={styles.muted}>Rehberden bulma yalnızca telefon uygulamasında çalışır.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>📱 Rehberden bul</Text>
      {step === 'closed' && (
        <>
          <Text style={styles.muted}>Rehberindeki availy kullanıcılarını bul. İsteğe bağlı; rehberin saklanmaz.</Text>
          <Pressable style={styles.primary} onPress={() => setStep('phone')}>
            <Text style={styles.primaryText}>Rehberimden bul</Text>
          </Pressable>
        </>
      )}
      {step === 'phone' && (
        <>
          <Text style={styles.muted}>
            Rehberine izin verince availy kullanan tanıdıklarını buluruz. Numaralar yalnızca eşleşme için bir kez gönderilir,
            saklanmaz.
          </Text>
          <Text style={styles.muted}>
            İsteğe bağlı: kendi numaranı da yazarsan seni rehberinde kayıtlı olanlar da bulabilir. Numaran yalnızca şifreli bir
            özet olarak saklanır, kimseye gösterilmez.
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Numaram (isteğe bağlı)"
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            style={styles.input}
          />
          <Pressable style={[styles.primary, busy && styles.busy]} onPress={search} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Aranıyor…' : 'Rehbere izin ver ve bul'}</Text>
          </Pressable>
          <Pressable onPress={() => setStep('closed')} hitSlop={8}>
            <Text style={styles.muted}>Vazgeç</Text>
          </Pressable>
        </>
      )}
      {step === 'done' && (
        <>
          {rows.length > SHOWN / 2 && (
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="🔍 Rehberde ara"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />
          )}
          {rows
            .filter((r) => !filter.trim() || r.name.toLocaleLowerCase('tr-TR').includes(filter.trim().toLocaleLowerCase('tr-TR')))
            .slice(0, SHOWN)
            .map((r) => (
              <View key={r.key} style={styles.row}>
                <Pressable style={styles.flex} onPress={() => r.user && onOpenUser(r.user.username)} disabled={!r.user}>
                  <Text style={styles.bold} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.muted}>{r.user ? `@${r.user.username} · availy'de` : r.phone}</Text>
                </Pressable>
                {!r.user ? (
                  <Pressable style={styles.outline} onPress={() => smsInvite(r.phone, smsInviteMessage(me))}>
                    <Text style={styles.outlineText}>Davet et</Text>
                  </Pressable>
                ) : r.user.relation === 'none' || r.user.relation === 'incoming' ? (
                  <Pressable
                    style={styles.small}
                    onPress={async () => {
                      const user = r.user!;
                      await onAdd(user.username);
                      const relation: Relation = user.relation === 'incoming' ? 'friend' : 'outgoing';
                      setRows((list) => list.map((x) => (x.key === r.key ? { ...x, user: { ...user, relation } } : x)));
                    }}
                  >
                    <Text style={styles.primaryText}>{r.user.relation === 'incoming' ? 'Kabul et' : 'Ekle'}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.muted}>{r.user.relation === 'friend' ? 'Arkadaşın' : 'İstek gönderildi'}</Text>
                )}
              </View>
            ))}
        </>
      )}
      {note && <Text style={styles.muted}>{note}</Text>}
      {step === 'done' && (
        <Pressable
          onPress={async () => {
            await friendsApi.removePhone(token).catch(() => {});
            setRows([]);
            setStep('closed');
            setNote('Numaran silindi; artık rehberden bulunamazsın.');
          }}
          hitSlop={8}
        >
          <Text style={styles.muted}>Numaramı kaldır</Text>
        </Pressable>
      )}
      {note?.includes('Ayarlar') && (
        <Pressable onPress={() => Linking.openSettings()}>
          <Text style={styles.link}>Ayarları aç</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  bold: { fontWeight: '700', color: colors.text },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  primary: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
  small: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primary },
  outline: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary },
  outlineText: { color: colors.primary, fontWeight: '700' },
  busy: { opacity: 0.6 },
  link: { color: colors.primary, fontWeight: '700' },
}));
