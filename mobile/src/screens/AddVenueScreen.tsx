import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { NewVenueForm } from '../components/NewVenueForm';
import type { User } from '../lib/auth';
import { colors, themed } from '../theme';

type Props = {
  user: User | null;
  onBack: () => void;
  onRegister: () => void;
  onAdded: (venue: { id: number }) => void; // opens the new venue's page (to check in)
};

/** "Mekan ekle" (customers): a missing venue near the user; it waits for approval. */
export function AddVenueScreen({ user, onBack, onRegister, onAdded }: Props) {
  if (!user?.token || user.isGuest || user.role === 'business') {
    return (
      <View style={styles.page}>
        <View style={styles.topRow}>
          <BackButton onPress={onBack} />
          <Text style={styles.title}>Mekan ekle</Text>
        </View>
        <Text style={styles.muted}>
          {user?.role === 'business' ? 'İşletme hesapları buradan mekan ekleyemez.' : 'Mekan eklemek için kayıt ol.'}
        </Text>
        {user?.role !== 'business' && (
          <Pressable style={styles.primary} onPress={onRegister}>
            <Text style={styles.primaryText}>Kayıt ol</Text>
          </Pressable>
        )}
      </View>
    );
  }
  return (
    <NewVenueForm
      token={user.token}
      business={false}
      title="Mekan ekle"
      intro={
        'Listede olmayan bir mekanın yakınındaysan ekle. Önce "⏳ Onay bekliyor" görünür; farklı günlerde 3 farklı kişi ' +
        'orada check-in yapınca onaylanır ve sen 50 puan kazanırsın. 30 günde onaylanmazsa kaldırılır.'
      }
      onBack={onBack}
      onAdded={onAdded}
    />
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 60, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.textMuted },
  primary: { paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
}));
