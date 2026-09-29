/**
 * How น้องกล้า talks as the coach: what it says on its own, how a long answer
 * is cut into short subtitles (each one spoken in turn), how text is made easy
 * for the phone's Thai voice to read, and how long a subtitle stays when the
 * phone cannot speak. Unit tests: __tests__/klaTalk.test.ts.
 */
import { BUDDY_NAME } from './buddy';

export const KLA_GREETING = `สวัสดี ${BUDDY_NAME}เองนะ ถามเรื่องเงินได้ทุกเรื่องเลย เช่น สัปดาห์นี้ใช้ไปกับอะไรเยอะสุด หรือของชิ้นนี้ซื้อได้ไหม`;
/** The greeting in the Halloween theme. */
export const KLA_GREETING_HALLOWEEN = `บู้! ตกใจไหม ${BUDDY_NAME}เองนะ ถามเรื่องเงินได้ทุกเรื่องเลย ฮาโลวีนนี้อย่าให้ค่าขนมมาหลอกหลอนกระเป๋าเงินนะ`;
export const KLA_THINKING =`${BUDDY_NAME}กำลังดูตัวเลขของคุณ…`;
export const KLA_AFTER = `อ่านคำตอบเต็มได้ด้านล่าง สงสัยอะไรอีก ถาม${BUDDY_NAME}ต่อได้เลยนะ`;

/** A subtitle this long or longer is not repeated whole in the bubble after it is said. */
export const REPEAT_MAX = 110;

/**
 * Text as the Thai voice should read it: no emoji, "฿1,290" as "1290 บาท",
 * "%" as "เปอร์เซ็นต์", no thousands commas, the minus sign as "ลบ".
 */
export function speakable(text: string): string {
  return text
    // Emoji and their joiners (explicit ranges: works on every JavaScript engine).
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, '')
    .replace(/([+−-])?฿\s?(\d[\d,]*(?:\.\d+)?)/g, (_m, sign: string | undefined, n: string) => `${sign === '−' || sign === '-' ? 'ลบ ' : ''}${n} บาท`)
    .replace(/฿/g, 'บาท')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/(\d)\s?%/g, '$1 เปอร์เซ็นต์')
    .replace(/−\s?(\d)/g, 'ลบ $1')
    .replace(/[·•]/g, ', ')
    .replace(/[“”"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Thai words that start a new thought ("for example", "but", "if", "or"…). */
const LEADS = new Set(['เช่น', 'แต่', 'ถ้า', 'หรือ', 'และ', 'เพราะ', 'แล้ว', 'ส่วน', 'ซึ่ง', 'ดังนั้น', 'ลอง', 'ถึง']);

/**
 * Cut an answer into subtitles of about `max` characters, at spaces (Thai uses
 * a space where a sentence or phrase ends) and at line breaks, never inside a word.
 */
export function talkChunks(text: string, max = 64, min = 24): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      if (!cur) {
        cur = w;
        continue;
      }
      const joined = `${cur} ${w}`;
      if (joined.length > max && cur.length >= Math.min(min, max)) {
        // Words such as "เช่น" or "แต่" begin the next thought: move them to the next subtitle.
        const cut = cur.lastIndexOf(' ');
        const last = cut > 0 ? cur.slice(cut + 1) : '';
        if (last && LEADS.has(last) && cut >= Math.min(min, max) / 2) {
          out.push(cur.slice(0, cut));
          cur = `${last} ${w}`;
        } else {
          out.push(cur);
          cur = w;
        }
      } else if (joined.length > max * 1.6) {
        // A very long run without spaces: keep pieces readable anyway.
        out.push(cur);
        cur = w;
      } else {
        cur = joined;
        // End a subtitle after a full stop or question mark once it is long enough.
        if (/[.!?…]$/.test(w) && cur.length >= min) {
          out.push(cur);
          cur = '';
        }
      }
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [text.trim()].filter(Boolean);
}

/** How long a subtitle stays when it is not spoken aloud (reading time), in ms. */
export function talkMs(chunk: string): number {
  return Math.min(9000, Math.max(1400, 420 + chunk.length * 72));
}
