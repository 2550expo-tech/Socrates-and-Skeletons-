/**
 * "สรุปเดือน": the month as a story of full screens (like a year-in-review),
 * each on its own colour, moving on by itself every few seconds. Tap the right
 * side for the next screen, the left side to go back. Rules: domain/recap.ts.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, useMoney } from '../data/AppProvider';
import { BUDDY_NAME } from '../domain/buddy';
import { formatThaiDay } from '../domain/dates';
import { formatBaht } from '../domain/money';
import { monthRecap } from '../domain/recap';
import { useAchievements } from '../services/useAchievements';
import { treeHealth, MoneyTree } from '../ui/art';
import { Buddy } from '../ui/Buddy';
import { Button, Ionicons, Row, T } from '../ui/components';
import { Aurora, GrowBar, Reveal, Sparkles, useCelebrate } from '../ui/effects';
import { useCountUp, useNative, useReduceMotion } from '../ui/motion';
import { goBack } from '../ui/nav';
import { fonts, space, useTheme } from '../ui/theme';

const SLIDE_MS = 6500;
const INK = '#F4F1E6';
const SOFT = '#C9D8CF';

/** Colours of the story screens in between (the first and last use the theme's own). */
const GRADIENTS: [string, string, string][] = [
  ['#6B4A0E', '#3B2A0B', '#1D1405'],
  ['#0F3D4A', '#0A2A33', '#061A20'],
  ['#4A1F3D', '#2E1327', '#1A0A16'],
  ['#123A6B', '#0B2547', '#061528'],
  ['#1F5A3A', '#123A27', '#08201A'],
];

/** A baht amount that counts up when the screen appears. */
function BigBaht({ satang, color }: { satang: number; color?: string }) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const baht = useCountUp(Math.round(satang / 100), !reduce, 1200);
  return (
    <T v="display" color={color ?? theme.heroAccent} style={{ fontFamily: fonts.serifBold }}>
      {formatBaht(baht * 100, { decimals: false })}
    </T>
  );
}

function Line({ children, index = 0, big }: { children: ReactNode; index?: number; big?: boolean }) {
  return (
    <Reveal index={index} from={16}>
      <T v={big ? 'h2' : 'body'} color={big ? INK : SOFT} center>
        {children}
      </T>
    </Reveal>
  );
}

