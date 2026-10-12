import { Platform, Switch } from 'react-native';

import { colors } from '../theme';

type Props = { value: boolean; onValueChange?: (value: boolean) => void; disabled?: boolean };

/** Red/cream switch; react-native-web would otherwise draw the "on" thumb teal. */
export function ThemedSwitch({ value, onValueChange, disabled }: Props) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: colors.primary, false: colors.disabled }}
      thumbColor={colors.white}
      {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.white } as object) : {})}
    />
  );
}
