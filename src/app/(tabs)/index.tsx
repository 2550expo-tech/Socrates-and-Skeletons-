/**
 * Home (MindPay ใหม่): three parts, and the money always comes first.
 * 1. The money card (FR-6 + FR-2): how many days the money lasts, a rail from
 *    today to that day with the month end marked, whether it reaches the month
 *    end ("เหลือเก็บได้อีก / ขาดอีก … วัน"), the balance and the 7-day average
 *    the days come from. Tap it for Money Runway.
 * 2. งบเดือนนี้: this month's budget, how far through the month we are, and
 *    what is left for today (only with a budget).
 * 3. รายการล่าสุด: the last three items.
 * Above them, at most ONE attention card (src/domain/attention.ts): money
 * matters first, then new rewards, then one promotion a day. Today's spending
 * sits beside the (+) in the tab bar (Quick Access).
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Animated, Pressable, RefreshControl, View } from 'react-native';
import { useApp, useMoney } from '../../data/AppProvider';
import { Storage } from '../../data/storage';
import { pickAttention, type AttentionItem, type PromoItem, type PromoTurn } from '../../domain/attention';
import { budgetToday } from '../../domain/budget';
import type { BuddyMood } from '../../domain/buddy';
import { bkkDayKey, formatThaiDay, formatThaiMonth, previousMonth, relativeDayLabel, thaiWeekday } from '../../domain/dates';
import { halloweenOn } from '../../domain/halloween';
import { formatBaht } from '../../domain/money';
import { recapToOffer } from '../../domain/recap';
import { monthEndCheck, type Runway } from '../../domain/runway';
import { skinById } from '../../domain/skins';
import { useAutoScan } from '../../services/AutoScanProvider';
import { useEquippedSkin, useKla } from '../../services/kla';
import { useAchievements } from '../../services/useAchievements';
import { markWhatsNewSeen, useWhatsNewPending } from '../../services/whatsNew';
import { DotGrid } from '../../ui/art';
import { AutoScanBanner } from '../../ui/AutoScanBanner';
import { Buddy } from '../../ui/Buddy';
import { Divider, EmptyState, IconButton, Ionicons, Money, Row, Screen, T, type IconName } from '../../ui/components';
import { Reveal, useCelebrate, usePressSpring } from '../../ui/effects';
import { closeHalloweenInvite, GhostArt, HalloweenStrip, SpookyHeroDecor, useHalloween, useHalloweenInvitePending } from '../../ui/halloween';
import { KlaPicture } from '../../ui/kla/KlaPicture';
import { Medal } from '../../ui/Medal';
import { useCountUp, useReduceMotion } from '../../ui/motion';
import { monthEndStatus, railLabel, RunwayRail } from '../../ui/RunwayRail';
import { TxRow } from '../../ui/TxRow';
import { useToast } from '../../ui/feedback';
import { alpha, fonts, radius, space, useTheme } from '../../ui/theme';
import { setColorTheme } from '../../ui/themeMode';

/** Badges already celebrated in this session (the home screen can mount again). */
const celebrated = new Set<string>();

// ---------------------------------------------------------------- today's promotional turn (one a day)

const TURN_KEY = 'mindpay.attention.turn';
const RECAP_CLOSED_KEY = 'mindpay.recap.offerClosed';
type Prefs = { turn: PromoTurn | null; recapClosed: string | null };
let prefs: Prefs | undefined;
const prefListeners = new Set<() => void>();
const prefSub = (l: () => void) => {
  prefListeners.add(l);
  return () => {
    prefListeners.delete(l);
  };
};
const prefSnap = () => prefs;
function setPrefs(next: Partial<Prefs>) {
  prefs = { turn: null, recapClosed: null, ...prefs, ...next };
  prefListeners.forEach((l) => l());
  if ('turn' in next) Storage.setItem(TURN_KEY, JSON.stringify(next.turn)).catch(() => {});
  if ('recapClosed' in next && next.recapClosed) Storage.setItem(RECAP_CLOSED_KEY, next.recapClosed).catch(() => {});
}
function usePrefs(): Prefs | undefined {
  const value = useSyncExternalStore(prefSub, prefSnap, prefSnap);
  useEffect(() => {
    if (prefs) return;
    Promise.all([Storage.getItem(TURN_KEY), Storage.getItem(RECAP_CLOSED_KEY)])
      .then(([t, r]) => {
        let turn: PromoTurn | null = null;
        try {
          turn = t ? (JSON.parse(t) as PromoTurn) : null;
        } catch {
          turn = null;
        }
        prefs = { turn, recapClosed: r };
        prefListeners.forEach((l) => l());
      })
      .catch(() => {
        prefs = { turn: null, recapClosed: null };
        prefListeners.forEach((l) => l());
      });
  }, []);
  return value;
}