export default function Recap() {
  const params = useLocalSearchParams<{ month?: string }>();
  const theme = useTheme();
  const { txs, today, profile } = useApp();
  const { runway } = useMoney();
  const { streak, badges } = useAchievements();
  const celebrate = useCelebrate();
  const reduce = useReduceMotion();
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : today.slice(0, 7);
  const r = useMemo(() => monthRecap(txs, month, today), [txs, month, today]);
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const celebrated = useRef(false);

  const restart = () => {
    setIndex(0);
    setRound((n) => n + 1);
  };
  const top = r.top[0];
  const change = r.changePct;
  const slides: { key: string; body: ReactNode }[] = [
    {
      key: 'intro',
      body: (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Reveal zoom>
            <Buddy mood="cheer" size={150} onDark />
          </Reveal>
          <Line index={1}>สรุปเดือน</Line>
          <Reveal index={2} zoom>
            <T v="display" color={theme.heroAccent} center style={{ fontFamily: fonts.serifBold }}>
              {r.label}
            </T>
          </Reveal>
          <Line index={3}>{`ของ${profile?.displayName ? `คุณ${profile.displayName}` : 'คุณ'}${r.partial ? ` · ${r.days} วันแรก` : ''}`}</Line>
          <Line index={5}>แตะด้านขวาเพื่อไปต่อ</Line>
        </View>
      ),
    },
    {
      key: 'spent',
      body: (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Line>{r.partial ? 'เดือนนี้ใช้ไปแล้ว' : 'ทั้งเดือนใช้ไป'}</Line>
          <BigBaht satang={r.expenseSatang} />
          <Line index={2}>{`จาก ${r.count} รายการ · เฉลี่ยวันละ ${formatBaht(r.avgPerDaySatang, { decimals: false })}`}</Line>
          <Reveal index={4}>
            <Row gap={space.sm} style={{ marginTop: space.lg, backgroundColor: 'rgba(244,241,230,0.10)', borderRadius: 999, paddingHorizontal: space.lg, paddingVertical: space.sm }}>
              <Ionicons name="arrow-down-circle" size={20} color="#7FD1A8" />
              <T v="body" color={INK}>
                เงินเข้า {formatBaht(r.incomeSatang, { decimals: false })}
              </T>
            </Row>
          </Reveal>
        </View>
      ),
    },
    {
      key: 'where',
      body: top ? (
        <View style={{ alignItems: 'center', gap: space.md, alignSelf: 'stretch' }}>
          <Line>เงินไปที่ไหนมากที่สุด</Line>
          <Reveal index={1} zoom>
            <T v="display" center style={{ fontSize: 72, lineHeight: 96 }}>
              {top.glyph}
            </T>
          </Reveal>
          <Line index={2} big>
            {top.label}
          </Line>
          <Line index={3}>{`${formatBaht(top.amountSatang, { decimals: false })} · ${Math.round(top.share * 100)}% ของรายจ่าย`}</Line>
          <View style={{ alignSelf: 'stretch', gap: space.md, marginTop: space.lg }}>
            {r.top.map((c, i) => (
              <Reveal key={c.key} index={4 + i}>
                <View style={{ gap: 6 }}>
                  <Row justify="space-between">
                    <T v="small" color={INK}>{`${c.glyph} ${c.label}`}</T>
                    <T v="small" color={SOFT}>{formatBaht(c.amountSatang, { decimals: false })}</T>
                  </Row>
                  <GrowBar value={c.share} color={i === 0 ? theme.heroAccent : '#7FD1A8'} track="rgba(244,241,230,0.12)" height={10} delay={500 + i * 150} />
                </View>
              </Reveal>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Line big>{r.partial ? 'เดือนนี้ยังไม่มีรายจ่าย' : 'เดือนนี้ไม่มีรายจ่ายเลย'}</Line>
          <Line index={1}>ลองจดรายการหรือสแกนสลิป แล้วสรุปจะมีเรื่องเล่าเยอะขึ้น</Line>
        </View>
      ),
    },
    {
      key: 'days',
      body: (
        <View style={{ alignItems: 'center', gap: space.md }}>
          {r.biggestDay ? (
            <>
              <Line>วันที่ใช้เยอะที่สุด</Line>
              <Line index={1} big>
                {formatThaiDay(r.biggestDay.day)}
              </Line>
              <BigBaht satang={r.biggestDay.amountSatang} color="#F29E9E" />
            </>
          ) : null}
          <Reveal index={3} zoom>
            <View style={{ alignItems: 'center', marginTop: space.xl, gap: space.xs }}>
              <T v="display" color="#7FD1A8" style={{ fontFamily: fonts.serifBold }}>
                {r.noSpendDays}
              </T>
              <T v="body" color={INK} center>
                วันที่ไม่ใช้เงินเลย
              </T>
            </View>
          </Reveal>
          {r.favorite ? <Line index={5}>{`จ่ายบ่อยที่สุด: ${r.favorite.title} (${r.favorite.times} ครั้ง)`}</Line> : null}
        </View>
      ),
    },
    {
      key: 'habits',
      body: (
        <View style={{ alignItems: 'center', gap: space.lg, alignSelf: 'stretch' }}>
          <Line>เดือนนี้จดด้วยวิธีไหน</Line>
          <Row justify="space-around" style={{ alignSelf: 'stretch' }}>
            {[
              { icon: 'receipt' as const, n: r.from.slips, label: 'สลิป' },
              { icon: 'mic' as const, n: r.from.voice, label: 'พูดจด' },
              { icon: 'create' as const, n: r.from.typed, label: 'พิมพ์เอง' },
            ].map((h, i) => (
              <Reveal key={h.label} index={1 + i} zoom>
                <View style={{ alignItems: 'center', gap: space.xs, width: 92 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(244,241,230,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={h.icon} size={30} color={theme.heroAccent} />
                  </View>
                  <T v="h1" color={INK}>
                    {h.n}
                  </T>
                  <T v="small" color={SOFT}>
                    {h.label}
                  </T>
                </View>
              </Reveal>
            ))}
          </Row>
          <Reveal index={5}>
            <Row gap={space.sm} style={{ backgroundColor: 'rgba(244,241,230,0.10)', borderRadius: 999, paddingHorizontal: space.lg, paddingVertical: space.sm }}>
              <Ionicons name="flame" size={20} color="#F29E4C" />
              <T v="body" color={INK}>
                จดต่อเนื่องสูงสุด {streak.best} วัน
              </T>
            </Row>
          </Reveal>
        </View>
      ),
    },
    {
      key: 'compare',
      body: (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Line>{`เทียบกับ${r.prevLabel}${r.partial ? ` (${r.days} วันแรกเท่ากัน)` : ''}`}</Line>
          {change === null ? (
            <>
              <Line index={1} big>
                เดือนแรกของการจด
              </Line>
              <Line index={2}>เริ่มต้นได้ดีมาก เดือนหน้าจะได้เห็นว่าเปลี่ยนไปแค่ไหน</Line>
            </>
          ) : (
            <>
              <Reveal index={1} zoom>
                <Row gap={space.sm}>
                  <Ionicons name={change <= 0 ? 'trending-down' : 'trending-up'} size={44} color={change <= 0 ? '#7FD1A8' : '#F2B36B'} />
                  <T v="display" color={change <= 0 ? '#7FD1A8' : '#F2B36B'} style={{ fontFamily: fonts.serifBold }}>
                    {`${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change)}%`}
                  </T>
                </Row>
              </Reveal>
              <Line index={2} big>
                {change < 0 ? 'ใช้น้อยลง เก่งมาก!' : change === 0 ? 'เท่าเดิมพอดี' : 'ใช้มากขึ้นนิดหน่อย'}
              </Line>
              <Line index={3}>
                {change <= 0
                  ? `${BUDDY_NAME}ภูมิใจมาก รักษาจังหวะนี้ไว้นะ`
                  : top
                    ? `ไม่เป็นไร เดือนหน้าลองดูหมวด${top.label}ก่อน ค่อย ๆ ปรับไปด้วยกัน`
                    : 'ไม่เป็นไร ค่อย ๆ ปรับไปด้วยกัน'}
              </Line>
            </>
          )}
        </View>
      ),
    },
    {
      key: 'outro',
      body: (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Reveal zoom>
            <MoneyTree health={treeHealth(runway.status, runway.days)} size={150} trunk="#E8E1CC" leaf={theme.heroAccent} bare={theme.heroBare} glow={theme.heroAccent} grow sway />
          </Reveal>
          <Line index={1} big>
            {runway.days !== null && runway.status !== 'below_floor'
              ? runway.capped
                ? 'เงินพอใช้เกิน 1 ปี'
                : `ตอนนี้เงินพอใช้อีก ${runway.days} วัน`
              : 'เดือนหน้าเริ่มใหม่ไปด้วยกัน'}
          </Line>
          <Line index={2}>{`เหรียญที่ได้แล้ว ${badges.filter((b) => b.earned).length} จาก ${badges.length}`}</Line>
          <Reveal index={4}>
            <Row gap={space.sm} style={{ marginTop: space.lg }}>
              <Button label="ดูอีกครั้ง" kind="onDark" icon="refresh" onPress={() => restart()} />
              <Button label="เสร็จ" kind="gold" icon="checkmark" onPress={() => goBack()} />
            </Row>
          </Reveal>
        </View>
      ),
    },
  ];
  const last = slides.length - 1;

  const go = useCallback(
    (to: number) => {
      if (to < 0) return;
      if (to > last) {
        goBack();
        return;
      }
      setIndex(to);
    },
    [last],
  );

  // The bar at the top fills up; when it is full the next screen comes.
  useEffect(() => {
    progress.setValue(0);
    if (index === last) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: useNative });
    anim.start(({ finished }) => {
      if (finished) setIndex((i) => Math.min(i + 1, last));
    });
    return () => anim.stop();
  }, [index, last, progress, round]);

  useEffect(() => {
    if (index === last && !celebrated.current) {
      celebrated.current = true;
      celebrate();
    }
  }, [index, last, celebrate]);

  const heroColors: [string, string, string] = [theme.heroTop, theme.hero, theme.heroDeep];
  const colors = index === 0 || index === last ? heroColors : GRADIENTS[(index - 1) % GRADIENTS.length];
  const slide = slides[index];
  return (
    <View style={{ flex: 1, backgroundColor: colors[2] }}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
        <Aurora key={`aurora-${index}-${round}`} cycles={1} strength={0.4} seed={index * 7 + 3} />
        {index === last ? <Sparkles key={`stars-${round}`} count={12} cycles={2} /> : null}
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          {/* progress, one segment per screen */}
          <Row gap={4} style={{ paddingHorizontal: space.md, paddingTop: space.sm }}>
            {slides.map((s, i) => (
              <View key={s.key} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(244,241,230,0.25)', overflow: 'hidden' }}>
                <Animated.View
                  style={{
                    height: 3,
                    backgroundColor: INK,
                    transformOrigin: 'left',
                    transform: [{ scaleX: i < index ? 1 : i > index ? 0 : reduce ? 1 : progress }],
                  }}
                />
              </View>
            ))}
          </Row>
          <Row justify="space-between" style={{ paddingHorizontal: space.md, paddingTop: space.sm }}>
            <T v="small" color={SOFT}>
              {`สรุปเดือน · ${r.label}`}
            </T>
            <Pressable onPress={() => goBack()} accessibilityRole="button" accessibilityLabel="ปิดสรุปเดือน" hitSlop={10}>
              <Ionicons name="close" size={26} color={INK} />
            </Pressable>
          </Row>
          <View style={{ flex: 1 }}>
            {/* Tap zones: left goes back, right goes on (behind the content, so its buttons still work). */}
            <Row style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} align="stretch">
              <Pressable style={{ flex: 3 }} onPress={() => go(index - 1)} accessibilityRole="button" accessibilityLabel="ย้อนกลับ" />
              <Pressable style={{ flex: 7 }} onPress={() => go(index + 1)} accessibilityRole="button" accessibilityLabel="ถัดไป" />
            </Row>
            <View
              key={`${slide.key}-${round}`}
              // Taps go through to the tap zones, except on the last screen's buttons.
              pointerEvents={index === last ? 'box-none' : 'none'}
              style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.xl }}
            >
              {slide.body}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
