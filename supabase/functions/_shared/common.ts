// Shared helpers for Mind pay Edge Functions (Deno runtime on Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2';

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

/** Thrown when the Anthropic key has not been added to the function secrets yet. */
export class NotConfiguredError extends Error {}

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

type Content =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

/** Minimal call to the Claude Messages API. The key never leaves the server. */
export async function callClaude(params: {
  model: string;
  system: string;
  content: Content[];
  maxTokens: number;
  schema?: Record<string, unknown>;
}): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new NotConfiguredError('ANTHROPIC_API_KEY is not set');
  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: [{ role: 'user', content: params.content }],
  };
  if (params.schema) {
    body.output_config = { format: { type: 'json_schema', schema: params.schema } };
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
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
  if (!text) throw new Error('Claude API returned no text');
  return text;
}
