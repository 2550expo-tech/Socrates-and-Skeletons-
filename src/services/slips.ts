/**
 * FR-4 on the phone: find photos in the gallery, spot slips, read them.
 *
 * Cost and privacy rule: a photo leaves the phone only if it looks like a slip.
 * By default that means it carries a Thai slip-verification QR code, which is
 * detected on the device for free. Photos the user picks by hand are always read.
 */
import { scanFromURLAsync } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Storage } from '../data/storage';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { parseSlipQr, type SlipQr, type SlipReading } from '../domain/slip';
import { supabase } from '../data/supabase';

export * from './gallery';

// Remember which photos were already checked, so a second scan skips them.
const scannedKey = (userId: string) => `mindpay.scanned.${userId}`;

export async function loadScannedIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await Storage.getItem(scannedKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function rememberScanned(userId: string, ids: Set<string>) {
  try {
    await Storage.setItem(scannedKey(userId), JSON.stringify([...ids].slice(-5000)));
  } catch {
    // Not critical: worst case a photo is checked again and caught as a duplicate.
  }
}

export async function forgetScanned(userId: string) {
  await Storage.removeItem(scannedKey(userId)).catch(() => {});
}

// ---------------------------------------------------------------------------
// One image
// ---------------------------------------------------------------------------

/** Look for the slip-verification QR on the device. Never throws. */
export async function detectSlipQr(uri: string): Promise<SlipQr | null> {
  try {
    const results = await scanFromURLAsync(uri, ['qr']);
    for (const r of results) {
      const qr = parseSlipQr(r.data);
      if (qr) return qr;
    }
  } catch {
    // Unsupported image or decoder error: treat as "no QR".
  }
  return null;
}

/** Shrink to at most 1100px wide JPEG (enough to read a slip, about 150 KB) and hash it. */
export async function prepareImage(uri: string, width?: number | null) {
  const ctx = ImageManipulator.manipulate(uri);
  if (!width || width > 1100) ctx.resize({ width: 1100 });
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new Error('image_prepare_failed');
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, saved.base64);
  return { base64: saved.base64, hash };
}

export class SlipReaderError extends Error {
  constructor(
    public code: 'cloud_required' | 'unauthorized' | 'quota' | 'too_large' | 'not_configured' | 'busy' | 'network' | 'reader_error',
    message: string,
  ) {
    super(message);
  }
}

const READER_MESSAGES: Record<SlipReaderError['code'], string> = {
  cloud_required: 'ต้องเข้าสู่ระบบด้วยบัญชีจริงก่อน จึงจะอ่านสลิปได้',
  unauthorized: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
  quota: 'วันนี้อ่านสลิปครบโควตาแล้ว ลองใหม่พรุ่งนี้',
  too_large: 'รูปใหญ่เกินไป',
  not_configured: 'ระบบอ่านสลิปยังไม่พร้อม: API key ของ AI บนเซิร์ฟเวอร์ยังไม่ได้ใส่หรือใช้ไม่ได้ (ดู README ขั้นตอน Secrets)',
  busy: 'ตอนนี้ AI อ่านสลิปมีคนใช้เยอะ ลองใหม่อีกสักครู่ สลิปที่เหลือจะอ่านต่อตอนเปิดแอปครั้งหน้า',
  network: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง',
  reader_error: 'อ่านรูปนี้ไม่สำเร็จ',
};

/** Send the prepared image to the slip reader (Edge Function parse-slip). */
export async function readSlip(base64: string): Promise<SlipReading> {
  if (!supabase) throw new SlipReaderError('cloud_required', READER_MESSAGES.cloud_required);
  const { data, error } = await supabase.functions.invoke('parse-slip', {
    body: { imageBase64: base64, mediaType: 'image/jpeg' },
  });
  if (error) {
    let code: SlipReaderError['code'] = 'network';
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      const c = body?.error?.code;
      code = c === 'unauthorized' || c === 'quota' || c === 'too_large' || c === 'not_configured' || c === 'busy' ? c : 'reader_error';
    }
    throw new SlipReaderError(code, READER_MESSAGES[code]);
  }
  const reading = (data as { reading?: SlipReading })?.reading;
  if (!reading || typeof reading.isSlip !== 'boolean') throw new SlipReaderError('reader_error', READER_MESSAGES.reader_error);
  return reading;
}
