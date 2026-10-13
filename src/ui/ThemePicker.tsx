/**
 * Choose the app's colour theme: a row of round swatches (each one the theme's
 * hero gradient with its gold coin), and the chosen theme's name under them.
 * The festival theme (ฮาโลวีน) carries a little ghost.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import { Ionicons, T } from './components';
import { GhostArt } from './halloween';
import { buildTheme, COLOR_THEMES, fonts, space, useTheme, type ColorThemeKey } from './theme';
import { setColorTheme, useColorThemeKey } from './themeMode';

const SIZE = 46;

export function ThemePicker() {
  const theme = useTheme();
  const current = useColorThemeKey();
  const chosen = COLOR_THEMES.find((s) => s.key === current) ?? COLOR_THEMES[0];
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
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
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`ธีม ${spec.name}`}
              aria-selected={selected}
              style={({ pressed }) => ({
                width: SIZE + 8,
                height: SIZE + 8,
                borderRadius: (SIZE + 8) / 2,
                padding: 2,
                borderWidth: 2,
                borderColor: selected ? theme.ink : 'transparent',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <LinearGradient
                colors={[t.heroTop, t.hero, t.heroDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' }}
              >
                {spec.festival ? (
                  <GhostArt size={26} />
                ) : (
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: t.heroAccent }} />
                )}
                {selected ? (
                  <View style={{ position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark-circle" size={18} color={theme.ink} />
                  </View>
                ) : null}
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>
      <View style={{ gap: 0 }}>
        <T v="body" style={{ fontFamily: fonts.sansSemi }}>
          {chosen.name}
        </T>
        <T v="micro">{chosen.festival ? `${chosen.nameEn} · ธีมเทศกาล มีผีให้จับ` : chosen.nameEn}</T>
      </View>
    </View>
  );
}
