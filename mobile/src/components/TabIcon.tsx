import Svg, { Circle, Path, Polygon } from 'react-native-svg';

export type IconName = 'home' | 'map' | 'heart' | 'tag' | 'star' | 'chart' | 'menu' | 'people' | 'person' | 'bell';

/** Simple line icons for the bottom tab bar. */
export function TabIcon({ name, color, active }: { name: IconName; color: string; active: boolean }) {
  const stroke = { stroke: color, strokeWidth: active ? 2.2 : 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {name === 'home' && <Path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" {...stroke} />}
      {name === 'map' && (
        <>
          <Path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" {...stroke} />
          <Circle cx={12} cy={9.5} r={2.5} {...stroke} />
        </>
      )}
      {name === 'heart' && (
        <Path
          d="M12 20s-7.5-4.6-9-9.2C1.9 7.3 4.2 4 7.5 4c2 0 3.5 1.2 4.5 2.6C13 5.2 14.5 4 16.5 4c3.3 0 5.6 3.3 4.5 6.8C19.5 15.4 12 20 12 20z"
          {...stroke}
        />
      )}
      {name === 'tag' && (
        <>
          <Path d="M3 12V4h8l10 10-8 8z" {...stroke} />
          <Circle cx={7.5} cy={8} r={1.5} {...stroke} />
        </>
      )}
      {name === 'star' && (
        <Polygon points="12 3 14.8 8.9 21 9.6 16.4 14 17.6 20.3 12 17.2 6.4 20.3 7.6 14 3 9.6 9.2 8.9" {...stroke} />
      )}
      {name === 'chart' && <Path d="M4 20V11M10 20V4M16 20v-7M3 20h18" {...stroke} />}
      {name === 'menu' && <Path d="M4 7h16M4 12h16M4 17h16" {...stroke} />}
      {name === 'bell' && (
        <>
          <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" {...stroke} />
          <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" {...stroke} />
        </>
      )}
      {name === 'person' && (
        <>
          <Circle cx={12} cy={8.5} r={3.6} {...stroke} />
          <Path d="M4.5 20.5c0-4 3.4-6.6 7.5-6.6s7.5 2.6 7.5 6.6" {...stroke} />
        </>
      )}
      {name === 'people' && (
        <>
          <Circle cx={9} cy={8} r={3.2} {...stroke} />
          <Path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6" {...stroke} />
          <Path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.4c2.1.7 3.5 2.8 3.5 5.6" {...stroke} />
        </>
      )}
    </Svg>
  );
}
