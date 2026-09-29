/**
 * Skins (ชุด) for น้องกล้า. Three kinds:
 *   - the starter look everyone has;
 *   - mission skins, unlocked by a money mission (src/domain/missions.ts);
 *   - limited skins, given to everyone who opens the app during a set window
 *     (the Halloween ones need candies collected in that window,
 *     src/domain/halloween.ts). Once the window has passed they cannot be
 *     collected any more and are shown as "สกินลิมิเต็ด".
 *
 * A skin, once owned, stays owned. Drawings: src/ui/kla/art.tsx.
 * Unit tests: __tests__/skins.test.ts.
 */
import { formatThaiDay } from './dates';
import { HALLOWEEN } from './halloween';

export type SkinId =
  | 'classic'
  | 'thai'
  | 'graduate'
  | 'detective'
  | 'dj'
  | 'saver'
  | 'chill'
  | 'hero'
  | 'sakura'
  | 'pioneer'
  | 'songkran2569'
  | 'loykrathong2568'
  | 'newyear2570'
  | 'pumpkin'
  | 'sheetghost'
  | 'witch'
  | 'mummy'
  | 'vampire'
  | 'frankenstein';

export type SkinKind = 'starter' | 'mission' | 'limited';

export interface Skin {
  id: SkinId;
  name: string;
  /** One line about the look. */
  blurb: string;
  kind: SkinKind;
  /** Limited skins: the Bangkok days (inclusive) when opening the app gives it. */
  window?: { from: string; to: string };
  /** Halloween skins: candies needed (collected during the window) instead of just opening the app. */
  candies?: number;
  /** Shown together in the collection (e.g. the Halloween set). */
  event?: 'halloween2569';
  /** Colour behind the skin in the collection. */
  tint: string;
}

export const DEFAULT_SKIN: SkinId = 'classic';

export const SKINS: readonly Skin[] = [
  { id: 'classic', name: 'ต้นกล้า', blurb: 'น้องกล้าตัวจริง ใบทองอร่าม พร้อมยอดอ่อนบนหัว', kind: 'starter', tint: '#E9C46A' },
  { id: 'thai', name: 'ชุดไทย', blurb: 'สวมชฎาทองกับสไบแดงขลิบทอง สง่างามแบบไทย', kind: 'mission', tint: '#C9A227' },
  { id: 'graduate', name: 'บัณฑิตการเงิน', blurb: 'หมวกบัณฑิตพู่ทอง เรียนจบวิชาจดเงินทุกวัน', kind: 'mission', tint: '#4A5A8C' },
  { id: 'detective', name: 'นักสืบสลิป', blurb: 'หมวกนักสืบกับแว่นขยาย ส่องสลิปทุกใบ', kind: 'mission', tint: '#8C6A3A' },
  { id: 'dj', name: 'ดีเจเสียงใส', blurb: 'หูฟังดีเจ ฟังทุกรายการที่คุณพูด', kind: 'mission', tint: '#5B4B8A' },
  { id: 'saver', name: 'เศรษฐีน้อย', blurb: 'มงกุฎเหรียญทองกับสร้อยเหรียญออม', kind: 'mission', tint: '#B8862A' },
  { id: 'chill', name: 'ชิลล์ริมทะเล', blurb: 'แว่นกันแดดกับดอกชบา ใช้เงินชิล ๆ ไม่เกินตัว', kind: 'mission', tint: '#2A9D8F' },
  { id: 'hero', name: 'ฮีโร่คุมงบ', blurb: 'ผ้าคลุมแดงกับหน้ากากฮีโร่ ปกป้องงบทั้งเดือน', kind: 'mission', tint: '#B23A48' },
  { id: 'sakura', name: 'ซากุระ', blurb: 'ใบสีชมพูกับดอกซากุระบานเต็มต้น', kind: 'mission', tint: '#D0668F' },
  {
    id: 'pioneer',
    name: 'ผู้บุกเบิก',
    blurb: 'ใบทองประกายกับดาวผู้บุกเบิก สำหรับผู้ใช้ MindPay รุ่นแรก',
    kind: 'limited',
    window: { from: '2026-09-29', to: '2026-10-31' },
    tint: '#E2B64A',
  },
  {
    id: 'newyear2570',
    name: 'ปีใหม่ 2570',
    blurb: 'หมวกปาร์ตี้กับโบว์ไท ฉลองปีใหม่ไปด้วยกัน',
    kind: 'limited',
    window: { from: '2026-12-25', to: '2027-01-05' },
    tint: '#6B3FA0',
  },
  // ฮาโลวีน 2569: limited, unlocked with candies during the event (src/domain/halloween.ts).
  { id: 'pumpkin', name: 'ผีหัวฟักทอง', blurb: 'หัวฟักทองยิ้มแป้นกับผ้าคลุมผีสีม่วง แจกฟรีช่วงฮาโลวีน', kind: 'limited', window: HALLOWEEN, event: 'halloween2569', tint: '#E0761E' },
  { id: 'sheetghost', name: 'ผีน้อยผ้าขาว', blurb: 'ห่มผ้าขาวทำเป็นผี แต่ยังยิ้มหวานเหมือนเดิม', kind: 'limited', window: HALLOWEEN, candies: 5, event: 'halloween2569', tint: '#9AA3C7' },
  { id: 'witch', name: 'แม่มดน้อย', blurb: 'หมวกแม่มดปลายงอกับไม้กวาดวิเศษ', kind: 'limited', window: HALLOWEEN, candies: 12, event: 'halloween2569', tint: '#6A35A8' },
  { id: 'mummy', name: 'มัมมี่', blurb: 'พันผ้าทั้งตัว ปลอดภัยไว้ก่อนเหมือนเงินสำรอง', kind: 'limited', window: HALLOWEEN, candies: 20, event: 'halloween2569', tint: '#B9A882' },
  { id: 'vampire', name: 'แวมไพร์', blurb: 'ผ้าคลุมคอตั้งกับเขี้ยวเล็ก ๆ ไม่กัดใครหรอก', kind: 'limited', window: HALLOWEEN, candies: 30, event: 'halloween2569', tint: '#8E1F2E' },
  { id: 'frankenstein', name: 'แฟรงเกนสไตน์', blurb: 'ผมทรงแบน รอยเย็บ และน็อตที่คอ ตัวเขียวแต่ใจดี', kind: 'limited', window: HALLOWEEN, candies: 40, event: 'halloween2569', tint: '#4E8A3E' },
  {
    id: 'songkran2569',
    name: 'สงกรานต์ 2569',
    blurb: 'พวงมาลัยมะลิ ดอกไม้บนหัว และขันเงินใบเล็ก',
    kind: 'limited',
    window: { from: '2026-04-10', to: '2026-04-16' },
    tint: '#3E8FC7',
  },
  {
    id: 'loykrathong2568',
    name: 'ลอยกระทง 2568',
    blurb: 'ดอกบัวบนหัวกับกระทงใบตองจุดเทียน',
    kind: 'limited',
    window: { from: '2025-11-03', to: '2025-11-07' },
    tint: '#3E9A5E',
  },
];

