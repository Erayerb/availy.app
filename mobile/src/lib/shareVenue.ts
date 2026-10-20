import { Platform, Share } from 'react-native';

import type { Venue } from './api';
import { shareMessage } from './share';

/** System share sheet; on browsers without it, copy the text instead. Returns a note for the user. */
export const shareVenue = (venue: Venue) => shareText(shareMessage(venue));

export async function shareText(message: string): Promise<string | null> {
  try {
    const browser = typeof navigator !== 'undefined' ? (navigator as Navigator) : null;
    if (Platform.OS === 'web' && browser && typeof browser.share !== 'function') {
      await browser.clipboard.writeText(message);
      return 'Bağlantı kopyalandı.';
    }
    await Share.share({ message });
    return null;
  } catch {
    return 'Paylaşılamadı.';
  }
}
