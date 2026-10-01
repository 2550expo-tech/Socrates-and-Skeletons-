// FR-4: read one Thai bank or e-wallet slip image and return structured fields.
//
// Accuracy: every slip is read twice, at the same time, by two different AI
// models that do not see each other's answer (_shared/helpers.ts
// mergeReadings). Where they agree the value is kept; where they disagree on the
// amount, date, direction or who was paid, the slip waits for the user with
// both values to choose from. A slip that could be read only once is never
// counted without a look. The app then checks the reading against the slip's
// QR code (bank and reference) on the phone.
//
// Privacy: the image is used only for this request. It is not written to the
// database or to storage, and only images that already looked like slips on
// the phone are sent here. The AI service (Claude or Gemini, see
// _shared/common.ts) receives the image to read it.
import { aiProvider, BusyError, callAIWithModel, corsHeaders, envLimit, fail, json, NotConfiguredError, requireUser, takeQuota } from '../_shared/common.ts';
import { mergeReadings, normalizeReading, parseJsonText, type SlipReadingOut } from '../_shared/helpers.ts';

const DAILY_LIMIT = envLimit('SLIP_DAILY_LIMIT', 300);
const MAX_BASE64_CHARS = 6_000_000; // about 4.5 MB of image
/** Checked before the body is read, so a huge upload is refused without filling memory. */
const MAX_BODY_BYTES = MAX_BASE64_CHARS + 100_000;

const nullableString = { type: ['string', 'null'] };

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'isSlip', 'direction', 'amount', 'amountPrinted', 'fee', 'dateText', 'dateIso', 'time',
    'fromName', 'toName', 'counterparty', 'bank', 'reference', 'confidence',
  ],
  properties: {
    isSlip: { type: 'boolean' },
    direction: { type: 'string', enum: ['expense', 'income', 'unknown'] },
    amount: nullableString,
    amountPrinted: nullableString,
    fee: nullableString,
    dateText: nullableString,
    dateIso: nullableString,
    time: nullableString,
    fromName: nullableString,
    toName: nullableString,
    counterparty: nullableString,
    bank: nullableString,
    reference: nullableString,
    confidence: {
      type: 'object',
      additionalProperties: false,
      required: ['amount', 'date', 'counterparty'],
      properties: {
        amount: { type: 'number' },
        date: { type: 'number' },
        counterparty: { type: 'number' },
      },
    },
  },
};

const SYSTEM = `You read images from a Thai user's phone gallery and extract transfer / payment slip data for a personal finance app. Accuracy matters more than anything: a wrong amount or date is worse than no answer.

Return JSON only, matching the schema.

isSlip is true only for a COMPLETED transfer, payment, top-up or withdrawal confirmation made by any Thai bank or e-wallet app, for example: K PLUS or MAKE by KBank (Kasikorn), SCB EASY, Krungthai NEXT or เป๋าตัง, Bualuang mBanking (Bangkok Bank), KMA (Krungsri), ttb touch, MyMo (GSB ออมสิน), BAAC A-Mobile (ธ.ก.ส.), UOB TMRW, CIMB THAI, KKP Mobile, LH Bank, TISCO, GHB (ธอส.), ICBC, Thai Credit, LINE BK, TrueMoney Wallet, ShopeePay, Rabbit LINE Pay, dime!, including PromptPay (พร้อมเพย์) transfers and bill payments. Typical words: "โอนเงินสำเร็จ", "ชำระเงินสำเร็จ", "ทำรายการสำเร็จ", "รายการสำเร็จ", "เติมเงินสำเร็จ", "จ่ายบิลสำเร็จ", "Transfer successful", "Payment successful", "Completed".
isSlip is false for: chats, bills or invoices not yet paid, a QR code to pay (PromptPay QR), balance screens, statements with many rows, failed or pending transfers ("ไม่สำเร็จ", "รอดำเนินการ", "Failed"), and any other photo. When false, set every other string to null, direction "unknown" and all confidences 0.

Fields:
- amount: the amount transferred or paid, digits with a dot for decimals (e.g. "1250.00"). It is labelled "จำนวนเงิน", "จำนวน", "ยอดเงิน", "ยอดชำระ", "Amount", or printed large in the middle. Never the fee ("ค่าธรรมเนียม", "Fee"), never a balance ("ยอดเงินคงเหลือ", "ยอดคงเหลือ", "Balance"), never a reference, phone or account number.
- amountPrinted: the same amount exactly as printed, with its commas and decimals (e.g. "1,250.00"). It must be the same number as amount.
- fee: the fee as digits (e.g. "0.00") when printed, else null.
- dateText: the date exactly as printed (e.g. "27 ก.ย. 69", "27 Sep 2026", "27/09/2569").
- dateIso: that date as YYYY-MM-DD in the Gregorian calendar. Thai slips print Buddhist Era years: 2569 = 2026, and a 2-digit "69" means 2569 = 2026. English slips print Gregorian years. Thai months: ม.ค. 01, ก.พ. 02, มี.ค. 03, เม.ย. 04, พ.ค. 05, มิ.ย. 06, ก.ค. 07, ส.ค. 08, ก.ย. 09, ต.ค. 10, พ.ย. 11, ธ.ค. 12.
- time: HH:MM (24h) as printed ("14:05 น." gives "14:05"), or null.
- fromName: the payer as printed ("จาก", "From", "ผู้โอน"), usually at the top. toName: the receiver, shop or biller as printed ("ไปยัง", "ไปที่", "To", "ผู้รับ"). Keep masked parts as printed (e.g. "นาย สมชาย ใ***"). Never include account numbers.
- direction: "expense" for a slip that shows money sent or paid (the normal slip the payer's app makes); "income" only when the image itself says money was received ("ได้รับเงิน", "รับเงินสำเร็จ", "เงินเข้า", "You received"); otherwise "unknown".
- counterparty: for an expense the receiver (toName), for income the sender (fromName).
- bank: the bank or wallet app that made the slip, from its logo or name at the top, e.g. "KBank", "SCB", "Krungthai", "Bangkok Bank", "Krungsri", "ttb", "GSB", "BAAC", "UOB", "CIMB", "KKP", "LH Bank", "TrueMoney", "ShopeePay".
- reference: the transaction reference ("เลขที่รายการ", "รหัสอ้างอิง", "หมายเลขอ้างอิง", "Ref No.", "Transaction ID"), letters and digits only.
- confidence: for amount, date and counterparty, your certainty from 0 to 1 that the value is exactly right, character for character. Use below 0.8 if any character is blurred, cropped, covered, small, or could be read two ways (1 or 7, 3 or 8, 5 or 6, 0 or 8, comma or dot). Use 0 when the value is null.
- Never guess, and never compute a value that is not printed. If a field cannot be read, return null.`;

