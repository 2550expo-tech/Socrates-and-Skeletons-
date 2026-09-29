/**
 * TC-76: how น้องกล้า talks — subtitles cut at spaces, text made easy for the
 * Thai voice, and reading time when there is no sound.
 */
import { describe, expect, it } from 'vitest';
import { KLA_GREETING, speakable, talkChunks, talkMs } from '../klaTalk';

describe('Talking', () => {
  it('TC-76 cuts long answers into short subtitles at spaces, never inside a word, keeping every word', () => {
    const answer =
      'สัปดาห์นี้ใช้ไป ฿1,290 ส่วนใหญ่เป็นค่าอาหาร สูงกว่าปกติราว 20% ถ้าลดค่ากาแฟวันละแก้ว จะเหลือเงินเพิ่มอีกหลายร้อยบาท ลองดูว่าแบบไหนเหมาะกับเรานะ';
    const parts = talkChunks(answer);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(' ')).toBe(answer);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(64);
    expect(talkChunks('สั้น ๆ')).toEqual(['สั้น ๆ']);
    expect(talkChunks('บรรทัดแรก\nบรรทัดสอง')).toEqual(['บรรทัดแรก', 'บรรทัดสอง']);
    expect(talkChunks(KLA_GREETING)[0]).toContain('ถามเรื่องเงินได้ทุกเรื่อง');
    // A word that starts the next thought ("เช่น") opens the next subtitle instead of ending this one.
    for (const p of talkChunks(KLA_GREETING)) expect(p).not.toMatch(/ (เช่น|หรือ|แต่)$/);
    expect(talkChunks(KLA_GREETING).join(' ')).toBe(KLA_GREETING);
  });

  it('TC-76 reads baht, percent and minus the way a Thai voice should, without emoji', () => {
    expect(speakable('ซื้อได้ ฿1,290 🎉')).toBe('ซื้อได้ 1290 บาท');
    expect(speakable('เพิ่มขึ้น 25%')).toBe('เพิ่มขึ้น 25 เปอร์เซ็นต์');
    expect(speakable('ยอด −฿500 · เดือนนี้')).toBe('ยอด ลบ 500 บาท , เดือนนี้');
    expect(speakable('“ลองปรับ”')).toBe('ลองปรับ');
  });

  it('TC-76 a silent subtitle stays long enough to read, but not forever', () => {
    expect(talkMs('สั้น')).toBe(1400);
    expect(talkMs('ก'.repeat(60))).toBe(420 + 60 * 72);
    expect(talkMs('ก'.repeat(500))).toBe(9000);
  });
});
