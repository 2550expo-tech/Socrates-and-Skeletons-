/**
 * Money in and out per period, with the exact span of each period so there is
 * no doubt what counts: วันนี้ = 00:00–23:59 today (Bangkok time), 7 วัน = the
 * last 7 full days ending today, and so on. Only confirmed items count.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { useApp } from '../data/AppProvider';
import { formatRangeSpan, RANGE_LABEL } from '../domain/dates';
import { formatBaht } from '../domain/money';
import { summarizeRange } from '../domain/summary';
import type { RangeKey, Transaction } from '../domain/types';
import { Card, Divider, Row, T } from './components';
import { fonts, space, useTheme } from './theme';

const DEFAULT_RANGES: RangeKey[] = ['today', '7d', '1m'];

export function PeriodSummary({ txs, ranges = DEFAULT_RANGES, title }: { txs: Transaction[]; ranges?: RangeKey[]; title?: string }) {
  const theme = useTheme();
  const { today } = useApp(); // periods move forward at 00:00
  const rows = useMemo(
    () => ranges.map((r) => ({ range: r, span: formatRangeSpan(r), sum: summarizeRange(txs, r) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txs, ranges, today],
  );
  return (
    <Card style={{ gap: space.sm }}>
      {title ? <T v="h3">{title}</T> : null}
      {rows.map(({ range, span, sum }, i) => (
        <View key={range} style={{ gap: space.sm }}>
          {i > 0 ? <Divider /> : null}
          <Row justify="space-between" align="flex-start" gap={space.md}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body" style={{ fontFamily: fonts.sansSemi }}>{RANGE_LABEL[range]}</T>
              <T v="micro">{span}</T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <T v="small" color={theme.income}>เข้า {formatBaht(sum.incomeSatang, { decimals: false })}</T>
              <T v="small" color={theme.expense}>ออก {formatBaht(sum.expenseSatang, { decimals: false })}</T>
              <T v="micro" color={sum.netSatang >= 0 ? theme.good : theme.critical}>
                สุทธิ {formatBaht(sum.netSatang, { sign: true, decimals: false })}
              </T>
            </View>
          </Row>
        </View>
      ))}
    </Card>
  );
}
