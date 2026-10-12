import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useEngagement } from '../../context/EngagementContext';
import { colors } from '../../theme';
import { panel } from './panelStyles';

/** The cashier types the customer's coupon code to mark it used. */
export function CouponVerifier({ venueId }: { venueId: number }) {
  const { redeem } = useEngagement();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const check = () => {
    const error = redeem(code, venueId);
    setResult(error ? { ok: false, text: error } : { ok: true, text: 'Kupon geçerli, indirim uygulanabilir. ✓' });
    if (!error) setCode('');
  };

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Kupon doğrula</Text>
      <Text style={panel.muted}>Müşterinin gösterdiği kodu yaz (ör. AV-7K3P).</Text>
      <View style={panel.row}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="AV-…"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[panel.input, { flex: 1 }]}
          onSubmitEditing={check}
        />
        <Pressable style={panel.primary} onPress={check}>
          <Text style={panel.primaryText}>Doğrula</Text>
        </Pressable>
      </View>
      {result && <Text style={result.ok ? panel.success : panel.error}>{result.text}</Text>}
    </View>
  );
}
