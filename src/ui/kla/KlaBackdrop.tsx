/**
 * The little stage น้องกล้า stands on: the colour theme's hero gradient, soft
 * drifting light, a spotlight behind the character and a lit floor under it,
 * so the big character reads as standing in a space rather than on a card.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useId, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Aurora } from '../effects';
import { SpookyBackdropDecor } from '../halloween';
import { radius, useTheme } from '../theme';

export function KlaBackdrop({
  children,
  style,
  floorAt = 0.8,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Where the floor is, as a share of the height (the character's feet). */
  floorAt?: number;
}) {
  const theme = useTheme();
  const id = `b${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={[{ borderRadius: radius.xl, overflow: 'hidden' }, style]}>
      <LinearGradient colors={[theme.heroTop, theme.hero, theme.heroDeep]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <Aurora cycles={2} strength={0.3} seed={11} />
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <RadialGradient id={`${id}spot`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.heroAccent} stopOpacity={0.3} />
            <Stop offset="0.6" stopColor={theme.heroAccent} stopOpacity={0.08} />
            <Stop offset="1" stopColor={theme.heroAccent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}floor`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={50} cy={floorAt * 100 - 30} rx={42} ry={40} fill={`url(#${id}spot)`} />
        <Ellipse cx={50} cy={floorAt * 100} rx={40} ry={7} fill={`url(#${id}floor)`} />
      </Svg>
      {theme.colorTheme === 'halloween' ? <SpookyBackdropDecor /> : null}
      {children}
    </View>
  );
}
