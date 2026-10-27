import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { venueApi, type BusinessRequest as Status } from '../lib/venueApi';
import { colors, themed } from '../theme';

type Props = { venueId: number; token: string | null; onLogin: () => void };

/** "İşletmeye haber ver": for a venue without a business account. Who asked is never told to the venue. */
export function BusinessRequest({ venueId, token, onLogin }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    venueApi.businessRequest(venueId, token ?? undefined).then(setStatus).catch(() => setStatus(null));
  }, [venueId, token]);

  if (!status || status.has_business) return null;

  const ask = async () => {
    if (!token) return onLogin();
    try {
      setStatus(await venueApi.askBusiness(token, venueId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gönderilemedi.');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🏪 İşletmesi henüz availy'ye katılmadı</Text>
      <Text style={styles.muted}>
        Doluluğunu yine görür, check-in yapabilirsin. İşletme katılınca kampanyalarını ve sadakat programını da burada
        görürsün. Yeterince kişi isteyince işletmeye haber veririz; kimin istediğini söylemeyiz.
      </Text>
      {status.mine ? (
        <Text style={styles.done}>✓ Haber verdin · {status.count} kişi istedi</Text>
      ) : (
        <Pressable style={styles.button} onPress={ask}>
          <Text style={styles.buttonText}>
            İşletmeye haber ver{status.count > 0 ? ` · ${status.count} kişi istedi` : ''}
          </Text>
        </Pressable>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  done: { fontSize: 14, color: colors.success, fontWeight: '700' },
  button: { paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  buttonText: { color: colors.primary, fontWeight: '700' },
  error: { fontSize: 13, color: colors.danger },
}));
