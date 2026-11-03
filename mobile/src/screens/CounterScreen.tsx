import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { CouponVerifier } from '../components/business/CouponVerifier';
import { panel } from '../components/business/panelStyles';
import { InlineIcon } from '../components/Icon';
import { Pressable } from '../components/Pressable';
import { QrScanner } from '../components/QrScanner';
import { Text, TextInput } from '../components/Text';
import { useLoyalty } from '../context/LoyaltyContext';
import { confirmAction } from '../lib/confirm';
import { parseCustomerQr } from '../lib/loyalty';
import { staffApi, type Workplace } from '../lib/staff';
import { colors, themed } from '../theme';

/** Daha fazla > Çalışan girişi: the code from the business, then that venue's counter (coupon and loyalty QR only). */
export function CounterScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [workplace, setWorkplace] = useState<Workplace | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    staffApi.workplace(token).then(setWorkplace).catch(() => setWorkplace(null));
  }, [token]);
  useEffect(load, [load]);

  const join = async () => {
    setError(null);
    try {
      setWorkplace(await staffApi.join(token, code));
      setCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Olmadı, tekrar dene.');
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>{workplace ? 'Kasa' : 'Çalışan girişi'}</Text>
      </View>

      {workplace === null && (
        <View style={panel.card}>
          <Text style={panel.sectionTitle}>İşletmeden aldığın kodu yaz</Text>
          <Text style={panel.muted}>Kendi hesabın aynen kalır; bu ekrandan çalıştığın mekanın kasasında kupon ve damga işlemi yaparsın.</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Örn. 7K3P9"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            style={panel.input}
            onSubmitEditing={join}
          />
          {error && <Text style={panel.error}>{error}</Text>}
          <Pressable style={panel.primary} onPress={join}>
            <Text style={panel.primaryText}>Kaydol</Text>
          </Pressable>
        </View>
      )}

      {workplace && (
        <>
          <Text style={styles.venue}>{workplace.venue_name}</Text>
          <CouponVerifier />
          {workplace.has_stamps && <StampCounter />}
          <Pressable
            hitSlop={8}
            style={styles.leave}
            onPress={() =>
              confirmAction('Bu mekandan ayrılınsın mı?', 'Kasaya erişimin biter. Yeniden eklenmek için işletmeden yeni kod gerekir.', 'Ayrıl', () =>
                staffApi.leave(token).then(load).catch((e) => setError(e instanceof Error ? e.message : 'Olmadı, tekrar dene.')),
              )
            }
          >
            <Text style={panel.error}>Bu mekandan ayrıl</Text>
          </Pressable>
          {error && <Text style={panel.error}>{error}</Text>}
        </>
      )}
    </ScrollView>
  );
}

/** Scan the customer's loyalty QR: a stamp, or use their reward. */
function StampCounter() {
  const { giveStamp, redeemReward } = useLoyalty();
  const [scan, setScan] = useState<'stamp' | 'reward' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const apply = async (action: 'stamp' | 'reward', raw: string) => {
    const code = parseCustomerQr(raw);
    if (!code) return setMessage('Bu bir availy müşteri kodu değil.');
    setMessage(action === 'stamp' ? await giveStamp(code) : await redeemReward(code));
  };

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Sadakat kartı</Text>
      <Text style={panel.muted}>Müşterinin Kampanyalar → Sadakat'taki QR'ını okut.</Text>
      <Pressable style={panel.primary} onPress={() => setScan('stamp')}>
        <Text style={panel.primaryText}>
          <InlineIcon name="camera" /> Damga ver
        </Text>
      </Pressable>
      <Pressable style={panel.secondary} onPress={() => setScan('reward')}>
        <Text style={panel.secondaryText}>
          <InlineIcon name="camera" /> Ödülü kullandır
        </Text>
      </Pressable>
      {message && <Text style={panel.text}>{message}</Text>}
      <QrScanner
        visible={scan !== null}
        title="Müşteri QR'ını okut"
        onClose={() => setScan(null)}
        onScanned={(data) => {
          const action = scan;
          setScan(null);
          if (action) apply(action, data);
        }}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  venue: { fontSize: 20, fontWeight: '700', color: colors.text },
  leave: { alignSelf: 'center', paddingVertical: 8 },
}));
