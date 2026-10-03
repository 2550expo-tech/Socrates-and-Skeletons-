/**
 * The little stage shown while slips are being read (FR-4): a slip under a
 * sweeping scan beam, and each newly read slip's amount popping up beside it
 * with a few sparkles. Everything stops when reading stops.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Rect } from 'react-native-svg';
import type { Transaction } from '../domain/types';
import { Aurora, Reveal, ScanBeam, Sparkles } from './effects';
import { Money, T } from './components';
import { alpha, palette, radius, space, useTheme } from './theme';

const PAPER_W = 84;
const PAPER_H = 116;

/** A plain slip drawn in code (no bank's look): header, lines, amount and a small QR in the corner. */
function SlipPaper() {
  const qr = [
    [0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2],
    [4, 0], [5, 1], [4, 2], [3, 3], [5, 3], [0, 4], [2, 4], [4, 4], [1, 5], [3, 5], [5, 5],
  ];
  return (
    <Svg width={PAPER_W} height={PAPER_H} viewBox={`0 0 ${PAPER_W} ${PAPER_H}`}>
      <Rect x={0} y={0} width={PAPER_W} height={PAPER_H} rx={10} fill="#F7F5EE" />
      <Rect x={0} y={0} width={PAPER_W} height={20} rx={10} fill="#2E9A68" />
      <Rect x={0} y={10} width={PAPER_W} height={10} fill="#2E9A68" />
      <Rect x={10} y={30} width={44} height={5} rx={2.5} fill="#C9D3CB" />
      <Rect x={10} y={41} width={60} height={5} rx={2.5} fill="#DDE3DD" />
      <Rect x={10} y={52} width={36} height={5} rx={2.5} fill="#DDE3DD" />
      <Rect x={10} y={66} width={40} height={9} rx={4.5} fill={palette.gold} opacity={0.85} />
      <G>
        {qr.map(([x, y]) => (
          <Rect key={`${x}-${y}`} x={52 + x * 4} y={82 + y * 4} width={4} height={4} fill="#1D2A23" />
        ))}
      </G>
    </Svg>
  );
}

export function ScannerStage({ active, latest }: { active: boolean; latest: Transaction | null }) {
  const theme = useTheme();
  const sign = latest ? (latest.kind === 'income' ? 1 : -1) : 1;
  return (
    <View style={{ height: 152, borderRadius: radius.lg, overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={[theme.hero, theme.heroDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Aurora cycles={0} strength={0.28} seed={21} />
      <View style={{ position: 'absolute', left: space.xl, top: 18, width: PAPER_W, height: PAPER_H, transform: [{ rotate: '-4deg' }] }}>
        <SlipPaper />
        <ScanBeam height={PAPER_H} active={active} />
      </View>
      <Sparkles trigger={latest?.id} count={7} cycles={1} seed={5} area={{ top: 10, bottom: 80 }} />
      <View style={{ position: 'absolute', left: PAPER_W + space.xl * 2, right: space.lg, top: 0, bottom: 0, justifyContent: 'center' }}>
        {latest ? (
          <Reveal key={latest.id} zoom from={14}>
            <View style={{ backgroundColor: alpha(theme.heroInk, 0.12), borderRadius: radius.lg, borderWidth: 1, borderColor: alpha(theme.heroAccent, 0.45), padding: space.md, gap: 2 }}>
              <Money satang={sign * latest.amountSatang} sign decimals={false} size="h2" color={sign > 0 ? theme.heroIncome : theme.heroAccent} />
              <T v="small" numberOfLines={1} color={theme.heroInk}>
                {latest.title}
              </T>
            </View>
          </Reveal>
        ) : (
          <T v="small" color={theme.heroInkSoft}>
            {active ? 'กำลังส่องหาสลิป…' : 'พร้อมอ่านสลิป'}
          </T>
        )}
      </View>
    </View>
  );
}
