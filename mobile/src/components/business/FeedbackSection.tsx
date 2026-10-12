import { Text, View } from 'react-native';

import { useEngagement } from '../../context/EngagementContext';
import { stars, venueRating } from '../../lib/feedback';
import { colors } from '../../theme';
import { panel } from './panelStyles';

export function FeedbackSection({ venueId }: { venueId: number }) {
  const { feedback } = useEngagement();
  const { average, count, items } = venueRating(feedback, venueId);

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Geri bildirimler</Text>
      {count === 0 ? (
        <Text style={panel.muted}>Henüz geri bildirim yok. Müşteriler mekan sayfasından puan ve yorum bırakabilir.</Text>
      ) : (
        <Text style={panel.text}>
          <Text style={{ color: colors.primary, fontWeight: '800' }}>{average}</Text> / 5 · {count} değerlendirme
        </Text>
      )}
      {items.slice(0, 5).map((f) => (
        <View key={f.id} style={{ gap: 2, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={panel.text}>
            {stars(f.rating)} · {f.userName}
          </Text>
          {f.comment ? <Text style={panel.muted}>{f.comment}</Text> : null}
        </View>
      ))}
    </View>
  );
}
