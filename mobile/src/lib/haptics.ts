/** Short vibrations on the actions that matter (phones only; quietly nothing on the web or without support). */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const run = (feedback: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  feedback().catch(() => {});
};

export const haptics = {
  /** A choice: a chip, ♡, the bell, a like */
  tap: () => run(() => Haptics.selectionAsync()),
  /** Done: a check-in, a coupon */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Did not work */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
