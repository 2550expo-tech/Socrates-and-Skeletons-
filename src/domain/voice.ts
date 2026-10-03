/**
 * "พูดจด": turn what the user says (or types the way they would say it) into
 * transactions. Pure functions, unit-tested in __tests__/voice.test.ts.
 *
 *   "ข้าว 50 บาท"                  -> ข้าว ฿50 (อาหาร)
 *   "ข้าวห้าสิบ น้ำสิบห้า"           -> ข้าว ฿50, น้ำ ฿15
 *   "ได้เงินจากแม่ 500"             -> เงินจากแม่ +฿500 (รายรับ, เงินจากที่บ้าน)
 *   "เมื่อวาน ค่ารถ 40"             -> ค่ารถ ฿40, yesterday
 *   "ข้าว 2 จาน 100 บาท"            -> ข้าว 2 จาน ฿100 (2 is a quantity, not money)
 *
 * Speech recognizers usually write numbers as digits ("50"), but Thai number
 * words ("ห้าสิบ", "สองพันห้า", "ร้อยครึ่ง") are understood too.
 */
import { categoriesFor, getCategory, suggestCategory } from './categories';
import type { TxKind } from './types';

export interface SpokenItem {
  title: string;
  amountSatang: number;
  kind: TxKind;
  categoryKey: string;
  /** 0 = today, -1 = yesterday, -2 = the day before. */
  dayOffset: number;
}

export interface SpokenEntry {
  items: SpokenItem[];
  /** The text as understood (numbers as digits), shown back to the user. */
  heard: string;
}

// ---------------------------------------------------------------------------
// Thai number words
// ---------------------------------------------------------------------------

const DIGIT_WORDS: Record<string, number> = {
  ศูนย์: 0, หนึ่ง: 1, นึง: 1, เอ็ด: 1, สอง: 2, ยี่: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9,
};
const MULTIPLIERS: Record<string, number> = { สิบ: 10, ร้อย: 100, พัน: 1000, หมื่น: 10000, แสน: 100000, ล้าน: 1000000 };
const NUMBER_WORD = 'ศูนย์|หนึ่ง|นึง|เอ็ด|สอง|ยี่|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน|ครึ่ง';
const NUMBER_WORDS_RE = new RegExp(`(?:${NUMBER_WORD})+`, 'g');

/**
 * "ห้าสิบ" -> 50, "ยี่สิบห้า" -> 25, "หนึ่งร้อยห้า" -> 105, "ร้อยห้า" -> 150 (spoken short form),
 * "สองพันห้า" -> 2500, "ร้อยครึ่ง" -> 150, "พันนึง" -> 1000, "ร้อยหนึ่ง" -> 101, "ยี่สิบนึง" -> 21.
 * Returns null when it is not a number.
 */
