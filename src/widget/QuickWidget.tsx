/**
 * The Android home-screen widget of MindPay ใหม่ (Quick Access): today's
 * spending and how long the money lasts on the left, and three quick buttons on
 * the right: pick a slip, speak, and the gold (+) that opens "เพิ่มรายการ".
 * Tapping the numbers opens today's items. Drawn by Android from the saved
 * snapshot (see src/domain/widget.ts), so it works while the app is closed.
 *
 * Only Android imports this file (react-native-android-widget is Android-only).
 */
import { FlexWidget, SvgWidget, TextWidget, type HexColor } from 'react-native-android-widget';
import { WIDGET_LINKS, type WidgetView } from '../domain/widget';

// Material Design icons (Apache 2.0): image, mic, add.
const ICONS = {
  slip: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  voice:
    'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
};

const svg = (path: string, color: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`;
const hex = (c: string) => c as HexColor;

function RoundButton({ icon, uri, label, size, fill, iconColor, iconSize }: { icon: string; uri: string; label: string; size: number; fill: string; iconColor: string; iconSize: number }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: hex(fill), alignItems: 'center', justifyContent: 'center' }}
    >
      <SvgWidget svg={svg(icon, iconColor)} style={{ width: iconSize, height: iconSize }} />
    </FlexWidget>
  );
}

export function QuickWidget({ view }: { view: WidgetView }) {
  const c = view.colors;
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundGradient: { from: hex(c.top), to: hex(c.deep), orientation: 'TL_BR' },
      }}
    >
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: WIDGET_LINKS.today }}
        accessibilityLabel={`${view.spoken} แตะเพื่อดูรายการวันนี้`}
        style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', height: 'match_parent' }}
      >
        <TextWidget text={view.label} maxLines={1} truncate="END" style={{ fontSize: 13, color: hex(c.inkSoft) }} />
        <TextWidget text={view.amount} maxLines={1} style={{ fontSize: 30, fontWeight: '700', color: hex(c.accent) }} />
        <TextWidget text={view.sub} maxLines={1} truncate="END" style={{ fontSize: 12, color: hex(c.ink) }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 8 }}>
        <RoundButton icon={ICONS.slip} uri={WIDGET_LINKS.scan} label="เลือกสลิปจากแกลเลอรี" size={42} fill={`${c.ink}24`} iconColor={c.ink} iconSize={20} />
        <RoundButton icon={ICONS.voice} uri={WIDGET_LINKS.voice} label="พูดรายการ" size={42} fill={`${c.ink}24`} iconColor={c.ink} iconSize={20} />
        <RoundButton icon={ICONS.add} uri={WIDGET_LINKS.add} label="เพิ่มรายการ" size={52} fill={c.accent} iconColor={c.deep} iconSize={28} />
      </FlexWidget>
    </FlexWidget>
  );
}
