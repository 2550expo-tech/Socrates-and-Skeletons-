/**
 * TC-59..TC-61: "พูดจด" — what the user says becomes transactions.
 */
import { describe, expect, it } from 'vitest';
import { parseSpokenEntry, thaiNumberWords } from '../voice';

const one = (text: string) => {
  const r = parseSpokenEntry(text);
  expect(r.items).toHaveLength(1);
  return r.items[0];
};

describe('Voice entry', () => {
  it('TC-59 reads the usual sentence: item, amount, บาท (digits or Thai number words)', () => {
    expect(one('ข้าว 50 บาท')).toMatchObject({ title: 'ข้าว', amountSatang: 5000, kind: 'expense', categoryKey: 'food', dayOffset: 0 });
    expect(one('ข้าวมันไก่ห้าสิบบาทครับ')).toMatchObject({ title: 'ข้าวมันไก่', amountSatang: 5000 });
    expect(one('กาแฟ 65')).toMatchObject({ title: 'กาแฟ', amountSatang: 6500, categoryKey: 'food' });
    expect(one('ค่ารถ ยี่สิบห้า')).toMatchObject({ title: 'ค่ารถ', amountSatang: 2500, categoryKey: 'transport' });
    expect(one('เติมน้ำมัน 500 บาท')).toMatchObject({ title: 'น้ำมัน', amountSatang: 50000, categoryKey: 'transport' });
    expect(one('จ่ายค่าเน็ต 299')).toMatchObject({ title: 'ค่าเน็ต', amountSatang: 29900, categoryKey: 'bills' });
    expect(one('ค่าน้ำ 120')).toMatchObject({ categoryKey: 'bills' });
    expect(one('หนังสือ ๓๕๐ บาท')).toMatchObject({ title: 'หนังสือ', amountSatang: 35000, categoryKey: 'study' });
    expect(one('เซเว่น 1,250.50 บาท')).toMatchObject({ amountSatang: 125050, categoryKey: 'convenience' });
    expect(one('7-eleven 45')).toMatchObject({ amountSatang: 4500, categoryKey: 'convenience' });
    expect(one('ข้าว 45 บาท 50 สตางค์')).toMatchObject({ amountSatang: 4550 });
    expect(one('50 บาท ค่าข้าว')).toMatchObject({ title: 'ค่าข้าว', amountSatang: 5000, categoryKey: 'food' });
  });

  it('TC-60 several items, income, yesterday, quantities that are not money', () => {
    const two = parseSpokenEntry('ข้าว 50 น้ำ 15').items;
    expect(two.map((i) => [i.title, i.amountSatang, i.categoryKey])).toEqual([
      ['ข้าว', 5000, 'food'],
      ['น้ำ', 1500, 'food'],
    ]);
    expect(parseSpokenEntry('ก๋วยเตี๋ยว 60 บาท และ ชาเย็น 35 บาท').items.map((i) => i.title)).toEqual(['ก๋วยเตี๋ยว', 'ชาเย็น']);
    expect(one('ได้เงินจากแม่ 500')).toMatchObject({ title: 'เงินจากแม่', amountSatang: 50000, kind: 'income', categoryKey: 'allowance' });
    expect(one('เงินเดือนเข้า 15000')).toMatchObject({ kind: 'income', categoryKey: 'salary' });
    expect(one('ขายของได้ 2k')).toMatchObject({ kind: 'income', amountSatang: 200000 });
    expect(one('เมื่อวาน ค่ารถ 40')).toMatchObject({ title: 'ค่ารถ', dayOffset: -1 });
    expect(one('เมื่อวานซืน หมูกระทะ 299')).toMatchObject({ dayOffset: -2 });
    expect(one('ข้าว 2 จาน 100 บาท')).toMatchObject({ title: 'ข้าว 2 จาน', amountSatang: 10000 });
    expect(one('กาแฟ 3 แก้ว 195')).toMatchObject({ amountSatang: 19500 });
    expect(one('เสื้อ 5 ร้อย')).toMatchObject({ title: 'เสื้อ', amountSatang: 50000, categoryKey: 'shopping' });
    expect(one('รองเท้า สองพันห้า')).toMatchObject({ amountSatang: 250000 });
  });

  it('TC-61 Thai number words, and words that only look like numbers', () => {
    expect(thaiNumberWords('ห้าสิบ')).toBe(50);
    expect(thaiNumberWords('ยี่สิบห้า')).toBe(25);
    expect(thaiNumberWords('สิบเอ็ด')).toBe(11);
    expect(thaiNumberWords('หนึ่งร้อยห้า')).toBe(105);
    expect(thaiNumberWords('ร้อยห้า')).toBe(150);
    expect(thaiNumberWords('ร้อยครึ่ง')).toBe(150);
    expect(thaiNumberWords('ร้อยนึง')).toBe(100);
    expect(thaiNumberWords('พันห้าร้อย')).toBe(1500);
    expect(thaiNumberWords('สองพันห้า')).toBe(2500);
    expect(thaiNumberWords('แปดร้อยเก้าสิบเก้า')).toBe(899);
    expect(thaiNumberWords('หนึ่งล้าน')).toBe(1_000_000);
    expect(thaiNumberWords('ห้าง')).toBeNull();
    // "ห้าง" (mall) and "สี่แยก" (junction) are words, not 5 and 4.
    expect(one('ของใช้ในห้าง 250')).toMatchObject({ title: 'ของใช้ในห้าง', amountSatang: 25000 });
    expect(one('ค่ารถไปสี่แยก 30')).toMatchObject({ amountSatang: 3000 });
    // Nothing to record.
    expect(parseSpokenEntry('สวัสดีครับ').items).toEqual([]);
    expect(parseSpokenEntry('').items).toEqual([]);
  });
});
