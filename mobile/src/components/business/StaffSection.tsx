import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import type { Venue } from '../../lib/api';
import { confirmAction } from '../../lib/confirm';
import { shareText } from '../../lib/shareVenue';
import { staffApi, staffInviteMessage, type StaffMember } from '../../lib/staff';
import { Pressable } from '../Pressable';
import { Text } from '../Text';
import { panel } from './panelStyles';

/** İşletme profili > Çalışanlar: invite with a code, see who did what at the counter, remove. */
export function StaffSection({ venue, token }: { venue: Venue; token: string }) {
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    staffApi.list(token).then(setStaff).catch(() => {});
  }, [token]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const invite = async () => {
    setNote(null);
    try {
      const made = await staffApi.invite(token);
      setCode(made.code);
      const shared = await shareText(staffInviteMessage(venue.name, made.code));
      if (shared) setNote({ ok: shared !== 'Paylaşılamadı.', text: shared });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Kod oluşturulamadı.' });
    }
  };

  return (
    <View style={panel.card}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={panel.sectionTitle}>Çalışanlar{staff.length ? ` · ${staff.length}` : ''}</Text>
        <Text style={panel.muted}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={panel.muted}>
            Çalışanların kendi hesabıyla kasada yalnızca kupon ve sadakat QR'ı okutur; istatistikleri, kampanyaları ve ayarları göremez.
          </Text>
          <Pressable style={panel.primary} onPress={invite}>
            <Text style={panel.primaryText}>Çalışan davet et</Text>
          </Pressable>
          {code && (
            <Text style={panel.text}>
              Davet kodu: <Text selectable style={{ fontWeight: '800' }}>{code}</Text> · 7 gün geçerli, tek kullanımlık. Çalışanın Daha fazla {'>'} Çalışan girişi'ne yazar.
            </Text>
          )}
          {note && <Text style={note.ok ? panel.success : panel.error}>{note.text}</Text>}
          {staff.length === 0 && <Text style={panel.muted}>Henüz çalışan eklemedin.</Text>}
          {staff.map((s) => (
            <View key={s.id} style={[panel.row, { alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={panel.text}>@{s.username}</Text>
                <Text style={panel.muted}>
                  {s.coupons} kupon · {s.stamps} damga · {s.rewards} ödül
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  confirmAction(`@${s.username} çıkarılsın mı?`, 'Kasaya erişimi hemen biter; yaptığı işlemler kayıtta kalır.', 'Çıkar', () =>
                    staffApi.remove(token, s.id).then(load).catch((e) => setNote({ ok: false, text: e instanceof Error ? e.message : 'Çıkarılamadı.' })),
                  )
                }
              >
                <Text style={panel.error}>Çıkar</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
