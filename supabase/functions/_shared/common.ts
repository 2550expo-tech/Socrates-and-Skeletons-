// Shared helpers for MindPay Edge Functions (Deno runtime on Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  type AiProvider,
  CLAUDE_KEY_NAMES,
  GEMINI_KEY_NAMES,
  geminiModels,
  geminiStep,
  geminiText,
  isInvalidKey,
  pickProvider,
  readKey,
  retryDelayMs,
  verifierModels,
} from './helpers.ts';

/** Read one environment variable; a name the runtime refuses counts as "not set". */
const env = (name: string) => {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
};
const geminiKey = () => readKey(env, GEMINI_KEY_NAMES);
const claudeKey = () => readKey(env, CLAUDE_KEY_NAMES);

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Error body the app understands: { error: { code, message } } */
export function fail(code: string, message: string, status: number) {
  return json({ error: { code, message } }, status);
}

/** Returns the signed-in user's id, or null when the request has no valid session. */
export async function requireUser(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

/** Thrown when no AI key is set in the function secrets, or the key was refused. */
export class NotConfiguredError extends Error {}

/** The AI service is rate-limiting us (e.g. Gemini free tier) or overloaded: try again shortly. */
export class BusyError extends Error {}

/**
 * Daily cap per user so a leaked account or a bug cannot run up the AI bill.
 * Returns false when the user is over the limit; otherwise records one use.
 */
export async function takeQuota(userId: string, kind: 'slip' | 'coach', dailyLimit: number) {
  const db = admin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error } = await db
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .gte('created_at', since);
  if (error) throw error;
  if ((count ?? 0) >= dailyLimit) return false;
  await db.from('ai_usage').insert({ user_id: userId, kind });
  return true;
}

// ---------------------------------------------------------------------------
// AI: Claude (ANTHROPIC_API_KEY) or Gemini (GEMINI_API_KEY, or GOOGLE_API_KEY).
// Keys never leave the server. Claude is used when both are set, unless
// AI_PROVIDER says otherwise.
// ---------------------------------------------------------------------------

export type Content = { type: 'text'; text: string } | { type: 'image'; mediaType: string; data: string };

interface AiRequest {
  task: 'slip' | 'coach';
  /** 'verify': the second, independent read of a slip, made by a different model. */
  variant?: 'primary' | 'verify';
  system: string;
  content: Content[];
  maxTokens: number;
  /** When set, the reply is one JSON object matching this JSON Schema. */
  schema?: Record<string, unknown>;
}

const CLAUDE_DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export function aiProvider(): AiProvider | null {
  return pickProvider({
    forced: Deno.env.get('AI_PROVIDER'),
    hasClaude: !!claudeKey(),
    hasGemini: !!geminiKey(),
  });
}

/** Ask the configured AI and return its text reply. */
export async function callAI(req: AiRequest): Promise<string> {
  const provider = aiProvider();
  if (!provider) throw new NotConfiguredError('No AI key is set');
  const started = Date.now();
  const { text, model } = provider === 'claude' ? await callClaude(req) : await callGemini(req);
  // Metadata only: never log images, questions or replies.
  console.log(JSON.stringify({ ai: provider, model, task: req.task, variant: req.variant ?? 'primary', ms: Date.now() - started }));
  return text;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callClaude(req: AiRequest): Promise<{ text: string; model: string }> {
  const key = claudeKey()!;
  const main = Deno.env.get(req.task === 'slip' ? 'SLIP_MODEL' : 'COACH_MODEL') ?? CLAUDE_DEFAULT_MODEL;
  const model = req.variant === 'verify' ? (Deno.env.get('VERIFY_MODEL') ?? main) : main;
  const body: Record<string, unknown> = {
    model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [
      {
        role: 'user',
        content: req.content.map((c) =>
          c.type === 'text' ? c : { type: 'image', source: { type: 'base64', media_type: c.mediaType, data: c.data } },
        ),
      },
    ],
  };
  if (req.schema) {
    body.output_config = { format: { type: 'json_schema', schema: req.schema } };
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    const msg = `Claude API ${res.status}: ${detail.slice(0, 300)}`;
    if (isInvalidKey(res.status, detail)) throw new NotConfiguredError(msg);
    if (res.status === 429 || res.status === 529) throw new BusyError(msg);
    throw new Error(msg);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
  if (!text) throw new Error('Claude API returned no text');
  return { text, model };
}

async function callGemini(req: AiRequest): Promise<{ text: string; model: string }> {
  const key = geminiKey()!;
  const parts = req.content.map((c) =>
    c.type === 'text' ? { text: c.text } : { inlineData: { mimeType: c.mediaType, data: c.data } },
  );
  let useJsonSchema = !!req.schema;
  let lastError = 'Gemini: no model available';
  const models = req.variant === 'verify' ? verifierModels(Deno.env.get('GEMINI_VERIFY_MODEL')) : geminiModels(Deno.env.get('GEMINI_MODEL'));

  // Try every model; if some were only busy, wait once and try them all again.
  for (let round = 0; round < 2; round++) {
    let busyDelayMs: number | null = null;
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        // maxOutputTokens also covers the model's internal thinking, so leave room.
        const generationConfig: Record<string, unknown> = { maxOutputTokens: Math.max(2048, req.maxTokens * 4) };
        let system = req.system;
        if (req.schema) {
          generationConfig.responseMimeType = 'application/json';
          if (useJsonSchema) generationConfig.responseJsonSchema = req.schema;
          else system += `\n\nReply with one JSON object that matches this JSON Schema:\n${JSON.stringify(req.schema)}`;
        }
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts }],
            generationConfig,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = geminiText(data);
          if (!text) {
            const why = data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? 'unknown';
            throw new Error(`Gemini ${model} returned no text (${why})`);
          }
          return { text, model };
        }

        const detail = await res.text();
        lastError = `Gemini ${model} ${res.status}: ${detail.slice(0, 300)}`;
        const step = geminiStep(res.status, detail, useJsonSchema);
        if (step === 'invalid_key') throw new NotConfiguredError(lastError);
        if (step === 'fail') throw new Error(lastError);
        if (step === 'plain_schema') {
          useJsonSchema = false; // describe the schema in the prompt instead
          continue;
        }
        if (step === 'busy') busyDelayMs = Math.max(busyDelayMs ?? 0, retryDelayMs(detail) ?? 3000);
        break; // next_model or busy: the next model has its own quota
      }
    }
    if (busyDelayMs === null) break; // no model is usable with this key
    if (round === 1) throw new BusyError(lastError);
    console.warn(JSON.stringify({ ai: 'gemini', task: req.task, waitMs: Math.min(busyDelayMs, 12000) }));
    await sleep(Math.min(busyDelayMs, 12000));
  }
  throw new Error(lastError);
}
