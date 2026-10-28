import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { Pressable } from '../components/Pressable';
import { send } from '../lib/accountApi';
import { confirmAction } from '../lib/confirm';
import { stars } from '../lib/feedback';
import { REPORT_REASONS } from '../lib/safety';
import { issueLabel, venueIssuesApi, type Resolution, type VenueIssue } from '../lib/venueIssues';
import { colors, themed } from '../theme';

type Reported = {
  kind: 'review' | 'reply';
  id: number;
  body: string;
  rating: number | null;
  author: string | null;
  venue_name: string;
  venue_id: number;
  reports: number;
  reasons: string[];
  last_at: string;
  from_business: boolean;
};

const adminApi = {
  reports: (token: string) => send<Reported[]>('GET', '/v1/admin/reports', undefined, token),
  remove: (token: string, kind: Reported['kind'], id: number) => send<void>('POST', `/v1/admin/${kind}/${id}/remove`, undefined, token),
  dismiss: (token: string, kind: Reported['kind'], id: number) => send<void>('POST', `/v1/admin/${kind}/${id}/dismiss`, undefined, token),
};

const reasonLabel = (reason: string) => REPORT_REASONS.find((r) => r.reason === reason)?.label ?? reason;

/** Daha fazla > Yönetici: venues to check ("Bilgi yanlış mı?" from 3 people) and reported reviews and replies
 * (the venue's own business first): remove, or keep. */
