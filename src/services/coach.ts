/** FR-5: ask the AI coach (Edge Function "coach"). */
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { CoachTone } from '../domain/types';
import { supabase } from '../data/supabase';

export class CoachError extends Error {}

export async function askCoach(params: { tone: CoachTone; context: unknown; question: string }): Promise<string> {
  if (!supabase) throw new CoachError('โค้ช AI ใช้ได้เมื่อเข้าสู่ระบบด้วยบัญชีจริง ตอนนี้แสดงคำแนะนำจากกฎพื้นฐานแทน');
  const { data, error } = await supabase.functions.invoke('coach', { body: params });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      if (body?.error?.code === 'quota') throw new CoachError('วันนี้คุยกับโค้ชครบโควตาแล้ว พรุ่งนี้มาคุยกันใหม่นะ');
      if (body?.error?.code === 'not_configured') throw new CoachError('เซิร์ฟเวอร์ยังไม่ได้ใส่ API key ของโค้ช AI ระหว่างนี้ดูคำแนะนำด้านบนได้เลย');
      if (body?.error?.code === 'unauthorized') throw new CoachError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    }
    throw new CoachError('ติดต่อโค้ชไม่ได้ตอนนี้ ลองใหม่อีกครั้ง');
  }
  const text = (data as { text?: string })?.text;
  if (!text) throw new CoachError('โค้ชไม่ได้ตอบกลับ ลองถามใหม่อีกครั้ง');
  return text;
}
