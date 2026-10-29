import { useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '../Text';
import { Pressable } from '../Pressable';

import { useLoyalty } from '../../context/LoyaltyContext';
import {
  describeProgram,
  isProgramActive,
  parseCustomerQr,
  validateProgram,
  type LoyaltyProgram,
} from '../../lib/loyalty';
import { QrScanner } from '../QrScanner';
import { colors } from '../../theme';
import { Chip } from '../TagChips';
import { panel } from './panelStyles';
import { ThemedSwitch } from '../ThemedSwitch';
import { InlineIcon } from '../Icon';

/** Business side of loyalty (on the server): set up a stamp card or a paid membership, then stamp members. */
export function LoyaltySetup() {
  const { mine, saveProgram, removeProgram, giveStamp, redeemReward } = useLoyalty();
  const program = mine?.program ?? null;
  // The form opens only when the business asks for it, and can always be cancelled
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<LoyaltyProgram['kind']>(program?.kind ?? 'stamps');
  const [stamps, setStamps] = useState(String(program?.stampsRequired ?? 5));
  const [reward, setReward] = useState(program?.reward ?? '1 kahve bedava');
  const [price, setPrice] = useState(String(program?.price || 149));
  const [perk, setPerk] = useState(program?.perk ?? 'Her siparişte %15 indirim');
  const [formError, setFormError] = useState<string | null>(null);
  const [customer, setCustomer] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [scan, setScan] = useState<'stamp' | 'reward' | null>(null);
  const [manual, setManual] = useState(false);

  // Scanned QR or a typed code -> stamp or reward
  const apply = async (action: 'stamp' | 'reward', raw: string) => {
    const code = parseCustomerQr(raw);
    if (!code) return setMessage('Bu bir availy müşteri kodu değil.');
    setMessage(action === 'stamp' ? await giveStamp(code) : await redeemReward(code));
  };

  // Drop unsaved changes and go back to what is stored
  const cancel = () => {
    setKind(program?.kind ?? 'stamps');
    setStamps(String(program?.stampsRequired ?? 5));
    setReward(program?.reward ?? '1 kahve bedava');
    setPrice(String(program?.price || 149));
    setPerk(program?.perk ?? 'Her siparişte %15 indirim');
    setFormError(null);
    setEditing(false);
  };

  const save = async () => {
    const input = { kind, stampsRequired: Number(stamps), reward, price: Number(price), perk };
    const problem = validateProgram(input) ?? (await saveProgram({ ...input, active: program ? isProgramActive(program) : true }));
    setFormError(problem);
    if (!problem) setEditing(false);
  };

  const members = mine?.members ?? 0;

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Sadakat programı</Text>
      {program && !editing ? (
        <>
          <Text style={panel.text}><InlineIcon name="star" /> {describeProgram(program)}</Text>
          <View style={[panel.row, { alignItems: 'center' }]}>
            <Text style={[panel.text, { flex: 1 }]}>
              {isProgramActive(program) ? 'Aktif · müşteriler görüyor' : 'Pasif · müşterilere gizli'}
            </Text>
            <ThemedSwitch
              value={isProgramActive(program)}
              onValueChange={(active) => saveProgram({ ...program, active })}
            />
          </View>
          <Text style={panel.muted}>
            {members} müşteri katıldı{program.kind === 'stamps' ? ` · ${mine?.stampsGiven ?? 0} damga verildi` : ''}. Müşteriler
            programı Kampanyalar → Sadakat'ta görür ve "Katıl"a basar; burada check-in yapmış olanlara bildirim gider.
          </Text>
          {program.kind === 'stamps' ? (
            <>
              <Text style={panel.muted}>
                İki durumda da müşterinin Kampanyalar ve Sadakat → Sadakat sekmesindeki QR'ını okutursun.
              </Text>
              <Pressable style={panel.primary} onPress={() => setScan('stamp')}>
                <Text style={panel.primaryText}><InlineIcon name="camera" /> Damga ver</Text>
              </Pressable>
              <Text style={panel.muted}>
                Her alışverişte: müşterinin kartına 1 damga eklenir. {program.stampsRequired}. damgada kart
                dolar ve müşteri 1 ödül kazanır.
              </Text>
              <Pressable style={panel.secondary} onPress={() => setScan('reward')}>
                <Text style={panel.secondaryText}><InlineIcon name="camera" /> Ödülü kullandır</Text>
              </Pressable>
              <Text style={panel.muted}>
                Kartı dolmuş müşteri ödülünü ({program.reward}) aldığında: ödül kartından düşer, böylece
                aynı ödül iki kez kullanılamaz.
              </Text>
              <Pressable onPress={() => setManual((m) => !m)}>
                <Text style={panel.muted}>
                  {manual ? 'Elle girişi gizle' : 'Kamera yok mu? Kodu elle yaz'}
                </Text>
              </Pressable>
              {manual && (
                <>
                  <TextInput
                    value={customer}
                    onChangeText={setCustomer}
                    placeholder="M-…"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={panel.input}
                  />
                  <View style={panel.row}>
                    <Pressable
                      style={[panel.secondary, { flex: 1 }]}
                      onPress={() => apply('stamp', customer)}
                    >
                      <Text style={panel.secondaryText}>Damga ver</Text>
                    </Pressable>
                    <Pressable
                      style={[panel.secondary, { flex: 1 }]}
                      onPress={() => apply('reward', customer)}
                    >
                      <Text style={panel.secondaryText}>Ödülü kullandır</Text>
                    </Pressable>
                  </View>
                </>
              )}
              <QrScanner
                visible={scan !== null}
                title={scan === 'reward' ? 'Ödülü kullandırmak için QR okut' : 'Damga için QR okut'}
                onClose={() => setScan(null)}
                onScanned={(data) => {
                  const action = scan ?? 'stamp';
                  setScan(null);
                  apply(action, data);
                }}
              />
              {message && <Text style={panel.muted}>{message}</Text>}
            </>
          ) : (
            <Text style={panel.muted}>Ücretli üyelik şimdilik gösterim içindir; ödeme alınmaz.</Text>
          )}
          <View style={panel.row}>
            <Pressable onPress={() => setEditing(true)}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Düzenle</Text>
            </Pressable>
            <Text style={panel.muted}> · </Text>
            <Pressable onPress={removeProgram}>
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Programı kaldır</Text>
            </Pressable>
          </View>
        </>
      ) : !editing ? (
        <>
          <Text style={panel.muted}>
            Müdavimlerini ödüllendir: damga kartı ücretsizdir, üyelik ücretli olabilir.
          </Text>
          <Pressable style={panel.primary} onPress={() => setEditing(true)}>
            <Text style={panel.primaryText}>Sadakat programı oluştur</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={panel.muted}>
            Müdavimlerini ödüllendir: damga kartı ücretsizdir, üyelik ücretli olabilir.
          </Text>
          <View style={panel.wrap}>
            <Chip label="Damga kartı" active={kind === 'stamps'} onPress={() => setKind('stamps')} />
            <Chip
              label="Ücretli üyelik"
              active={kind === 'membership'}
              onPress={() => setKind('membership')}
            />
          </View>
          {kind === 'stamps' ? (
            <>
              <Text style={panel.label}>Kaç damgada ödül?</Text>
              <TextInput
                value={stamps}
                onChangeText={setStamps}
                keyboardType="number-pad"
                style={panel.input}
              />
              <Text style={panel.label}>Ödül</Text>
              <TextInput value={reward} onChangeText={setReward} style={panel.input} />
            </>
          ) : (
            <>
              <Text style={panel.label}>Aylık ücret (₺)</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="number-pad"
                style={panel.input}
              />
              <Text style={panel.label}>Üyelere sunduğun</Text>
              <TextInput value={perk} onChangeText={setPerk} style={panel.input} />
            </>
          )}
          {formError && <Text style={panel.error}>{formError}</Text>}
          <View style={panel.row}>
            <Pressable style={[panel.secondary, { flex: 1 }]} onPress={cancel}>
              <Text style={panel.secondaryText}>İptal</Text>
            </Pressable>
            <Pressable style={[panel.primary, { flex: 1 }]} onPress={save}>
              <Text style={panel.primaryText}>Kaydet</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
