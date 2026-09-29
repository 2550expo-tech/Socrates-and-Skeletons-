/** FR-5: ask น้องกล้า, the AI coach (Edge Function "coach"). */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../data/supabase';

export class CoachError extends Error {}

export async function askCoach(params: { context: unknown; question: string }): Promise<string> {
  if (!supabase) throw new CoachError('น้องกล้าตอบคำถามได้เมื่อเข้าสู่ระบบด้วยบัญชีจริง ระหว่างนี้แตะการ์ด "สิ่งที่ควรรู้ตอนนี้" ให้กล้าเล่าให้ฟังได้');
  const { data, error } = await supabase.functions.invoke('coach', { body: params });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      if (body?.error?.code === 'quota') throw new CoachError('วันนี้คุยกับน้องกล้าครบโควตาแล้ว พรุ่งนี้มาคุยกันใหม่นะ');
      if (body?.error?.code === 'not_configured') {
        throw new CoachError('โค้ช AI ยังไม่พร้อม: ผู้ดูแลต้องใส่ GEMINI_API_KEY ใน Supabase → Edge Functions → Secrets (หรือ key ที่ใส่ไว้ใช้ไม่ได้) ระหว่างนี้ดูคำแนะนำด้านบนได้เลย');
      }
      if (body?.error?.code === 'busy') throw new CoachError('ตอนนี้มีคนคุยกับน้องกล้าเยอะ รอสักครู่แล้วถามใหม่นะ');
      if (body?.error?.code === 'unauthorized') throw new CoachError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    }
    throw new CoachError('ติดต่อน้องกล้าไม่ได้ตอนนี้ ลองใหม่อีกครั้งนะ');
  }
  const text = (data as { text?: string })?.text;
  if (!text) throw new CoachError('น้องกล้าไม่ได้ตอบกลับ ลองถามใหม่อีกครั้งนะ');
  return text;
}
