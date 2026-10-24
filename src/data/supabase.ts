/**
 * Supabase client. Keys come from environment variables (see .env.example).
 * The publishable key is safe to ship in the app: Row Level Security in the
 * database decides what each signed-in user can read and write.
 * AI keys are NOT here; they live only in the Edge Functions.
 *
 * detectSessionInUrl is off: email links are handled by AppProvider (via
 * authLinks.ts) the same way on the web and in the phone app.
 */
import './sessionStorageSetup';
import './authLinks'; // records the address the web page was opened with
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** How long a request may take before it counts as failed (a hanging network must not freeze the app). */
const TIMEOUT_MS = 20_000;
/** Edge Functions read a slip with two AI models, or wait for the coach's answer: they get longer. */
const FUNCTION_TIMEOUT_MS = 70_000;

/**
 * fetch with a time limit. Phones on a captive portal or a weak signal can leave a request
 * open forever (Android's client has no read timeout by default); this turns that into an
 * ordinary network error that the screens already know how to show.
 */
function fetchWithTimeout(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const ms = address.includes('/functions/v1/') ? FUNCTION_TIMEOUT_MS : TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  // A caller's own cancel still works.
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input as RequestInfo, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** null when the app was built without Supabase settings: only demo mode is available. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: localStorage,
          // Its own key: on the web MyPay shares the github.io address with MindPay, and a shared
          // key would sign both in and out together (the accounts are the same Supabase ones).
          storageKey: 'mypay.auth',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
        global: { fetch: fetchWithTimeout as typeof fetch },
      })
    : null;

if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const cloudAvailable = supabase !== null;
