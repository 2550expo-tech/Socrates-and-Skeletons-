/**
 * Supabase client. Keys come from environment variables (see .env.example).
 * The publishable key is safe to ship in the app: Row Level Security in the
 * database decides what each signed-in user can read and write.
 * The Anthropic API key is NOT here; it lives only in the Edge Functions.
 */
import 'expo-sqlite/localStorage/install';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** null when the app was built without Supabase settings: only demo mode is available. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const cloudAvailable = supabase !== null;