// ---------------------------------------------------------------- header

function moodOf(r: Runway): BuddyMood {
  if (r.status === 'below_floor' || r.status === 'critical') return 'worried';
  if (r.status === 'healthy') return 'happy';
  return 'calm';
}

/** The recording streak: a small flame and the number of days; opens the achievements. */
function Streak({ days, today }: { days: number; today: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/achievements')}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`จดต่อเนื่อง ${days} วัน ดูความสำเร็จ`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 44, paddingHorizontal: 6 }}
    >
      <Ionicons name={today ? 'flame' : 'flame-outline'} size={20} color={today ? '#E07B2E' : theme.inkSoft} />
      <T v="body" color={theme.ink} style={{ fontFamily: fonts.sansSemi, fontVariant: ['tabular-nums'] }}>
        {days}
      </T>
    </Pressable>
  );
}

// ---------------------------------------------------------------- attention card

function AttentionRow({
  art,
  icon,
  title,
  sub,
  action,
  onPress,
  onClose,
  closeLabel = 'ปิด',
  emphasis,
}: {
  art?: React.ReactNode;
  icon?: IconName;
  title: string;
  sub?: string;
  action?: string;
  onPress?: () => void;
  onClose?: () => void;
  closeLabel?: string;
  emphasis?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingLeft: space.md,
        paddingRight: onClose ? space.xs : space.md,
        paddingVertical: space.sm,
        borderRadius: radius.lg,
        backgroundColor: theme.surface,
        borderWidth: emphasis ? 1.5 : 0,
        borderColor: theme.accent,
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `${title}${sub ? ` ${sub}` : ''}${action ? ` ${action}` : ''}` : undefined}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
          {art ?? <Ionicons name={icon ?? 'notifications-outline'} size={20} color={theme.ink} />}
        </View>
        <View style={{ flex: 1, gap: 0 }}>
          <T v="body" numberOfLines={2} style={{ fontFamily: fonts.sansSemi }}>
            {title}
          </T>
          {sub ? (
            <T v="small" numberOfLines={2}>
              {sub}
            </T>
          ) : null}
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={18} color={theme.inkSoft} /> : null}
      </Pressable>
      {onClose ? <IconButton icon="close" label={closeLabel} onPress={onClose} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------- 1. the money card

function MoneyCard({ runway, balance, averageSatang }: { runway: Runway; balance: number; averageSatang: number }) {
  const theme = useTheme();
  const halloween = useHalloween();
  const reduce = useReduceMotion();
  const press = usePressSpring(0.985);
  const check = monthEndCheck(runway);
  const status = monthEndStatus(check);
  // Counts only when the number changes (after a save), never from 0 when the screen appears.
  const daysShown = useCountUp(runway.days ?? 0, !reduce && runway.days !== null && !runway.capped, 700);
  const statusColor = status.tone === 'good' ? theme.heroIncome : status.tone === 'bad' ? '#FFB4A8' : theme.heroInkSoft;
  const label = railLabel(check);

  const figure = (label: string, children: React.ReactNode) => (
    <View style={{ flex: 1, gap: 0 }}>
      <T v="micro" color={theme.heroInkSoft} numberOfLines={1}>
        {label}
      </T>
      {children}
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={() => router.push('/runway')}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`เงินพอใช้อีก ${runway.days ?? '-'} วัน ${status.text} ยอดคงเหลือ ${formatBaht(balance)} แตะเพื่อดูรายละเอียด`}
        style={{ borderRadius: radius.xl, overflow: 'hidden', borderWidth: theme.dark ? 1 : 0, borderColor: alpha(theme.heroInk, 0.08) }}
      >
        <LinearGradient colors={[theme.heroTop, theme.heroDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.lg, gap: space.sm }}>
          <DotGrid color={theme.heroInk} />
          {halloween ? <SpookyHeroDecor /> : null}
          <Row justify="space-between">
            <T v="small" color={theme.heroInkSoft}>
              เงินพอใช้อีก
            </T>
            <Ionicons name="chevron-forward" size={18} color={theme.heroInkSoft} />
          </Row>
          {runway.days === null && runway.status !== 'below_floor' ? (
            <T v="body" color={theme.heroInk}>
              จดรายจ่ายสัก 2–3 วัน แล้วน้องกล้าจะบอกได้ว่าเงินพอใช้กี่วัน
            </T>
          ) : (
            <Row gap={space.sm} align="flex-end">
              <T v="display" color={theme.heroAccent} style={{ fontSize: 56, lineHeight: 64, fontVariant: ['tabular-nums'] }}>
                {runway.status === 'below_floor' ? 0 : runway.capped ? '365+' : daysShown}
              </T>
              <View style={{ paddingBottom: 9, gap: 0 }}>
                <T v="h3" color={theme.heroInk}>
                  วัน
                </T>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', paddingBottom: 11 }}>
                {runway.depletionDay && runway.status !== 'below_floor' ? (
                  <T v="small" color={theme.heroInkSoft} numberOfLines={1}>
                    ถึงประมาณ {formatThaiDay(runway.depletionDay, { year: false })}
                  </T>
                ) : null}
              </View>
            </Row>
          )}
          <RunwayRail check={check} label={label} />
          <Row gap={6}>
            <Ionicons name={status.icon} size={16} color={statusColor} />
            <T v="small" color={statusColor} style={{ fontFamily: fonts.sansSemi, flex: 1 }}>
              {status.text}
            </T>
          </Row>
          <View style={{ height: 1, backgroundColor: alpha(theme.heroInk, 0.14), marginVertical: space.xs }} />
          <Row gap={space.md} align="flex-start">
            {figure('ยอดคงเหลือ', <Money satang={balance} size="body" decimals={false} color={theme.heroInk} style={{ fontFamily: fonts.sansSemi, fontSize: 17, lineHeight: 26 }} />)}
            {figure(
              'ใช้เฉลี่ยต่อวัน (7 วัน)',
              <Money satang={averageSatang} size="body" decimals={false} color={theme.heroInk} style={{ fontFamily: fonts.sansSemi, fontSize: 17, lineHeight: 26 }} />,
            )}
          </Row>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- 2. the budget

function BudgetCard() {
  const theme = useTheme();
  const { txs, profile, today } = useApp();
  const { runway } = useMoney();
  const budget = profile?.monthlyBudgetSatang ?? null;
  // `today` changes at 00:00 Bangkok time, so "today" and the pace start over.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const b = useMemo(() => (budget ? budgetToday({ txs, budgetSatang: budget, spendableSatang: runway.spendableSatang }) : null), [txs, budget, runway.spendableSatang, today]);
  if (!b) {
    return (
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel="ตั้งงบรายเดือน รู้ว่าแต่ละวันใช้ได้เท่าไร"
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: theme.surface }}
      >
        <Ionicons name="wallet-outline" size={22} color={theme.ink} />
        <View style={{ flex: 1 }}>
          <T v="body" style={{ fontFamily: fonts.sansSemi }}>
            ตั้งงบรายเดือน
          </T>
          <T v="small">รู้ว่าแต่ละวันใช้ได้เท่าไร</T>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.inkSoft} />
      </Pressable>
    );
  }
  const used = b.spentMonthSatang / b.budgetSatang;
  // Spending ahead of the month (by more than 10 points): said in words, not by the bar colour alone.
  const fast = b.state !== 'over_month' && used > b.pace + 0.1;
  const barColor = b.state === 'over_month' ? theme.critical : fast ? theme.watch : theme.primary;
  const todayLine =
    b.state === 'over_month'
      ? { text: 'เกินงบเดือนนี้', color: theme.critical }
      : b.state === 'over_today'
        ? { text: `วันนี้เกินงบ ${formatBaht(-b.leftTodaySatang, { decimals: false })}`, color: theme.watch }
        : { text: `งบวันนี้เหลือ ${formatBaht(b.leftTodaySatang, { decimals: false })}`, color: theme.ink };
  return (
    <Pressable
      onPress={() => router.navigate('/stats')}
      accessibilityRole="button"
      accessibilityLabel={`งบเดือนนี้ ใช้ไป ${formatBaht(b.spentMonthSatang, { decimals: false })} จาก ${formatBaht(b.budgetSatang, { decimals: false })} ${todayLine.text}${fast ? ' ใช้เร็วกว่าแผน' : ''} แตะเพื่อดูสถิติ`}
      style={({ pressed }) => ({ padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 })}
    >
      <Row justify="space-between" align="flex-end">
        <T v="h3" accessibilityRole="header">
          งบเดือนนี้
        </T>
        {b.leftMonthSatang >= 0 ? (
          <T v="small" color={theme.ink}>
            เหลือ <T v="body" style={{ fontFamily: fonts.sansSemi, fontVariant: ['tabular-nums'] }}>{formatBaht(b.leftMonthSatang, { decimals: false })}</T>
          </T>
        ) : (
          <T v="small" color={theme.critical} style={{ fontFamily: fonts.sansSemi }}>
            เกินงบ {formatBaht(-b.leftMonthSatang, { decimals: false })}
          </T>
        )}
      </Row>
      <View style={{ height: 14, justifyContent: 'center' }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, used * 100)}%`, height: 8, borderRadius: 4, backgroundColor: barColor }} />
        </View>
        {/* How far through the month we are: spending left of this tick is on pace. */}
        <View
          accessible
          accessibilityLabel={`เดือนนี้ผ่านไปแล้ว ${Math.round(b.pace * 100)}%`}
          style={{ position: 'absolute', left: `${Math.min(100, b.pace * 100)}%`, marginLeft: -1, width: 2, height: 14, borderRadius: 1, backgroundColor: theme.ink }}
        />
      </View>
      <Row justify="space-between" align="flex-start" gap={space.sm}>
        <T v="small" style={{ flex: 1 }}>
          ใช้ไป {formatBaht(b.spentMonthSatang, { decimals: false })} จาก {formatBaht(b.budgetSatang, { decimals: false })}
        </T>
        <T v="small" color={todayLine.color} style={{ fontFamily: fonts.sansSemi }}>
          {todayLine.text}
        </T>
      </Row>
      {fast ? (
        <Row gap={6}>
          <Ionicons name="trending-up" size={16} color={theme.watch} />
          <T v="small" color={theme.watch} style={{ flex: 1 }}>
            ใช้เร็วกว่าแผน · ใช้ไป {Math.round(used * 100)}% เดือนผ่านไป {Math.round(b.pace * 100)}%
          </T>
        </Row>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- the screen

export default function Home() {
  const theme = useTheme();
  const { profile, txs, repo, refresh, refreshing, loadError, today, status } = useApp();
  const { balance, runway, drafts, average } = useMoney();
  const auto = useAutoScan();
  const ach = useAchievements();
  const kla = useKla();
  const skin = useEquippedSkin();
  const halloween = useHalloween();
  const whatsNew = useWhatsNewPending();
  const invitePending = useHalloweenInvitePending();
  const prefsNow = usePrefs();
  const celebrate = useCelebrate();
  const toast = useToast();
  const [, force] = useState(0);
  const recent = useMemo(
    () => [...txs].filter((t) => t.status === 'confirmed').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 3),
    [txs],
  );
  const readyDrafts = drafts.filter((d) => d.reviewFlags.length === 0).length;

  // A badge or skin the user just earned gets one celebration.
  const freshIds = [...ach.fresh.map((b) => b.id), ...kla.fresh.map((id) => `skin:${id}`)].join(',');
  useEffect(() => {
    const ids = freshIds ? freshIds.split(',') : [];
    if (!ids.some((id) => !celebrated.has(id))) return;
    ids.forEach((id) => celebrated.add(id));
    celebrate();
  }, [freshIds, celebrate]);

  // The month's story is offered on the first three days of the next month.
  const recapMonth = useMemo(() => {
    const m = recapToOffer(txs, today);
    return m && m === previousMonth(today.slice(0, 7)) && Number(today.slice(8, 10)) <= 3 ? m : null;
  }, [txs, today]);

  const money = [
    ...(loadError ? (['error'] as const) : []),
    ...(auto.available && auto.state.phase !== 'idle' ? (['autoscan'] as const) : []),
    ...(drafts.length > 0 ? (['drafts'] as const) : []),
  ];
  const promos: PromoItem[] = prefsNow
    ? [
        ...(recapMonth && prefsNow.recapClosed !== recapMonth ? (['recap'] as const) : []),
        ...(halloweenOn(today) && !halloween && invitePending ? (['halloween'] as const) : []),
        ...(whatsNew && txs.length > 0 ? (['whatsnew'] as const) : []),
      ]
    : [];
  const rewards = ach.fresh.length + kla.fresh.length > 0;
  const pick = pickAttention({ money: [...money], rewards, promos, turn: prefsNow?.turn ?? null, today });
  const turnChanged = !!prefsNow && JSON.stringify(pick.turn) !== JSON.stringify(prefsNow.turn);
  useEffect(() => {
    if (turnChanged && status === 'ready') setPrefs({ turn: pick.turn });
  }, [turnChanged, status, pick.turn]);
  const closeTurn = () => {
    setPrefs({ turn: { ...pick.turn, closed: true } });
    force((n) => n + 1);
  };

  function attention(item: AttentionItem | null) {
    switch (item) {
      case 'error':
        return (
          <AttentionRow icon="cloud-offline-outline" title="โหลดข้อมูลล่าสุดไม่สำเร็จ" sub={loadError ?? undefined} action="ลองอีกครั้ง" onPress={refresh} emphasis />
        );
      case 'autoscan':
        return <AutoScanBanner />;
      case 'drafts':
        return (
          <AttentionRow
            icon="receipt-outline"
            title={`สลิปรอยืนยัน ${drafts.length} รายการ`}
            sub={`พร้อมยืนยัน ${readyDrafts} · ต้องตรวจ ${drafts.length - readyDrafts} · ยังไม่รวมในยอดเงิน`}
            onPress={() => router.push('/drafts')}
            emphasis
          />
        );
      case 'rewards': {
        const medals = ach.fresh;
        const skins = kla.fresh;
        // Names only when there is one of a kind; otherwise counts (never a list).
        const title = medals.length
          ? medals.length === 1
            ? `ได้เหรียญใหม่: ${medals[0].title}`
            : `ได้เหรียญใหม่ ${medals.length} เหรียญ`
          : skins.length === 1
            ? `น้องกล้าได้ชุดใหม่: ${skinById(skins[0]).name}`
            : `น้องกล้าได้ชุดใหม่ ${skins.length} ชุด`;
        const sub = medals.length && skins.length ? `และชุดใหม่ของน้องกล้า ${skins.length} ชุด` : undefined;
        return (
          <AttentionRow
            art={medals.length ? <Medal badge={medals[0]} size={34} /> : <KlaPicture skin={skins[0]} mood="cheer" width={34} extras={false} ground={false} />}
            title={title}
            sub={sub}
            action="ดู"
            onPress={() => {
              if (medals.length) {
                kla.markSeen(skins);
                router.push('/achievements');
              } else router.push({ pathname: '/skins', params: { skin: skins[0] } });
            }}
            onClose={() => {
              ach.markSeen(medals.map((m) => m.id));
              kla.markSeen(skins);
            }}
            closeLabel="ไว้ทีหลัง"
          />
        );
      }
      case 'recap':
        return (
          <AttentionRow
            icon="sparkles-outline"
            title={`สรุปเดือน${formatThaiMonth(recapMonth!)} พร้อมแล้ว`}
            sub="เงินไปไหน วันไหนใช้เยอะ และเก่งขึ้นแค่ไหน"
            onPress={() => router.push({ pathname: '/recap', params: { month: recapMonth! } })}
            onClose={() => {
              setPrefs({ recapClosed: recapMonth! });
              closeTurn();
            }}
          />
        );
      case 'halloween':
        return (
          <AttentionRow
            art={<GhostArt size={30} />}
            title="ฮาโลวีนมาแล้ว!"
            sub="แตะเพื่อเปิดธีมฮาโลวีน จับผีรับลูกอม แลกชุดผี (ถึง 2 พ.ย.)"
            action="เปิดธีมฮาโลวีน"
            onPress={() => {
              setColorTheme('halloween');
              toast({ message: 'เปิดธีมฮาโลวีนแล้ว เปลี่ยนกลับได้ในหน้าตั้งค่า' });
            }}
            onClose={() => {
              closeHalloweenInvite();
              closeTurn();
            }}
            closeLabel="ปิดการ์ดฮาโลวีน"
          />
        );
      case 'whatsnew':
        return (
          <AttentionRow
            icon="gift-outline"
            title="มีอะไรใหม่ในอัปเดตนี้"
            onPress={() => router.push('/whatsnew')}
            action="ดู"
            onClose={() => {
              markWhatsNewSeen();
              closeTurn();
            }}
            closeLabel="ไม่ต้องแสดงอีก"
          />
        );
      default:
        return null;
    }
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}>
      <Row gap={space.sm} style={{ paddingTop: space.sm }}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.navigate('/coach');
          }}
          accessibilityRole="button"
          accessibilityLabel="น้องกล้า แตะเพื่อคุยกับโค้ช"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}
        >
          <KlaPicture skin={skin} mood={moodOf(runway)} width={40} extras={false} ground={false} />
        </Pressable>
        <View style={{ flex: 1, gap: 0 }}>
          <Row gap={6}>
            <T v="small" numberOfLines={1}>
              {thaiWeekday(today)} {formatThaiDay(today, { year: false })}
            </T>
            {repo?.mode === 'demo' ? (
              <View style={{ paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: theme.surfaceAlt }}>
                <T v="micro" color={theme.ink}>
                  ทดลอง
                </T>
              </View>
            ) : null}
          </Row>
          <T v="h3" numberOfLines={1}>
            สวัสดี {profile?.displayName || ''}
          </T>
        </View>
        <Streak days={ach.streak.days} today={ach.streak.today} />
        <IconButton icon="settings-outline" label="ตั้งค่า" onPress={() => router.push('/settings')} />
      </Row>

      {/* At most one card that needs attention. */}
      {pick.item ? <Reveal from={-8}>{attention(pick.item)}</Reveal> : null}

      {/* 1. The money card */}
      <Reveal index={1}>
        <MoneyCard runway={runway} balance={balance} averageSatang={average.averageSatang} />
      </Reveal>

      {/* Halloween theme, during the event: today's ghost hunt, closable for the day. */}
      {halloween && halloweenOn(today) ? <HalloweenStrip today={today} /> : null}

      {/* 2. This month's budget */}
      <Reveal index={2}>
        <BudgetCard />
      </Reveal>

      {/* 3. Latest transactions */}
      <Reveal index={3}>
        <View style={{ gap: space.sm }}>
          <Row justify="space-between">
            <T v="h3" accessibilityRole="header">
              รายการล่าสุด
            </T>
            <Pressable onPress={() => router.navigate('/transactions')} hitSlop={10} accessibilityRole="button" accessibilityLabel="ดูทั้งหมด" style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 }}>
              <T v="small" color={theme.ink} style={{ fontFamily: fonts.sansSemi }}>
                ดูทั้งหมด
              </T>
              <Ionicons name="chevron-forward" size={16} color={theme.ink} />
            </Pressable>
          </Row>
          <View style={{ borderRadius: radius.lg, backgroundColor: theme.surface, paddingHorizontal: space.lg, paddingVertical: space.xs }}>
            {recent.length === 0 ? (
              <EmptyState
                icon="wallet-outline"
                art={<Buddy mood="sleepy" size={84} />}
                title="ยังไม่มีรายการ"
                body="กดปุ่ม + ด้านล่าง เพื่อเลือกสลิป พูด หรือจดรายการแรก"
                action="เพิ่มรายการแรก"
                onAction={() => router.push('/add')}
              />
            ) : (
              recent.map((t, i) => (
                <View key={t.id}>
                  {i > 0 ? <Divider /> : null}
                  <TxRow tx={t} dayLabel={bkkDayKey(t.occurredAt) === today ? null : relativeDayLabel(bkkDayKey(t.occurredAt))} />
                </View>
              ))
            )}
          </View>
        </View>
      </Reveal>
    </Screen>
  );
}
