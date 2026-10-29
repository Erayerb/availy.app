import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '../Text';
import { Pressable } from '../Pressable';

import { codeMatches, verificationCode, VERIFICATION_METHODS, type VerificationMethod } from '../../lib/verification';
import { colors } from '../../theme';
import { Chip } from '../TagChips';
import { panel } from './panelStyles';

/**
 * Ownership check before campaigns and loyalty unlock. Prototype: the SMS
 * code is shown on screen and an uploaded document is accepted right away.
 */
export function VerificationSection({ onVerified }: { onVerified: () => void }) {
  const [method, setMethod] = useState<VerificationMethod>('sms');
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const uploadDocument = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.3 });
    if (!result.canceled) onVerified();
  };

  return (
    <View style={[panel.card, { borderColor: colors.primary, borderWidth: 1.5 }]}>
      <Text style={panel.sectionTitle}>Mekan sahipliğini doğrula</Text>
      <Text style={panel.muted}>Doğrulanan işletmeler ✓ rozeti alır; mekan bilgilerini yalnızca gerçek sahibi değiştirebilir.</Text>
      <View style={panel.wrap}>
        {VERIFICATION_METHODS.map((m) => (
          <Chip key={m.id} label={m.label} active={method === m.id} onPress={() => setMethod(m.id)} />
        ))}
      </View>
      {method === 'sms' ? (
        sentCode ? (
          <>
            <Text style={panel.muted}>Demo: gerçekte kod mekanın kayıtlı telefonuna SMS ile gelir. Kodun: {sentCode}</Text>
            <View style={panel.row}>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                placeholder="6 haneli kod"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                style={[panel.input, { flex: 1 }]}
              />
              <Pressable
                style={panel.primary}
                onPress={() => (codeMatches(sentCode, typed) ? onVerified() : setError('Kod hatalı.'))}
              >
                <Text style={panel.primaryText}>Doğrula</Text>
              </Pressable>
            </View>
            {error && <Text style={panel.error}>{error}</Text>}
          </>
        ) : (
          <Pressable style={panel.primary} onPress={() => setSentCode(verificationCode())}>
            <Text style={panel.primaryText}>Kod gönder</Text>
          </Pressable>
        )
      ) : (
        <>
          <Text style={panel.muted}>Demo: belge yüklenince hemen onaylanır; gerçekte ekibimiz inceler.</Text>
          <Pressable style={panel.primary} onPress={uploadDocument}>
            <Text style={panel.primaryText}>Belge yükle</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
