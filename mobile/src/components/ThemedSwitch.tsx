import { Platform, Switch } from 'react-native';

import { colors, isDarkScheme } from '../theme';

type Props = { value: boolean; onValueChange?: (value: boolean) => void; disabled?: boolean };

/** Red/cream switch; react-native-web would otherwise draw the "on" thumb teal. */
export function ThemedSwitch({ value, onValueChange, disabled }: Props) {
  // Off: on the white cards of the light theme the pale track hardly showed; a darker sand there
  const off = isDarkScheme() ? colors.disabled : '#B5A086';
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: colors.primary, false: off }}
      ios_backgroundColor={off}
      thumbColor={colors.white}
      {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.white } as object) : {})}
    />
  );
}
