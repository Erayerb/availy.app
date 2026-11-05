import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';

// The same shape as the app icon (scripts/build-logo.py): an arch with a dot under it
export const LOGO_PATH = 'M18 78 L35.19 35.95 A16 16 0 0 1 64.81 35.95 L82 78';

/** The Availo mark: the arch in the text color of the theme, the dot in its accent. */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 17 100 70" accessibilityLabel="Availo">
      <Path d={LOGO_PATH} stroke={colors.text} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={50} cy={60} r={8} fill={colors.primary} />
    </Svg>
  );
}
