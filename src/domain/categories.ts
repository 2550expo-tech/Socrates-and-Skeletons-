/**
 * Categories (FR-1 "จัดหมวด"). Fixed list for the MVP so reports stay comparable.
 * `keywords` let the app suggest a category from a slip's counterparty name.
 */
import type { TxKind } from './types';

export interface Category {
  key: string;
  kind: TxKind;
  label: string;
  /** Single glyph used as the category icon in lists and charts. */
  glyph: string;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  { key: 'food', kind: 'expense', label: 'อาหารและเครื่องดื่ม', glyph: '🍜',
    keywords: ['ร้าน', 'ข้าว', 'กาแฟ', 'cafe', 'café', 'coffee', 'อาหาร', 'ก๋วยเตี๋ยว', 'ชานม', 'ชาไข่มุก', 'mk restaurant', 'สุกี้', 'kfc', 'mcdonald', 'starbucks', 'amazon', 'food', 'grabfood', 'lineman', 'foodpanda', 'บุฟเฟ่ต์'] },
  { key: 'transport', kind: 'expense', label: 'เดินทาง', glyph: '🚌',
    keywords: ['bts', 'mrt', 'grab', 'bolt', 'taxi', 'แท็กซี่', 'วิน', 'ปตท', 'ptt', 'shell', 'bangchak', 'บางจาก', 'ค่ารถ', 'ทางด่วน', 'easy pass'] },
  { key: 'shopping', kind: 'expense', label: 'ช้อปปิ้ง', glyph: '🛍️',
    keywords: ['shopee', 'lazada', 'central', 'uniqlo', 'lotus', 'big c', 'bigc', 'makro', 'watsons', 'boots', 'ikea', 'tiktok shop'] },
  { key: 'convenience', kind: 'expense', label: 'ร้านสะดวกซื้อ', glyph: '🏪',
    keywords: ['7-eleven', '7eleven', 'เซเว่น', 'cp all', 'family mart', 'familymart', 'lawson', 'tops daily', 'mini big c'] },
  { key: 'bills', kind: 'expense', label: 'บิลและค่าที่พัก', glyph: '🧾',
    keywords: ['ค่าไฟ', 'การไฟฟ้า', 'ประปา', 'true', 'ais', 'dtac', '3bb', 'หอพัก', 'ค่าเช่า', 'rent', 'internet'] },
  { key: 'fun', kind: 'expense', label: 'บันเทิง', glyph: '🎬',
    keywords: ['major', 'sf cinema', 'netflix', 'spotify', 'youtube', 'steam', 'game', 'เกม', 'คอนเสิร์ต', 'ticket'] },
  { key: 'study', kind: 'expense', label: 'การเรียน', glyph: '📚',
    keywords: ['มหาวิทยาลัย', 'university', 'book', 'หนังสือ', 'se-ed', 'ศึกษา', 'ค่าเทอม', 'ถ่ายเอกสาร'] },
  { key: 'health', kind: 'expense', label: 'สุขภาพ', glyph: '💊',
    keywords: ['โรงพยาบาล', 'hospital', 'คลินิก', 'clinic', 'ร้านยา', 'pharmacy', 'fitness', 'ฟิตเนส'] },
  { key: 'transfer_out', kind: 'expense', label: 'โอนให้คนอื่น', glyph: '↗︎',
    keywords: ['นาย', 'นาง', 'น.ส.', 'นางสาว', 'mr.', 'ms.', 'mrs.'] },
  { key: 'other_expense', kind: 'expense', label: 'อื่น ๆ', glyph: '•', keywords: [] },

  { key: 'allowance', kind: 'income', label: 'เงินจากที่บ้าน', glyph: '🏠', keywords: ['พ่อ', 'แม่', 'ค่าขนม'] },
  { key: 'salary', kind: 'income', label: 'เงินเดือน / ค่าจ้าง', glyph: '💼', keywords: ['เงินเดือน', 'salary', 'payroll', 'ค่าจ้าง'] },
  { key: 'part_time', kind: 'income', label: 'งานพิเศษ', glyph: '✨', keywords: ['freelance', 'ฟรีแลนซ์', 'พาร์ทไทม์'] },
  { key: 'transfer_in', kind: 'income', label: 'รับโอน', glyph: '↙︎', keywords: [] },
  { key: 'other_income', kind: 'income', label: 'รายรับอื่น ๆ', glyph: '•', keywords: [] },
];

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

export function getCategory(key: string): Category {
  return BY_KEY.get(key) ?? BY_KEY.get('other_expense')!;
}

export function categoriesFor(kind: TxKind): Category[] {
  return CATEGORIES.filter((c) => c.kind === kind);
}

export function defaultCategory(kind: TxKind): string {
  return kind === 'income' ? 'transfer_in' : 'other_expense';
}

/** A slip counterparty that is a person ("นาย สมชาย", "MR. JOHN"). */
const PERSON_TITLE = /^\s*(?:นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?|miss)(?:\s|$)/i;

/**
 * Where a keyword matches and how long it is (null = no match).
 * - Latin keywords must start a word: "ais" is not in "PAISAN", "rent" is not in "LAURENT"; brands
 *   written together still match ("GRABPAY", "SHOPEEPAY", "TRUEMOVE", "CENTRALWORLD").
 * - After a person title, short keywords are skipped: "วิน" is not in "นาย วินัย", "ais" not in
 *   "MS AISHA". (Thai has no spaces between words, so keywords are substrings; a unit test,
 *   TC-25, guards against short words like "ชา" matching the name "สมชาย".)
 */
function findKeyword(text: string, keyword: string, person: boolean): { at: number; len: number } | null {
  if (person && keyword.length < 5) return null;
  if (/^[a-z0-9 .&'-]+$/.test(keyword)) {
    const re = new RegExp(`(^|[^a-z])(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`);
    const m = re.exec(text);
    return m ? { at: m.index + m[1].length, len: keyword.length } : null;
  }
  const at = text.indexOf(keyword);
  return at < 0 ? null : { at, len: keyword.length };
}

/**
 * Suggest a category from free text (a slip's counterparty or a title). The keyword that comes
 * first wins ("KFC Central" is food), and the longer one where two start together ("ร้านยา" is
 * health, not the "ร้าน" of food; "mini big c" is convenience, not the "big c" of shopping).
 * Specific shops win over the generic "person" rule, so "ร้านข้าว นายสมชาย" becomes food, not a
 * transfer to a person.
 */
export function suggestCategory(text: string | null | undefined, kind: TxKind): string {
  if (!text) return defaultCategory(kind);
  const t = text.toLowerCase();
  const person = PERSON_TITLE.test(t);
  let best: string | null = null;
  let bestAt = Infinity;
  let bestLen = 0;
  for (const c of categoriesFor(kind)) {
    if (c.key === 'transfer_out') continue;
    for (const k of c.keywords) {
      const m = findKeyword(t, k, person);
      if (m && (m.at < bestAt || (m.at === bestAt && m.len > bestLen))) {
        best = c.key;
        bestAt = m.at;
        bestLen = m.len;
      }
    }
  }
  if (best) return best;
  if (kind === 'expense') {
    const persons = BY_KEY.get('transfer_out')!;
    if (person || persons.keywords.some((k) => t.includes(k))) return persons.key;
  }
  return defaultCategory(kind);
}
