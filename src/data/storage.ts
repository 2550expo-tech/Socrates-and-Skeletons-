/**
 * Small key-value store used for app settings and demo data.
 * Phone: SQLite-backed store (survives app restarts).
 * Web: see storage.web.ts (browser localStorage).
 */
import KV from 'expo-sqlite/kv-store';

export const Storage = {
  getItem: (key: string) => KV.getItem(key),
  setItem: (key: string, value: string) => KV.setItem(key, value),
  removeItem: (key: string) => KV.removeItem(key),
};