async function readOnce(variant: 'primary' | 'verify', image: string, mediaType: string): Promise<{ reading: SlipReadingOut; model: string }> {
  const { text, model } = await callAIWithModel({
    task: 'slip',
    variant,
    system: SYSTEM,
    maxTokens: 900,
    schema: SCHEMA,
    content: [
      { type: 'image', mediaType, data: image },
      { type: 'text', text: 'Extract the slip fields from this image.' },
    ],
  });
  return { reading: normalizeReading(parseJsonText(text)), model };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 'Use POST', 405);

  const userId = await requireUser(req);
  if (!userId) return fail('unauthorized', 'Sign in again', 401);

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fail('too_large', 'Image is too large', 413);
  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 'Body must be JSON', 400);
  }
  if (!body || typeof body !== 'object') return fail('bad_request', 'Body must be a JSON object', 400);
  const image = body.imageBase64;
  const mediaType = body.mediaType ?? 'image/jpeg';
  if (!image || typeof image !== 'string') return fail('bad_request', 'imageBase64 is required', 400);
  if (image.length > MAX_BASE64_CHARS) return fail('too_large', 'Image is too large', 413);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
    return fail('bad_request', 'Unsupported image type', 400);
  }

  if (!aiProvider()) return fail('not_configured', 'AI key is not set on the server', 503);

  try {
    if (!(await takeQuota(userId, 'slip', DAILY_LIMIT))) {
      return fail('quota', 'Daily slip limit reached, try again tomorrow', 429);
    }
    // Two independent reads at the same time (one slip = one use of the daily limit).
    const [first, second] = await Promise.allSettled([readOnce('primary', image, mediaType), readOnce('verify', image, mediaType)]);
    const a = first.status === 'fulfilled' ? first.value : null;
    const b = second.status === 'fulfilled' ? second.value : null;
    if (!a && !b) {
      const reasons = [first, second].map((r) => (r as PromiseRejectedResult).reason);
      throw reasons.find((r) => r instanceof NotConfiguredError) ?? reasons.find((r) => r instanceof BusyError) ?? reasons[0];
    }
    if (!a || !b) {
      const why = (!a ? first : second) as PromiseRejectedResult;
      console.warn(JSON.stringify({ slip: 'single_read', failed: !a ? 'primary' : 'verify', error: String(why.reason?.message ?? why.reason).slice(0, 200) }));
    }
    // Both reads by the same model (no separate verifier configured) are not independent.
    const sameModel = !!a && !!b && a.model === b.model;
    const { reading, check } = mergeReadings(a?.reading ?? null, b?.reading ?? null, { sameModel });
    console.log(JSON.stringify({ slip: 'checked', reads: check.reads, verified: check.verified, sameModel, disagree: Object.keys(check.disagree) }));
    return json({ reading, check });
  } catch (e) {
    if (e instanceof NotConfiguredError) {
      console.error('parse-slip: AI key missing or refused', e.message);
      return fail('not_configured', 'AI key is not set on the server or was refused', 503);
    }
    if (e instanceof BusyError) {
      console.warn('parse-slip: AI busy', e.message);
      return fail('busy', 'The AI service is busy, try again shortly', 503);
    }
    console.error('parse-slip failed', e);
    return fail('reader_error', 'Could not read this image', 502);
  }
});
