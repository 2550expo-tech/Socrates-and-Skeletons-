/**
 * The user's theme choice: follow the phone, always light, or always dark.
 * Kept on the phone; one shared store so every screen switches at once. On
 * phones the choice is also given to the system (date pickers and dialogs
 * follow it); the web only uses it for the app's own colours.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { Storage } from '../data/storage';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'mindpay.themeMode';
let mode: ThemeMode = 'system';
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => mode;

function applyToSystem(m: ThemeMode) {
  if (Platform.OS === 'web') return;
  try {
    Appearance.setColorScheme(m === 'system' ? 'unspecified' : m);
  } catch {
    // Older systems: the app's own colours still follow the choice.
  }
}

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await Storage.getItem(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      mode = saved;
      applyToSystem(mode);
      emit();
    }
  } catch {
    // Follow the phone.
  }
}

export function setThemeMode(m: ThemeMode) {
  mode = m;
  applyToSystem(m);
  emit();
  Storage.setItem(KEY, m).catch(() => {});
}

export function useThemeMode(): ThemeMode {
  const m = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    load();
  }, []);
  return m;
}

/** 'light' or 'dark' after the user's choice. */
export function useSchemeChoice(): 'light' | 'dark' {
  const system = useColorScheme();
  const m = useThemeMode();
  if (m !== 'system') return m;
  return system === 'dark' ? 'dark' : 'light';
}
