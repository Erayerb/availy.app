import type { IconName } from '../components/Icon';

/**
 * Badge icons in the app's own line icons (the server still sends an emoji, used nowhere now). Shown as a gold
 * medal: Profil / kullanıcı profili (BadgeGrid), "Yeni rozet!" (BadgeCelebration) and after a check-in.
 */
const BADGE_ICONS: Record<string, IconName> = {
  profile: 'user-check',
  first_step: 'shoe',
  explorer: 'sparkles',
  great_explorer: 'compass',
  traveller: 'map-2',
  regular: 'coffee',
  night_owl: 'moon-stars',
  helper: 'heart-handshake',
  weekly_winner: 'trophy',
  starter: 'rocket',
  // Levels ("Kâşif oldun!") and the check-in moments
  level_explorer: 'compass',
  level_local: 'home',
  level_ambassador: 'crown',
  streak: 'flame',
  first_ever: 'confetti',
};

export const badgeIcon = (id: string): IconName => BADGE_ICONS[id] ?? 'award';
