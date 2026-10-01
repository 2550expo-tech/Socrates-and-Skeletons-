/**
 * FR-4 on the phone: find photos in the gallery, spot slips, read them.
 *
 * Cost and privacy rule: a photo leaves the phone only if it looks like a slip.
 * By default that means it carries a Thai slip-verification QR code, which is
 * detected on the device for free. Photos the user picks by hand are always read.
 */
import { scanFromURLAsync } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { Storage } from '../data/storage';
import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  firstSlipQr,
  isScreenSized,
  regionInPixels,
  SLIP_QR_REGIONS,
  type PictureSize,
  type SlipCheck,
  type SlipQr,
  type SlipReading,
} from '../domain/slip';
import { supabase } from '../data/supabase';

export * from './gallery';

// Remember which photos were already checked, so a second scan skips them.
const scannedKey = (userId: string) => `mindpay.scanned.${userId}`;
// How many times the automatic scan failed to read each photo (see MAX_AUTO_ATTEMPTS).
const failuresKey = (userId: string) => `mindpay.scanFailures.${userId}`;

export async function loadScannedIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await Storage.getItem(scannedKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * The manual scan (scan screen) is running: the automatic scan waits, so the two never read the
 * same photos at the same time (which would spend the daily AI quota twice).
 */
export const scanLock = { manual: false };

export async function rememberScanned(userId: string, ids: Set<string>) {
  try {
    // Merge with what is stored now: the other scan may have added photos since this one started.
    const all = await loadScannedIds(userId);
    for (const id of ids) all.add(id);
    await Storage.setItem(scannedKey(userId), JSON.stringify([...all].slice(-5000)));
  } catch {
    // Not critical: worst case a photo is checked again and caught as a duplicate.
  }
}

export async function forgetScanned(userId: string) {
  await Storage.removeItem(scannedKey(userId)).catch(() => {});
  await Storage.removeItem(failuresKey(userId)).catch(() => {});
}

export async function loadScanFailures(userId: string): Promise<Record<string, number>> {
  try {
    const raw = await Storage.getItem(failuresKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export async function saveScanFailures(userId: string, failures: Record<string, number>) {
  const entries = Object.entries(failures).slice(-500);
  try {
    if (entries.length === 0) await Storage.removeItem(failuresKey(userId));
    else await Storage.setItem(failuresKey(userId), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Not critical: worst case a photo is tried once more.
  }
}

// ---------------------------------------------------------------------------
// One image
// ---------------------------------------------------------------------------

export interface QrCheck {
  /** The slip-verification QR, when one was found. */
  qr: SlipQr | null;
  /** False when this phone cannot scan QR codes at all (Android without Google Play Services). */
  scannerWorks: boolean;
  /** Some other QR code was found (e-wallet slips such as TrueMoney use their own). */
  otherQr?: boolean;
}

/** The QR codes in one picture, or 'unavailable' when the phone has no QR scanner. Never throws. */
async function scanCodes(uri: string): Promise<string[] | 'unavailable'> {
  try {
    const results = await scanFromURLAsync(uri, ['qr']);
    return results.map((r) => r.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return /MLKit|Google Play Services/i.test(message) ? 'unavailable' : [];
  }
}

/** Remove a temporary picture made on the phone (the web keeps them in memory). */
function removeTemp(uri: string) {
  if (Platform.OS === 'web') return;
  try {
    new File(uri).delete();
  } catch {
    // Already gone, or the system cleans the cache later.
  }
}

/**
 * Look for the slip-verification QR on the device. Never throws.
 *
 * The whole picture first. Android's scanner reads best when the code fills a
 * large part of the image and a slip's QR is small, so for screen-sized
 * pictures (saved slips, screenshots) it then looks again at the parts where
 * banks print the QR (SLIP_QR_REGIONS). Camera photos skip that step.
 */
export async function detectSlipQr(uri: string, size?: PictureSize): Promise<QrCheck> {
  const whole = await scanCodes(uri);
  if (whole === 'unavailable') return { qr: null, scannerWorks: false };
  const found = firstSlipQr(whole);
  const otherQr = whole.length > 0;
  if (found || !isScreenSized(size)) return { qr: found, scannerWorks: true, otherQr: !found && otherQr };
  try {
    // Decode once; each part is cut from the decoded picture.
    const full = await ImageManipulator.manipulate(uri).renderAsync();
    for (const region of SLIP_QR_REGIONS) {
      const part = await ImageManipulator.manipulate(full).crop(regionInPixels(region, full)).renderAsync();
      const saved = await part.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
      const codes = await scanCodes(saved.uri);
      removeTemp(saved.uri);
      const qr = codes === 'unavailable' ? null : firstSlipQr(codes);
      if (qr) return { qr, scannerWorks: true };
    }
  } catch {
    // The picture could not be cut: the answer from the whole picture stands.
  }
  return { qr: null, scannerWorks: true, otherQr };
}

/** Shrink to at most 1100px wide JPEG (enough to read a slip, about 150 KB) and hash it. */
export async function prepareImage(uri: string, width?: number | null) {
  const ctx = ImageManipulator.manipulate(uri);
  if (!width || width > 1100) ctx.resize({ width: 1100 });
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  removeTemp(saved.uri);
  if (!saved.base64) throw new Error('image_prepare_failed');
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, saved.base64);
  return { base64: saved.base64, hash };
}

export class SlipReaderError extends Error {
  constructor(
    public code:
      | 'cloud_required'
      | 'unauthorized'
      | 'quota'
      | 'too_large'
      | 'not_configured'
      | 'busy'
      | 'network'
      | 'reader_error'
      | 'server'
      | 'cancelled'
      | 'qr_unavailable',
    message: string,
  ) {
    super(message);
  }
}

export const READER_MESSAGES: Record<SlipReaderError['code'], string> = {
  cloud_required: 'ต้องเข้าสู่ระบบด้วยบัญชีจริงก่อน จึงจะอ่านสลิปได้',
  unauthorized: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
  quota: 'วันนี้อ่านสลิปครบโควตาแล้ว ลองใหม่พรุ่งนี้',
  too_large: 'รูปใหญ่เกินไป',
  server: 'ระบบอ่านสลิปขัดข้องชั่วคราว สลิปที่เหลือจะอ่านต่อให้ภายหลัง',
  cancelled: 'หยุดอ่านสลิปแล้ว',
  not_configured: 'ระบบอ่านสลิปยังไม่พร้อม: ผู้ดูแลต้องใส่ GEMINI_API_KEY ใน Supabase → Edge Functions → Secrets (หรือ key ที่ใส่ไว้ใช้ไม่ได้)',
  busy: 'ตอนนี้ AI อ่านสลิปมีคนใช้เยอะ ลองใหม่อีกสักครู่ สลิปที่เหลือจะอ่านต่อตอนเปิดแอปครั้งหน้า',
  network: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง',
  reader_error: 'อ่านรูปนี้ไม่สำเร็จ',
  qr_unavailable: 'มือถือเครื่องนี้หา QR ของสลิปเองไม่ได้ (ต้องมี Google Play Services) ใช้ "เลือกรูปเอง" แทนได้',
};

/**
 * Seconds to wait before asking again when the AI is rate-limited. The free
 * Gemini tier allows only a few requests per minute, so a first scan with many
 * slips can hit the limit; waiting a little is better than stopping the scan.
 */
export const BUSY_WAITS_S = [20, 40];

/** Shown while the reader waits for the AI's rate limit to reset. */
export const waitMessage = (seconds: number) => `AI มีคิวเยอะ รออีก ${seconds} วินาทีแล้วอ่านต่อให้เอง`;

export interface SlipRead {
  reading: SlipReading;
  /** How the reader double-checked it (missing from older readers). */
  check: SlipCheck | null;
}

/**
 * Send the prepared image to the slip reader (Edge Function parse-slip).
 * When the AI is busy, waits and tries again (onWait tells the screen).
 */
export async function readSlip(base64: string, onWait?: (seconds: number) => void): Promise<SlipRead> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await readSlipOnce(base64);
    } catch (e) {
      const wait = BUSY_WAITS_S[attempt];
      if (!(e instanceof SlipReaderError) || e.code !== 'busy' || wait === undefined) throw e;
      onWait?.(wait);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    }
  }
}

async function readSlipOnce(base64: string): Promise<SlipRead> {
  if (!supabase) throw new SlipReaderError('cloud_required', READER_MESSAGES.cloud_required);
  const { data, error } = await supabase.functions.invoke('parse-slip', {
    body: { imageBase64: base64, mediaType: 'image/jpeg' },
  });
  if (error) {
    let code: SlipReaderError['code'] = 'network';
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      const c = body?.error?.code;
      const status = (error.context as Response).status;
      code =
        c === 'unauthorized' || c === 'quota' || c === 'too_large' || c === 'not_configured' || c === 'busy'
          ? c
          : // A gateway error or timeout (no answer from the reader itself): the service is down, not this photo.
            !c && status >= 500
            ? 'server'
            : 'reader_error';
    }
    throw new SlipReaderError(code, READER_MESSAGES[code]);
  }
  const { reading, check } = (data ?? {}) as { reading?: SlipReading; check?: SlipCheck };
  if (!reading || typeof reading.isSlip !== 'boolean') throw new SlipReaderError('reader_error', READER_MESSAGES.reader_error);
  return { reading, check: check && typeof check.verified === 'boolean' ? check : null };
}