export function thaiNumberWords(words: string): number | null {
  const tokens = words.match(new RegExp(NUMBER_WORD, 'g'));
  if (!tokens || tokens.join('') !== words) return null;
  let total = 0;
  let millions = 0;
  let digit: number | null = null;
  let lastMultiplier = 0;
  let startsWithDigit = false;
  let digitRightAfterMultiplier = false;
  let digitWord = '';
  tokens.forEach((tok, i) => {
    if (tok in DIGIT_WORDS) {
      // "นึง" right after ร้อย or more means "one of it" ("ร้อยนึง" = 100), not another digit
      // (after สิบ it is a digit: "ยี่สิบนึง" = 21).
      if (tok === 'นึง' && lastMultiplier >= 100 && i === tokens.length - 1) return;
      digit = DIGIT_WORDS[tok];
      digitWord = tok;
      if (i === 0) startsWithDigit = true;
      digitRightAfterMultiplier = i > 0 && tokens[i - 1] in MULTIPLIERS;
    } else if (tok === 'ครึ่ง') {
      total += lastMultiplier ? lastMultiplier / 2 : 0;
    } else if (tok === 'ล้าน') {
      millions = (total + (digit ?? (total ? 0 : 1))) * 1_000_000;
      total = 0;
      digit = null;
      lastMultiplier = 0;
    } else {
      const m = MULTIPLIERS[tok];
      total += (digit ?? 1) * m;
      digit = null;
      lastMultiplier = m;
    }
  });
  if (digit !== null) {
    // Spoken short form: "สองพันห้า" = 2,500 and "ร้อยห้า" = 150 (but "หนึ่งร้อยห้า" = 105).
    // "เอ็ด" is always the units digit ("ร้อยเอ็ด" = 101), and so is "หนึ่ง" after ร้อย ("ร้อยหนึ่ง" = 101);
    // after พัน or more it is the short form like any digit ("สองพันหนึ่ง" = 2,100).
    const one = digitWord === 'เอ็ด' || digitWord === 'นึง' || (digitWord === 'หนึ่ง' && lastMultiplier === 100);
    const short = !one && digitRightAfterMultiplier && (lastMultiplier >= 1000 || (lastMultiplier === 100 && !startsWithDigit));
    total += short ? digit * (lastMultiplier / 10) : digit;
  }
  return millions + total;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** Words after a number that make it a quantity, not money ("ข้าว 2 จาน"). */
const UNIT = 'จาน|แก้ว|ขวด|ชิ้น|อัน|ห่อ|ถุง|กล่อง|ลูก|คน|ที่|ตัว|คู่|เล่ม|ใบ|ครั้ง|โมง|นาที|ชั่วโมง|วัน|เดือน|ปี|กิโล|กก\\.?|ลิตร|ชาม|ถ้วย|เม็ด|แผ่น|ซอง|แพ็ค|หลอด|คัน|รอบ';
const INCOME_WORDS = ['ได้เงิน', 'ได้รับ', 'รับเงิน', 'เงินเข้า', 'เงินเดือน', 'ค่าจ้าง', 'แม่ให้', 'พ่อให้', 'โอนมาให้', 'โอนเข้า', 'รายรับ', 'รายได้', 'ขายของได้', 'ได้ค่าขนม', 'ได้ค่า', 'ได้เงินคืน', 'เงินคืน', 'คืนเงิน'];
/**
 * Paying words, when they come before any income word: "จ่ายค่าจ้างช่างแอร์" is spending, but
 * "แม่ให้เงินซื้อขนม" is still money in. "คืนเงิน" pays back only at the start ("คืนเงินเพื่อน");
 * after someone's name it is money coming back ("เพื่อนคืนเงิน").
 */
const PAYING = /^(?:คืนเงิน)|จ่าย|ซื้อ|โอนให้|โอนไป/;

function isIncome(text: string): boolean {
  const t = text.trim().replace(CONNECTORS, '');
  const incomeAt = Math.min(...INCOME_WORDS.map((w) => t.indexOf(w)).filter((i) => i >= 0), Infinity);
  if (incomeAt === Infinity) return false;
  const pay = PAYING.exec(t);
  return !pay || pay.index > incomeAt;
}
// "กับข้าว" (side dishes) and "ต่อเติม" are words, not "and" + something.
const CONNECTORS = /^(?:และ|กับ(?!ข้าว|แกล้ม)|แล้วก็|แล้ว|ก็|อีก|ต่อ(?!เติม|ภาษี|ทะเบียน)|,|\+)+\s*/;
/**
 * Polite endings at the end of a word ("บาทครับ"); a lone "นะ" only as its own word (so "ชนะ" stays).
 * Not after a leading vowel, where the letters belong to a word: "ข้าวเจ้า" keeps its "จ้า".
 */
const POLITE = /(^|[^เแโใไ])(?:นะคะ|นะครับ|ครับผม|ครับ|คับ|ค่ะ|คะ|จ้ะ|จ้า)(?=\s|$)/g;
const LONE_NA = /\sนะ(?=\s|$)/g;

/** Spoken things and their category (longest match wins: "ค่าน้ำ" is a bill, "น้ำ" is a drink). */
const SPOKEN_CATEGORY: [string, string][] = [
  ['น้ำมัน', 'transport'], ['ค่ารถ', 'transport'], ['รถเมล์', 'transport'], ['วินมอไซค์', 'transport'], ['มอไซค์', 'transport'],
  ['แท็กซี่', 'transport'], ['รถไฟ', 'transport'], ['ค่าทางด่วน', 'transport'], ['เรือ', 'transport'],
  ['ข้าว', 'food'], ['น้ำ', 'food'], ['ขนม', 'food'], ['กาแฟ', 'food'], ['ชานม', 'food'], ['ชาเย็น', 'food'], ['หมูกระทะ', 'food'],
  ['ก๋วยเตี๋ยว', 'food'], ['ส้มตำ', 'food'], ['ไก่', 'food'], ['ผลไม้', 'food'], ['ไอติม', 'food'], ['ไอศกรีม', 'food'],
  ['บะหมี่', 'food'], ['มาม่า', 'food'], ['อาหาร', 'food'], ['มื้อ', 'food'], ['ข้าวเที่ยง', 'food'], ['ข้าวเย็น', 'food'],
  ['เซเว่น', 'convenience'], ['ร้านสะดวกซื้อ', 'convenience'],
  ['เสื้อ', 'shopping'], ['รองเท้า', 'shopping'], ['กางเกง', 'shopping'], ['กระเป๋า', 'shopping'], ['ของใช้', 'shopping'], ['เครื่องสำอาง', 'shopping'],
  ['ค่าหอ', 'bills'], ['ค่าเช่า', 'bills'], ['ค่าไฟ', 'bills'], ['ค่าน้ำ', 'bills'], ['ค่าเน็ต', 'bills'], ['ค่าโทรศัพท์', 'bills'], ['เติมเงินโทรศัพท์', 'bills'], ['ค่ามือถือ', 'bills'],
  ['หนัง', 'fun'], ['เกม', 'fun'], ['คอนเสิร์ต', 'fun'], ['คาราโอเกะ', 'fun'],
  ['หนังสือ', 'study'], ['ค่าเทอม', 'study'], ['ถ่ายเอกสาร', 'study'], ['ปริ้น', 'study'], ['เครื่องเขียน', 'study'],
  ['ค่ายา', 'health'], ['ร้านยา', 'health'], ['หาหมอ', 'health'], ['คลินิก', 'health'], ['ฟิตเนส', 'health'],
  ['เงินเดือน', 'salary'], ['ค่าจ้าง', 'salary'], ['ค่าขนม', 'allowance'], ['แม่', 'allowance'], ['พ่อ', 'allowance'], ['ที่บ้าน', 'allowance'],
  ['ฟรีแลนซ์', 'part_time'], ['พาร์ทไทม์', 'part_time'], ['ขายของ', 'part_time'],
].sort((a, b) => b[0].length - a[0].length) as [string, string][];

export function spokenCategory(title: string, kind: TxKind): string {
  const allowed = new Set(categoriesFor(kind).map((c) => c.key));
  for (const [word, key] of SPOKEN_CATEGORY) {
    if (allowed.has(key) && title.includes(word)) return key;
  }
  return suggestCategory(title, kind);
}

function cleanTitle(raw: string, kind: TxKind): string {
  let t = raw.trim().replace(CONNECTORS, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(?:ซื้อ|จ่ายเงิน|จ่าย(?=ค่า)|จ่าย|กิน|เติม(?!เงิน))\s*/, '');
  if (kind === 'income') t = t.replace(/^ได้เงินคืน/, 'เงินคืน').replace(/^(?:ได้รับ|ได้เงิน|ได้|รับ)\s*/, '').replace(/^จาก/, 'เงินจาก');
  t = t.replace(/\s*(?:บาท|บ\.)$/, '').trim();
  return t;
}

// ---------------------------------------------------------------------------
// Whole sentence
// ---------------------------------------------------------------------------

const DIGIT_NAMES = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
/** Day words become these markers while parsing, so each item keeps its own day. */
const DAY_MARK = { '-2': ' §วานซืน§ ', '-1': ' §วาน§ ', '0': ' §วันนี้§ ' } as const;
const DAY_MARK_RE = /§(วานซืน|วาน|วันนี้)§/g;
const markOffset = (m: string) => (m === 'วานซืน' ? -2 : m === 'วาน' ? -1 : 0);

function normalizeMarked(text: string): string {
  let t = ` ${text} `
    .replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)))
    .toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/(\d)\.(?!\d)/g, '$1 ')
    .replace(/[!?,]/g, ' ')
    .replace(/฿\s*(\d)/g, '$1')
    .replace(/(\d)\s*฿/g, '$1 บาท ')
    // 7-Eleven, but never the "711" inside an amount ("ค่าไฟ 711", "1711").
    // "7 11" or "711" only when an amount follows (or the text ends): "ค่าไฟ 711 บาท" stays ฿711.
    .replace(
      /(^|[^\d.,])7\s*-\s*11(?!\d)|(^|[^\d.,])7\s*-?\s*eleven|(^|[^\d.,])7\s?11(?=\s+\d|\s*$)/g,
      (_, a?: string, b?: string, c?: string) => `${a ?? b ?? c ?? ''}เซเว่น`,
    )
    .replace(/เซเว่นอีเลฟเว่น|เซเว่น/g, 'เซเว่น')
    .replace(POLITE, '$1 ')
    .replace(LONE_NA, ' ');
  t = t
    .replace(/เมื่อวานซืน/g, DAY_MARK['-2'])
    .replace(/เมื่อวานนี้|เมื่อวาน/g, DAY_MARK['-1'])
    .replace(/วันนี้|ตอนนี้/g, DAY_MARK['0']);
  // "2k", "2 เค" -> 2000
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:k|เค)(?=\s|$|บาท)/g, (_, n: string) => String(Math.round(Number(n) * 1000)));
  // One digit before a multiplier joins the number words after it: "2 พันห้า" = สองพันห้า = 2,500,
  // "5 ร้อยห้าสิบ" = 550.
  t = t.replace(/(^|[^\d.])(\d)\s*(?=สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน)/g, (_, pre: string, d: string) => `${pre}${DIGIT_NAMES[Number(d)]}`);
  // "สามพัน สองร้อย" is one number when the second part is smaller: 3,200.
  t = t.replace(
    new RegExp(`(สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน)\\s+(?=(?:${Object.keys(DIGIT_WORDS).join('|')})(สิบ|ร้อย|พัน|หมื่น|แสน))`, 'g'),
    (m, a: string, next: string) => (MULTIPLIERS[next] < MULTIPLIERS[a] ? a : m),
  );
  // "15 ร้อย", "1.5 พัน", "2 พันครึ่ง" -> digits
  t = t.replace(/(\d+(?:\.\d+)?)\s*(สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน)(\s*ครึ่ง)?/g, (_, n: string, w: string, half?: string) => {
    const m = MULTIPLIERS[w];
    return ` ${Math.round(Number(n) * m + (half ? m / 2 : 0))} `;
  });
  // Thai number words become digits only when they are clearly a number: on their own, followed by
  // "บาท", or a multi-part number at the end of a word ("ข้าวห้าสิบ"). So "ห้าง" or "สี่แยก" stay words.
  t = t.replace(NUMBER_WORDS_RE, (words, offset: number, whole: string) => {
    const before = whole[offset - 1] ?? ' ';
    const after = whole.slice(offset + words.length);
    const endsHere = /^(?:\s|$)/.test(after);
    const alone = /\s/.test(before) && endsHere;
    const money = /^\s*(?:บาท|บ\.)/.test(after);
    const n = thaiNumberWords(words);
    if (n === null || n === 0) return words;
    const multiPart = (words.match(new RegExp(NUMBER_WORD, 'g')) ?? []).length >= 2;
    if (!alone && !money && !(endsHere && multiPart)) return words;
    return ` ${n} `;
  });
  return t.replace(/\s+/g, ' ').trim();
}

