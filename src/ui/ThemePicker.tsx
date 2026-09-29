/**
 * Choose the app's colour theme: each card is a small preview of the balance
 * card in that theme (its hero gradient, a gold coin and the theme's accent).
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import { Ionicons, T } from './components';
import { buildTheme, COLOR_THEMES, fonts, radius, space, useTheme, type ColorThemeKey } from './theme';
import { setColorTheme, useColorThemeKey } from './themeMode';

export function ThemePicker() {
  const theme = useTheme();
  const current = useColorThemeKey();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {COLOR_THEMES.map((spec) => {
        const t = buildTheme(spec.key, theme.dark);
        const selected = current === spec.key;
        return (
          <Pressable
            key={spec.key}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setColorTheme(spec.key as ColorThemeKey);
            }}
            accessibilityRole="button"
            accessibilityLabel={`ธีม ${spec.name}`}
            aria-selected={selected}
            style={({ pressed }) => ({
              width: '48%',
              flexGrow: 1,
              borderRadius: radius.md,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? t.accent : theme.line,
              backgroundColor: t.bg,
              padding: 6,
              gap: 6,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <LinearGradient
              colors={[t.heroTop, t.hero, t.heroDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ height: 54, borderRadius: radius.sm, padding: 8, justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: t.heroInkSoft, opacity: 0.8 }} />
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.heroAccent }} />
              </View>
              <View style={{ width: 62, height: 9, borderRadius: 5, backgroundColor: t.heroAccent }} />
            </LinearGradient>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.primary }} />
              <View style={{ flex: 1 }}>
                <T v="small" color={t.ink} style={{ fontFamily: fonts.sansSemi }} numberOfLines={1}>
                  {spec.name}
                </T>
                <T v="micro" color={t.inkSoft} numberOfLines={1}>
                  {spec.nameEn}
                </T>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={18} color={t.primary} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
