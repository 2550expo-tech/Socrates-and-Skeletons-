/**
 * A badge medal: a gold coin with a ribbon when earned, a quiet grey coin with
 * a progress ring when not yet. Drawn in code (react-native-svg), no images.
 */
import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import type { Badge } from '../domain/achievements';
import { Ionicons, T } from './components';
import { Shine } from './effects';
import { fonts, palette, space, useTheme } from './theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function Medal({ badge, size = 68, shine }: { badge: Badge; size?: number; shine?: boolean }) {
  const theme = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const earned = badge.earned;
  const r = size / 2;
  const ring = 5;
  const progress = !earned && badge.progress ? badge.progress.value / badge.progress.target : 0;
  const c = 2 * Math.PI * (r - ring / 2 - 1);
  const track = theme.dark ? '#26382F' : '#D5DED8';
  return (
    <View
      accessible
      accessibilityLabel={`${badge.title}: ${earned ? 'ได้แล้ว' : `ยังไม่ได้ ${badge.how}`}${!earned && badge.progress ? ` (${badge.progress.value}/${badge.progress.target})` : ''}`}
      style={{ alignItems: 'center', gap: space.xs, width: size + 28 }}
    >
      <View style={{ width: size, height: size + 10 }}>
        <Svg width={size} height={size + 10} viewBox={`0 0 ${size} ${size + 10}`}>
          <Defs>
            <LinearGradient id={`${id}rim`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F7DC86" />
              <Stop offset="0.5" stopColor={palette.goldBright} />
              <Stop offset="1" stopColor="#A87A1E" />
            </LinearGradient>
            <LinearGradient id={`${id}face`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#1A6B4B" />
              <Stop offset="1" stopColor={theme.heroDeep} />
            </LinearGradient>
          </Defs>
          {earned ? (
            <>
              {/* ribbon tails */}
              <Path d={`M${r - 14} ${size - 10} L${r - 20} ${size + 9} L${r - 11} ${size + 4} L${r - 5} ${size + 10} L${r - 2} ${size - 6} Z`} fill={theme.primary} />
              <Path d={`M${r + 14} ${size - 10} L${r + 20} ${size + 9} L${r + 11} ${size + 4} L${r + 5} ${size + 10} L${r + 2} ${size - 6} Z`} fill={theme.hero} />
              <Circle cx={r} cy={r} r={r - 1} fill={`url(#${id}rim)`} />
              <Circle cx={r} cy={r} r={r - ring - 2} fill={`url(#${id}face)`} />
              <Circle cx={r} cy={r} r={r - ring - 2} stroke="rgba(247,220,134,0.55)" strokeWidth={1} fill="none" />
            </>
          ) : (
            <>
              <Circle cx={r} cy={r} r={r - 1} fill={theme.surfaceAlt} />
              <Circle cx={r} cy={r} r={r - ring / 2 - 1} stroke={track} strokeWidth={ring} fill="none" />
              {progress > 0 ? (
                <Circle
                  cx={r}
                  cy={r}
                  r={r - ring / 2 - 1}
                  stroke={palette.goldBright}
                  strokeWidth={ring}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${c} ${c}`}
                  strokeDashoffset={c * (1 - progress)}
                  rotation={-90}
                  origin={`${r}, ${r}`}
                />
              ) : null}
            </>
          )}
        </Svg>
        <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={(badge.icon as IconName) ?? 'star'} size={size * 0.38} color={earned ? palette.goldBright : theme.inkFaint} />
        </View>
        {earned && shine ? (
          <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: r, overflow: 'hidden' }} pointerEvents="none">
            <Shine times={1} delay={400} color="rgba(255,255,255,0.5)" />
          </View>
        ) : null}
      </View>
      <T v="micro" center color={earned ? theme.ink : theme.inkSoft} numberOfLines={2} style={earned ? { fontFamily: fonts.sansSemi } : undefined}>
        {badge.title}
      </T>
    </View>
  );
}