const BY_ID = new Map(SKINS.map((s) => [s.id, s]));

export function skinById(id: string | null | undefined): Skin {
  return BY_ID.get(id as SkinId) ?? BY_ID.get(DEFAULT_SKIN)!;
}

export function isSkinId(id: unknown): id is SkinId {
  return typeof id === 'string' && BY_ID.has(id as SkinId);
}

/** Where a skin stands for this user today. */
export type SkinState =
  | { kind: 'owned' }
  /** A mission skin not unlocked yet. */
  | { kind: 'locked' }
  /** A limited skin that can be collected right now (opening the app gives it). */
  | { kind: 'limited_open'; until: string }
  /** A Halloween skin: collect this many candies before the event ends. */
  | { kind: 'candy'; need: number; have: number; until: string }
  /** A limited skin whose window has not started. */
  | { kind: 'limited_soon'; from: string }
  /** A limited skin whose window has passed: it can no longer be collected. */
  | { kind: 'limited_ended' };

export function skinState(skin: Skin, owned: ReadonlySet<string>, today: string, candies = 0): SkinState {
  if (skin.kind === 'starter' || owned.has(skin.id)) return { kind: 'owned' };
  if (skin.kind === 'mission') return { kind: 'locked' };
  const w = skin.window!;
  if (today < w.from) return { kind: 'limited_soon', from: w.from };
  if (today > w.to) return { kind: 'limited_ended' };
  if (skin.candies) return { kind: 'candy', need: skin.candies, have: Math.min(candies, skin.candies), until: w.to };
  return { kind: 'limited_open', until: w.to };
}

/** Limited skins that opening the app today gives (the free ones, and the candy ones with enough candies). */
export function limitedOpenToday(today: string, candies = 0): SkinId[] {
  return SKINS.filter((s) => s.kind === 'limited' && s.window && today >= s.window.from && today <= s.window.to && (s.candies ?? 0) <= candies).map(
    (s) => s.id,
  );
}

/** "10–16 เม.ย. 2569" or "25 ธ.ค. 2569 – 5 ม.ค. 2570". */
export function formatWindow(w: { from: string; to: string }): string {
  if (w.from.slice(0, 7) === w.to.slice(0, 7)) return `${Number(w.from.slice(8, 10))}–${formatThaiDay(w.to)}`;
  const sameYear = w.from.slice(0, 4) === w.to.slice(0, 4);
  return `${formatThaiDay(w.from, { year: !sameYear })} – ${formatThaiDay(w.to)}`;
}

/** Short status line for a skin card (the mission's own progress is shown separately). */
export function skinStatusLine(skin: Skin, state: SkinState): string {
  switch (state.kind) {
    case 'owned':
      return skin.kind === 'limited' ? 'สกินลิมิเต็ด · มีแล้ว' : 'มีแล้ว';
    case 'locked':
      return 'ทำภารกิจเพื่อปลดล็อก';
    case 'limited_open':
      return `สกินลิมิเต็ด · รับฟรีเมื่อเปิดแอปถึง ${formatThaiDay(state.until)}`;
    case 'candy':
      return `สกินลิมิเต็ดฮาโลวีน · สะสมลูกอม ${state.need} เม็ดภายใน ${formatThaiDay(state.until)} (มี ${state.have})`;
    case 'limited_soon':
      return `สกินลิมิเต็ด · เร็ว ๆ นี้ เปิดแอปช่วง ${formatWindow(skin.window!)} เพื่อรับ`;
    case 'limited_ended':
      return `สกินลิมิเต็ด · หมดเวลาแล้ว หาไม่ได้อีก (แจกช่วง ${formatWindow(skin.window!)})`;
  }
}

/** The skin to draw: the chosen one if the user owns it, otherwise the starter look. */
export function wearable(equipped: string | null | undefined, owned: ReadonlySet<string>): SkinId {
  return isSkinId(equipped) && (equipped === DEFAULT_SKIN || owned.has(equipped)) ? equipped : DEFAULT_SKIN;
}
