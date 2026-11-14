import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';

import { venueApi, type BusinessRequest as Status } from '../lib/venueApi';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';

type Props = { venueId: number; token: string | null; onLogin: () => void };

/** "İşletmeye haber ver": for a venue without a business account. Who asked is never told to the venue. */
export function BusinessRequest({ venueId, token, onLogin }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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

  // A small line under the venue's name; a tap opens the explanation and the button
  if (status.mine) {
    return <Text style={styles.done}>✓ İşletmeye haber verdin · {status.count} kişi istedi</Text>;
  }
  return (
    <View style={styles.box}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.line}>
          <InlineIcon name="building-store" /> İşletme availo'ya katılmadı · <Text style={styles.link}>Haber ver {open ? '▴' : '›'}</Text>
        </Text>
      </Pressable>
      {open && (
        <View style={styles.card}>
          <Text style={styles.muted}>
            İşletme katılınca kampanyalarını ve sadakat programını burada görürsün. Yeterince kişi isteyince işletmeye haber
            veririz; kimin istediğini söylemeyiz.
          </Text>
          <Pressable style={styles.button} onPress={ask}>
            <Text style={styles.buttonText}>
              Haber ver{status.count > 0 ? ` · ${status.count} kişi istedi` : ''}
            </Text>
          </Pressable>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { gap: 8, marginTop: 4 },
  line: { fontSize: 13, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '700' },
  card: { padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  done: { fontSize: 13, color: colors.success, fontWeight: '700', marginTop: 4 },
  button: { paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  buttonText: { color: colors.primary, fontWeight: '700' },
  error: { fontSize: 13, color: colors.danger },
}));
