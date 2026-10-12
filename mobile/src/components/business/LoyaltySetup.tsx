import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useEngagement } from '../../context/EngagementContext';
import type { Venue } from '../../lib/api';
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

/** Business side of loyalty: set up a stamp card or a paid membership, then stamp customers. */
export function LoyaltySetup({ venue }: { venue: Venue }) {
  const { programs, memberships, saveProgram, removeProgram, giveStamp, redeemReward } = useEngagement();
  const program = programs.find((p) => p.venueId === venue.id);
  const [editing, setEditing] = useState(!program);
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
    setMessage(action === 'stamp' ? await giveStamp(code, venue.id) : await redeemReward(code, venue.id));
  };

  const save = () => {
    const input = { kind, stampsRequired: Number(stamps), reward, price: Number(price), perk };
    const problem = validateProgram(input);
    setFormError(problem);
    if (problem) return;
    saveProgram({
      venueId: venue.id,
      venueName: venue.name,
      ...input,
      active: program ? isProgramActive(program) : true,
    });
    setEditing(false);
  };

  const members = memberships.filter((m) => m.venueId === venue.id).length;

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Sadakat programı</Text>
      {program && !editing ? (
        <>
          <Text style={panel.text}>⭐ {describeProgram(program)}</Text>
          <View style={[panel.row, { alignItems: 'center' }]}>
            <Text style={[panel.text, { flex: 1 }]}>
              {isProgramActive(program) ? 'Aktif · müşteriler görüyor' : 'Pasif · müşterilere gizli'}
            </Text>
            <ThemedSwitch
              value={isProgramActive(program)}
              onValueChange={(active) => saveProgram({ ...program, active })}
            />
          </View>
          {program.kind === 'stamps' ? (
            <>
              <Text style={panel.muted}>Müşterinin telefonundaki QR kodu okut.</Text>
              <View style={panel.row}>
                <Pressable style={[panel.primary, { flex: 1 }]} onPress={() => setScan('stamp')}>
                  <Text style={panel.primaryText}>📷 Damga ver</Text>
                </Pressable>
                <Pressable style={[panel.secondary, { flex: 1 }]} onPress={() => setScan('reward')}>
                  <Text style={panel.secondaryText}>📷 Ödülü kullan</Text>
                </Pressable>
              </View>
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
                      <Text style={panel.secondaryText}>Ödülü kullan</Text>
                    </Pressable>
                  </View>
                </>
              )}
              <QrScanner
                visible={scan !== null}
                title={scan === 'reward' ? 'Ödül için QR okut' : 'Damga için QR okut'}
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
            <Text style={panel.muted}>Üye sayısı: {members} (demo, ödeme alınmaz)</Text>
          )}
          <View style={panel.row}>
            <Pressable onPress={() => setEditing(true)}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Düzenle</Text>
            </Pressable>
            <Text style={panel.muted}> · </Text>
            <Pressable onPress={() => removeProgram(venue.id)}>
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Programı kaldır</Text>
            </Pressable>
          </View>
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
          <Pressable style={panel.primary} onPress={save}>
            <Text style={panel.primaryText}>Programı kaydet</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
