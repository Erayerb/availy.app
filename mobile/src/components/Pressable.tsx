import { Pressable as NativePressable, type PressableProps } from 'react-native';

// "Basıldı" feedback: a little dimmer and smaller while the finger is down
const PRESSED = { opacity: 0.6, transform: [{ scale: 0.98 }] };

/**
 * React Native's Pressable with visible feedback on every tap (it has none by itself). A style
 * that already reacts to `pressed` is left as it is; something without onPress is not dimmed.
 */
export function Pressable({ style, ...props }: PressableProps) {
  const tappable = !props.disabled && (props.onPress || props.onLongPress);
  return (
    <NativePressable
      {...props}
      style={typeof style === 'function' ? style : ({ pressed }) => [style, pressed && tappable ? PRESSED : null]}
    />
  );
}
