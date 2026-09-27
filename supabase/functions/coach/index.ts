// FR-5: AI Persona Coach. Explains the user's CONFIRMED numbers in the tone
// they picked. The app sends only totals by category (no slip images, no
// names of people, no account numbers).
import { callClaude, corsHeaders, fail, json, NotConfiguredError, requireUser, takeQuota } from '../_shared/common.ts';

const MODEL = Deno.env.get('COACH_MODEL') ?? 'claude-haiku-4-5-20251001';
const DAILY_LIMIT = Number(Deno.env.get('COACH_DAILY_LIMIT') ?? '60');

const PERSONAS: Record<string, string> = {
  friend: 'a close friend of the same age: casual, warm, light humor, short sentences, ends with "นะ" sometimes. Never preachy.',
  coach: 'a focused money coach: direct, numbers first, then one clear action. No small talk.',
  senior: 'a kind older sibling (พี่): gentle, encouraging, explains the "why" simply, calls the user "น้อง".',
};

function systemPrompt(tone: string) {
  return `You are the MindPay coach inside a Thai personal finance app for students and first-jobbers.
Persona: ${PERSONAS[tone] ?? PERSONAS.friend}

Rules:
- Reply in Thai, at most 110 words, plain text (no markdown headings, no tables).
- Use ONLY the numbers in the DATA block. Never invent amounts, dates, shops or trends. If the data cannot answer, say what is missing.
- Structure: what the numbers show -> why it matters -> one or two small suggestions -> leave the decision to the user.
- Never shame or scold ("ใช้เยอะเกินไป!" is not allowed). Be kind about mistakes.
- When the user asks "can I buy X", use the "purchaseCheck" numbers if present and state the runway before and after.
- You are not a licensed financial advisor: no investment, loan or crypto recommendations.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 'Use POST', 405);

  const userId = await requireUser(req);
  if (!userId) return fail('unauthorized', 'Sign in again', 401);

  let body: { tone?: string; context?: unknown; question?: string };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 'Body must be JSON', 400);
  }
  const question = (body.question ?? '').toString().slice(0, 400).trim();
  const data = JSON.stringify(body.context ?? {}).slice(0, 6000);

  if (!Deno.env.get('ANTHROPIC_API_KEY')) return fail('not_configured', 'AI key is not set on the server', 503);

  try {
    if (!(await takeQuota(userId, 'coach', DAILY_LIMIT))) {
      return fail('quota', 'Daily coach limit reached, try again tomorrow', 429);
    }
    const text = await callClaude({
      model: MODEL,
      system: systemPrompt(body.tone ?? 'friend'),
      maxTokens: 500,
      content: [
        {
          type: 'text',
          text: `DATA:\n${data}\n\nQUESTION:\n${question || 'สรุปสถานะการเงินของฉันช่วงนี้ และบอกสิ่งที่ควรรู้'}`,
        },
      ],
    });
    return json({ text: text.trim() });
  } catch (e) {
    if (e instanceof NotConfiguredError) return fail('not_configured', 'AI key is not set on the server', 503);
    console.error('coach failed', e);
    return fail('coach_error', 'The coach is unavailable right now', 502);
  }
});
