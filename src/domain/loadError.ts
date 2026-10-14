/**
 * What to tell the user when loading their data fails. Never the raw technical
 * text ("TypeError: Network request failed", "JWT expired"): a short Thai
 * sentence, and whether signing in again is the way out.
 */
export type LoadErrorKind = 'network' | 'expired' | 'other';

export interface LoadErrorInfo {
  kind: LoadErrorKind;
  message: string;
}

export const LOAD_ERROR_MESSAGES: Record<LoadErrorKind, string> = {
  network: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ หรือเน็ตช้าเกินไป ลองอีกครั้ง',
  expired: 'เซสชันหมดอายุ เข้าสู่ระบบใหม่อีกครั้ง',
  other: 'โหลดข้อมูลไม่สำเร็จ ลองอีกครั้ง',
};

export function loadErrorOf(e: unknown): LoadErrorInfo {
  const err = (e ?? {}) as { name?: unknown; message?: unknown; code?: unknown; status?: unknown };
  const text = [err.name, err.message, err.code].filter((x) => typeof x === 'string').join(' ').toLowerCase();
  const kind: LoadErrorKind =
    err.status === 401 || err.code === 'PGRST301' || err.code === 'PGRST303' || /\bjwt\b|token.*expired|expired.*token|unauthori[sz]ed/.test(text)
      ? 'expired'
      : /network|failed to fetch|fetch failed|abort|timed? ?out|offline|connection|internet/.test(text)
        ? 'network'
        : 'other';
  return { kind, message: LOAD_ERROR_MESSAGES[kind] };
}
