import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useCampaigns } from '../../context/CampaignsContext';
import { parseCouponQr } from '../../lib/coupons';
import { colors } from '../../theme';
import { QrScanner } from '../QrScanner';
import { panel } from './panelStyles';

/** The cashier scans the customer's coupon QR (or types the code) to mark it used. */
export function CouponVerifier() {
  const { redeem } = useCampaigns();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const check = async (raw: string) => {
    const parsed = parseCouponQr(raw);
    if (!parsed) return setResult({ ok: false, text: 'Bu bir availy kupon kodu değil.' });
    const error = await redeem(parsed);
    setResult(error ? { ok: false, text: error } : { ok: true, text: `${parsed} geçerli, indirim uygulanabilir. ✓` });
    if (!error) setCode('');
  };

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Kupon doğrula</Text>
      <Text style={panel.muted}>Müşterinin telefonundaki kupon QR'ını okut.</Text>
      <Pressable style={panel.primary} onPress={() => setScanning(true)}>
        <Text style={panel.primaryText}>📷 Kupon QR'ı okut</Text>
      </Pressable>
      <Pressable onPress={() => setManual((m) => !m)}>
        <Text style={panel.muted}>{manual ? 'Elle girişi gizle' : 'Kamera yok mu? Kodu elle yaz'}</Text>
      </Pressable>
      {manual && (
        <View style={panel.row}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="AV-…"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[panel.input, { flex: 1 }]}
            onSubmitEditing={() => check(code)}
          />
          <Pressable style={panel.secondary} onPress={() => check(code)}>
            <Text style={panel.secondaryText}>Doğrula</Text>
          </Pressable>
        </View>
      )}
      {result && <Text style={result.ok ? panel.success : panel.error}>{result.text}</Text>}
      <QrScanner
        visible={scanning}
        title="Kupon QR'ını okut"
        onClose={() => setScanning(false)}
        onScanned={(data) => {
          setScanning(false);
          check(data);
        }}
      />
    </View>
  );
}
