// FR-4: read one Thai bank slip image and return structured fields.
//
// Privacy: the image is used only for this request. It is not written to the
// database or to storage, and only images that already looked like slips on
// the phone are sent here. The AI service (Claude or Gemini, see
// _shared/common.ts) receives the image to read it.
import { aiProvider, BusyError, callAI, corsHeaders, fail, json, NotConfiguredError, requireUser, takeQuota } from '../_shared/common.ts';
import { normalizeReading, parseJsonText } from '../_shared/helpers.ts';

const DAILY_LIMIT = Number(Deno.env.get('SLIP_DAILY_LIMIT') ?? '300');
const MAX_BASE64_CHARS = 6_000_000; // about 4.5 MB of image

const nullableString = { type: ['string', 'null'] };

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'isSlip', 'direction', 'amount', 'dateText', 'dateIso', 'time',
    'counterparty', 'bank', 'reference', 'confidence',
  ],
  properties: {
    isSlip: { type: 'boolean' },
    direction: { type: 'string', enum: ['expense', 'income', 'unknown'] },
    amount: nullableString,
    dateText: nullableString,
    dateIso: nullableString,
    time: nullableString,
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

const SYSTEM = `You read images from a Thai user's phone gallery and extract bank transfer / payment slip data for a personal finance app.

Return JSON only, matching the schema. Rules:
- isSlip: true only for a completed transfer or payment confirmation from a bank or e-wallet app (e.g. "โอนเงินสำเร็จ", "ชำระเงินสำเร็จ", "Transfer successful"). Screenshots of chats, bills not yet paid, QR codes to pay, and other photos are false. If false, set every other string to null, direction "unknown" and all confidences 0.
- amount: the transferred amount only, digits with a dot for decimals (e.g. "1250.00"). Never the fee and never an account balance.
- dateText: the date exactly as printed (e.g. "27 ก.ย. 69"). dateIso: the same date as YYYY-MM-DD in the Gregorian calendar. Thai slips print Buddhist Era years: 2569 = 2026, and a 2-digit "69" means 2569 = 2026.
- time: HH:MM (24h) as printed, or null.
- direction: "expense" when the slip shows money leaving the payer's account (the normal case for a slip the payer saved); "income" when the image is a receive notification ("ได้รับเงิน", "รับเงินสำเร็จ"); otherwise "unknown".
- counterparty: for an expense the receiver (shop or person name as printed); for income the sender. Do not include account numbers.
- bank: the bank or wallet that produced the slip (e.g. "KBank", "SCB", "Krungthai", "TrueMoney").
- reference: the transaction reference number (เลขที่รายการ / รหัสอ้างอิง / Ref), digits and letters only.
- confidence: for amount, date and counterparty, your certainty from 0 to 1 that the value is exactly right. Use below 0.8 if any character is blurred, cropped, covered, or ambiguous. Use 0 when the value is null.
- Never guess. If you cannot read a field, return null for it.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 'Use POST', 405);

  const userId = await requireUser(req);
  if (!userId) return fail('unauthorized', 'Sign in again', 401);

  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 'Body must be JSON', 400);
  }
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
    const text = await callAI({
      task: 'slip',
      system: SYSTEM,
      maxTokens: 600,
      schema: SCHEMA,
      content: [
        { type: 'image', mediaType, data: image },
        { type: 'text', text: 'Extract the slip fields from this image.' },
      ],
    });
    return json({ reading: normalizeReading(parseJsonText(text)) });
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
