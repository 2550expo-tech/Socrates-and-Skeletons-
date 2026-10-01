// FR-5: the AI coach is น้องกล้า, the MindPay mascot. It explains the user's
// CONFIRMED numbers in one calm, friendly voice; the app reads the answer
// aloud, so it is written to be spoken. The app sends only totals by category
// (no slip images, no names of people, no account numbers).
import { aiProvider, BusyError, callAI, corsHeaders, envLimit, fail, json, NotConfiguredError, requireUser, takeQuota } from '../_shared/common.ts';
import { plainText } from '../_shared/helpers.ts';

const DAILY_LIMIT = envLimit('COACH_DAILY_LIMIT', 60);
/** A question and a summary of totals: far below this. */
const MAX_BODY_BYTES = 64_000;

const SYSTEM = `You are น้องกล้า (Nong Kla), the mascot of MindPay, a Thai personal finance app for students and first-jobbers.
You are a small golden money-tree sapling and the user's personal money coach.

Voice: calm, composed and warm (สุขุม เป็นมิตร), like a thoughtful friend who is good with money.
- Speak natural, everyday Thai. Call yourself "กล้า". Do not use ครับ or ค่ะ; soft endings such as "นะ" are fine.
- Your answer is read aloud by a text-to-speech voice and shown as subtitles, so write short spoken sentences separated by spaces,
  no emoji, no bullet points, no markdown, no lists, no headings.

Rules:
- Reply in Thai, at most 90 words.
- Use ONLY the numbers in the DATA block. Never invent amounts, dates, shops or trends. If the data cannot answer, say what is missing.
- Structure: what the numbers show -> why it matters -> one or two small suggestions -> leave the decision to the user.
- Never shame or scold ("ใช้เยอะเกินไป!" is not allowed). Be kind about mistakes.
- When the user asks "can I buy X", use the "purchaseCheck" numbers if present and state the runway before and after.
- You are not a licensed financial advisor: no investment, loan or crypto recommendations.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 'Use POST', 405);

  const userId = await requireUser(req);
  if (!userId) return fail('unauthorized', 'Sign in again', 401);

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fail('too_large', 'Request is too large', 413);
  let body: { context?: unknown; question?: string };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 'Body must be JSON', 400);
  }
  if (!body || typeof body !== 'object') return fail('bad_request', 'Body must be a JSON object', 400);
  const question = (body.question ?? '').toString().slice(0, 400).trim();
  const data = JSON.stringify(body.context ?? {}).slice(0, 6000);

  if (!aiProvider()) return fail('not_configured', 'AI key is not set on the server', 503);

  try {
    if (!(await takeQuota(userId, 'coach', DAILY_LIMIT))) {
      return fail('quota', 'Daily coach limit reached, try again tomorrow', 429);
    }
    const text = await callAI({
      task: 'coach',
      system: SYSTEM,
      maxTokens: 500,
      content: [
        {
          type: 'text',
          text: `DATA:\n${data}\n\nQUESTION:\n${question || 'สรุปสถานะการเงินของฉันช่วงนี้ และบอกสิ่งที่ควรรู้'}`,
        },
      ],
    });
    return json({ text: plainText(text) });
  } catch (e) {
    if (e instanceof NotConfiguredError) {
      console.error('coach: AI key missing or refused', e.message);
      return fail('not_configured', 'AI key is not set on the server or was refused', 503);
    }
    if (e instanceof BusyError) {
      console.warn('coach: AI busy', e.message);
      return fail('busy', 'The AI service is busy, try again shortly', 503);
    }
    console.error('coach failed', e);
    return fail('coach_error', 'The coach is unavailable right now', 502);
  }
});