/** Numbers as digits: Thai digits, number words, "5 ร้อย", "2k", "1,250". dayOffset = the first day word said. */
export function normalizeSpoken(text: string): { text: string; dayOffset: number } {
  const marked = normalizeMarked(text);
  const first = marked.match(/§(วานซืน|วาน|วันนี้)§/);
  return { text: marked.replace(DAY_MARK_RE, ' ').replace(/\s+/g, ' ').trim(), dayOffset: first ? markOffset(first[1]) : 0 };
}

/** Understand one spoken (or typed) sentence. Items with no amount are left out. */
export function parseSpokenEntry(input: string): SpokenEntry {
  const text = normalizeMarked(input);
  const marks = [...text.matchAll(DAY_MARK_RE)].map((m) => ({ at: m.index ?? 0, offset: markOffset(m[1]) }));
  // A number, whole (never part of a longer one), not followed by a unit word ("2 จาน").
  const amountRe = new RegExp(`(\\d+(?:\\.\\d{1,2})?)(?![\\d.])(?!\\s*(?:${UNIT})(?![ก-๙]))(?:\\s*(?:บาท|บ\\.))?(?:\\s*(\\d{1,2})\\s*สตางค์)?`, 'g');
  const found: { start: number; end: number; satang: number }[] = [];
  for (const m of text.matchAll(amountRe)) {
    // A number glued to latin letters or following another digit is not an amount on its own.
    const prev = text[(m.index ?? 0) - 1];
    if (prev && /[a-z0-9.]/.test(prev)) continue;
    const baht = Number(m[1]);
    const satang = Math.round(baht * 100) + (m[2] ? Number(m[2]) : 0);
    if (satang <= 0 || satang >= 1_000_000_000) continue;
    found.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, satang });
  }
  const bare = (s: string) => s.replace(DAY_MARK_RE, ' ').trim().replace(CONNECTORS, '').trim();
  // Amounts said first ("50 บาท ค่าข้าว 30 บาท ค่าน้ำ"): every title comes after its amount.
  const amountFirst = found.length > 0 && !bare(text.slice(0, found[0].start));
  const items: SpokenItem[] = [];
  found.forEach((f, i) => {
    let title = amountFirst
      ? text.slice(f.end, found[i + 1]?.start ?? text.length)
      : text.slice(i === 0 ? 0 : found[i - 1].end, f.start);
    // Only the last amount has nothing before it ("ข้าว 50 บาท 30 ค่าน้ำ"): take the words after it.
    if (!amountFirst && !bare(title) && i === found.length - 1) title = text.slice(f.end);
    title = title.replace(DAY_MARK_RE, ' ');
    const lower = title.toLowerCase();
    const kind: TxKind = isIncome(lower) ? 'income' : 'expense';
    const clean = cleanTitle(title, kind);
    const categoryKey = spokenCategory(clean, kind);
    // The day said last before this item's amount; if none was said before it, the first one said.
    const before = marks.filter((m) => m.at < f.end).pop();
    items.push({
      title: clean || getCategory(categoryKey).label,
      amountSatang: f.satang,
      kind,
      categoryKey,
      dayOffset: before?.offset ?? marks[0]?.offset ?? 0,
    });
  });
  return { items, heard: text.replace(DAY_MARK_RE, ' ').replace(/\s+/g, ' ').trim() };
}
