/**
 * The price in a question to the coach ("ซื้อรองเท้า 1,290 ได้ไหม"), so the app can add a
 * "what if I buy it" check to what it sends. Other numbers ("อีก 30 วัน", "ซื้อ 2 ชิ้น") are
 * not prices. Unit tests: __tests__/audit.test.ts (TC-89).
 */
import { parseBahtToSatang } from './money';

const NUM = '((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)';
/** Words after a number that make it a count or a time, not money. */
const NOT_MONEY = '(?![\\d.,]|\\s*(?:วัน|เดือน|ปี|ชิ้น|อัน|คน|ครั้ง|โมง|นาที|ชั่วโมง|%|เปอร์))';
/** The question is about buying or paying. */
const BUYING = /ซื้อ|ราคา|จ่าย|คุ้ม|แพง|ผ่อน|ได้ไหม|ดีไหม|ไหวไหม/;

const PRICE_PATTERNS = [
  new RegExp(`฿\\s?${NUM}`),
  new RegExp(`${NUM}\\s*บาท`),
  // "ซื้อรองเท้า 1290 ได้ไหม"
  new RegExp(`(?:ซื้อ|ราคา|จ่าย)[^\\d]{0,24}?${NUM}${NOT_MONEY}`),
];
/** Last try, for buying questions only: a number of 3+ digits ("หูฟัง 1,990 คุ้มไหม", "มือถือ 15000 ควรซื้อไหม"). */
const BIG_NUMBER = new RegExp(`(?:^|[^\\d.,])((?:\\d{1,3}(?:,\\d{3})+|\\d{3,})(?:\\.\\d{1,2})?)${NOT_MONEY}`);

export function priceInQuestion(q: string): number | null {
  for (const re of PRICE_PATTERNS) {
    const m = q.match(re);
    if (m) return parseBahtToSatang(m[1]);
  }
  if (!BUYING.test(q)) return null;
  const m = q.match(BIG_NUMBER);
  return m ? parseBahtToSatang(m[1]) : null;
}
