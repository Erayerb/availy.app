import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { businessApi, type StandingReward } from '../../lib/business';
import { DISCOUNT_STEP, MAX_POINTS, POINT_STEPS, POINTS_STEP } from '../../lib/campaigns';
import { colors } from '../../theme';
import { Pressable } from '../Pressable';
import { Stepper } from '../Stepper';
import { ThemedSwitch } from '../ThemedSwitch';
import { Text } from '../Text';
import { panel } from './panelStyles';

/** Kampanyalar: "Kalıcı ödül" — e.g. 200 puan = %10 indirim, always on the venue page, once a week per person.
 * A cheap way to win customers: the business gives the discount, availo's points bring the people. */
export function RewardSetup({ token }: { token: string }) {
  const [saved, setSaved] = useState<StandingReward | null>(null);
  const [points, setPoints] = useState(200);
  const [discount, setDiscount] = useState(10);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => {
    businessApi
      .reward(token)
      .then((r) => {
        setSaved(r);
        if (r) {
          setPoints(r.points);
          setDiscount(r.discount);
        }
      })
      .catch(() => {});
  }, [token]);
  useEffect(load, [load]);

  const save = async (active: boolean) => {
    try {
      setSaved(await businessApi.saveReward(token, points, discount, active));
      setNote({ ok: true, text: active ? '✓ Ödül mekan sayfanda görünüyor.' : 'Ödül kapatıldı; kullanılmamış kuponların puanı iade edildi.' });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    }
  };

  const changed = !saved || saved.points !== points || saved.discount !== discount;
  return (
    <View style={panel.card}>
      <View style={panel.row}>
        <Text style={[panel.sectionTitle, { flex: 1 }]}>Kalıcı ödül</Text>
        {saved && <ThemedSwitch value={saved.active} onValueChange={save} />}
      </View>
      <Text style={panel.muted}>
        Mekan sayfanda hep durur: müşteri availo puanıyla alır, kasada gösterir. Kişi başı haftada bir. Ücretsiz, aylık kampanya
        hakkından düşmez.
      </Text>
      <Text style={panel.label}>Kaç puan?</Text>
      <Stepper value={points} onChange={setPoints} min={POINTS_STEP} max={MAX_POINTS} step={POINTS_STEP} steps={POINT_STEPS} format={(p) => `${p} puan`} label="Puan" />
      <Text style={panel.label}>Ne kadar indirim?</Text>
      <Stepper value={discount} onChange={setDiscount} min={DISCOUNT_STEP} max={90} step={DISCOUNT_STEP} format={(d) => `%${d}`} label="İndirim" />
      <Text style={panel.muted}>Düzenli bir müşteri haftada ~50-70 puan kazanır: {points} puan yaklaşık {Math.max(1, Math.round(points / 60))} haftalık kullanım.</Text>
      {(changed || !saved?.active) && (
        <Pressable style={panel.primary} onPress={() => save(true)}>
          <Text style={panel.primaryText}>{saved ? 'Kaydet ve yayınla' : 'Ödülü yayınla'}</Text>
        </Pressable>
      )}
      {note && <Text style={note.ok ? panel.success : panel.error}>{note.text}</Text>}
    </View>
  );
}