export function AdminScreen({ token, onBack, onOpenVenue }: { token: string; onBack: () => void; onOpenVenue: (venue: { id: number }) => void }) {
  const [items, setItems] = useState<Reported[] | null>(null);
  const [issues, setIssues] = useState<VenueIssue[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    venueIssuesApi.open(token).then(setIssues).catch(() => {});
    adminApi
      .reports(token)
      .then((list) => {
        setItems(list);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Yüklenemedi.'));
  }, [token]);
  useEffect(load, [load]);

  const act = (action: () => Promise<void>, item: Reported) => {
    setItems((list) => (list ?? []).filter((i) => !(i.kind === item.kind && i.id === item.id)));
    action().catch(load);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Yönetici</Text>
      </View>
      <Text style={styles.heading}>Kontrol edilecek mekanlar</Text>
      <Text style={styles.muted}>"Bilgi yanlış mı?" ile aynı şeyi en az 3 kişi bildirdi.</Text>
      {issues.length === 0 && <Text style={styles.muted}>Kontrol edilecek mekan yok.</Text>}
      {issues.map((issue) => (
        <IssueCard
          key={`${issue.venue_id}-${issue.kind}`}
          issue={issue}
          onOpenVenue={() => onOpenVenue({ id: issue.venue_id })}
          onResolve={(resolution) => {
            setIssues((list) => list.filter((i) => !(i.venue_id === issue.venue_id && (i.kind === issue.kind || resolution.action === 'close'))));
            venueIssuesApi.resolve(token, issue.venue_id, issue.kind, resolution).catch(load);
          }}
        />
      ))}

      <Text style={styles.heading}>Şikâyet edilen yorumlar</Text>
      <Text style={styles.muted}>
        Şikâyet edilen yorum ve yanıtlar; mekanın kendi işletmesinin şikâyetleri önce gelir. "Kaldır" herkesten gizler,
        "Şikâyeti reddet" içeriği bırakır.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {items === null && !error && <Text style={styles.muted}>Yükleniyor…</Text>}
      {items?.length === 0 && <Text style={styles.muted}>İncelenecek şikâyet yok.</Text>}
      {items?.map((item) => (
        <View key={`${item.kind}-${item.id}`} style={styles.card}>
          <Pressable onPress={() => onOpenVenue({ id: item.venue_id })}>
            <Text style={styles.venue}>
              {item.venue_name} · {item.kind === 'review' ? 'yorum' : 'yanıt'}
              {item.author ? ` · @${item.author}` : ''}
            </Text>
          </Pressable>
          <Text style={styles.body}>
            {item.rating ? `${stars(item.rating)} ` : ''}
            {item.body || '(yazı yok)'}
          </Text>
          <Text style={styles.muted}>
            {item.reports} şikâyet: {item.reasons.map(reasonLabel).join(', ')}
            {item.from_business ? ' · işletme şikâyet etti' : ''}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={styles.remove}
              onPress={() =>
                confirmAction('Kaldırılsın mı?', 'Bu içerik herkesten gizlenir.', 'Kaldır', () =>
                  act(() => adminApi.remove(token, item.kind, item.id), item),
                )
              }
            >
              <Text style={styles.removeText}>Kaldır</Text>
            </Pressable>
            <Pressable style={styles.keep} onPress={() => act(() => adminApi.dismiss(token, item.kind, item.id), item)}>
              <Text style={styles.keepText}>Şikâyeti reddet</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/** One venue to check: close it (off the map), save the right name / hours, or dismiss the reports. */
function IssueCard({ issue, onOpenVenue, onResolve }: { issue: VenueIssue; onOpenVenue: () => void; onResolve: (r: Resolution) => void }) {
  const [name, setName] = useState(issue.kind === 'name' ? (issue.notes[0] ?? issue.venue_name) : '');
  const [hours, setHours] = useState({ open: String(issue.open_hour ?? ''), close: String(issue.close_hour ?? '') });
  const hour = (text: string) => (/^\d{1,2}$/.test(text) && Number(text) <= 24 ? Number(text) : null);
  const open = hour(hours.open);
  const close = hour(hours.close);
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpenVenue}>
        <Text style={styles.venue}>
          {issue.venue_name}
          {issue.district ? ` · ${issue.district}` : ''}
        </Text>
      </Pressable>
      <Text style={styles.body}>
        {issueLabel(issue.kind)} · {issue.reports} kişi
      </Text>
      {issue.notes.slice(0, 3).map((n, i) => (
        <Text key={i} style={styles.muted}>
          “{n}”
        </Text>
      ))}
      {issue.kind === 'name' && (
        <TextInput value={name} onChangeText={setName} maxLength={80} placeholder="Doğru adı" placeholderTextColor={colors.placeholder} style={styles.input} />
      )}
      {issue.kind === 'hours' && (
        <View style={styles.row}>
          <TextInput value={hours.open} onChangeText={(t) => setHours((h) => ({ ...h, open: t }))} keyboardType="number-pad" maxLength={2} placeholder="Açılış" placeholderTextColor={colors.placeholder} style={[styles.input, styles.flex]} />
          <TextInput value={hours.close} onChangeText={(t) => setHours((h) => ({ ...h, close: t }))} keyboardType="number-pad" maxLength={2} placeholder="Kapanış" placeholderTextColor={colors.placeholder} style={[styles.input, styles.flex]} />
        </View>
      )}
      <View style={styles.row}>
        {issue.kind === 'closed' ? (
          <Pressable
            style={styles.remove}
            onPress={() =>
              confirmAction(`${issue.venue_name} haritadan kaldırılsın mı?`, 'Mekan kapanmış olarak işaretlenir; haritada ve aramada görünmez.', 'Kaldır', () =>
                onResolve({ action: 'close' }),
              )
            }
          >
            <Text style={styles.removeText}>Kapandı, kaldır</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.remove, issue.kind === 'hours' && (open === null || close === null) && styles.disabled]}
            disabled={issue.kind === 'hours' && (open === null || close === null)}
            onPress={() =>
              onResolve(
                issue.kind === 'name'
                  ? { action: 'fixed', name }
                  : issue.kind === 'hours'
                    ? { action: 'fixed', open_hour: open!, close_hour: close! }
                    : { action: 'fixed' },
              )
            }
          >
            <Text style={styles.removeText}>{issue.kind === 'location' ? 'Düzelttim' : 'Kaydet'}</Text>
          </Pressable>
        )}
        <Pressable style={styles.keep} onPress={() => onResolve({ action: 'dismiss' })}>
          <Text style={styles.keepText}>Bildirim yanlış</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8 },
  input: { padding: 10, borderRadius: 10, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  flex: { flex: 1 },
  disabled: { opacity: 0.4 },
  muted: { fontSize: 13, color: colors.textMuted },
  error: { color: colors.danger },
  card: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  venue: { fontSize: 14, fontWeight: '700', color: colors.primary },
  body: { fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  remove: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center' },
  removeText: { color: colors.white, fontWeight: '700' },
  keep: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  keepText: { color: colors.text, fontWeight: '700' },
}));
