# AI Usage Log

บันทึกการใช้ AI ในการพัฒนา Mind pay ตามที่ SRS กำหนด (Tool / Prompt-purpose / Output / สิ่งที่แก้ไข / Human verification / Evidence)

> ทีมต้องเติมคอลัมน์ "Human verification" ด้วยสิ่งที่สมาชิกตรวจเองจริง และแนบหลักฐาน (ภาพหน้าจอ, commit, ผลทดสอบ) อย่าเขียนว่า AI ทำทั้งหมดเอง

## 2026-09-27 · Claude (Anthropic, Claude app)

| # | Prompt / Purpose | Output | สิ่งที่แก้ไข / ตัดสินใจเพิ่ม | Human verification | Evidence |
|---|---|---|---|---|---|
| 1 | รีวิว Prototype เดิม (เว็บ ChatGPT) และ M1 Charter | รายงานปัญหา: อ่านวันที่เดือน "ก.ย." ไม่ได้, ข้อมูลตัวอย่างล็อกวันที่ทำให้ Money Runway ว่าง, เปิดฟอร์มแล้วเกิดแบบร่างเปล่า, ฟีเจอร์นอก MVP | ทีมตัดสินใจทำแอป native ใหม่ตาม 5 FR ใน Charter | ☐ ทีมทดลอง prototype เดิมซ้ำและยืนยันปัญหา | บทสนทนาในแชท |
| 2 | ออกแบบสถาปัตยกรรม (Expo + Supabase + Edge Functions + Claude API) | README, แผนภาพสถาปัตยกรรม | เลือกอ่าน QR บนเครื่องก่อนส่งรูป เพื่อลดค่าใช้จ่ายและความเป็นส่วนตัว | ☐ | `README.md` |
| 3 | เขียนกฎและการคำนวณ FR-2/4/5/6 พร้อม unit test | `src/domain/*`, 32 test cases | เทสต์ TC-25 จับบั๊กได้: คีย์เวิร์ด "ชา" ทำให้ชื่อ "สมชาย" ถูกจัดเป็นหมวดอาหาร แก้เป็นคำที่เจาะจงขึ้น | ☐ รัน `npm test` เองและอ่านเทสต์ | ผล `npm test` |
| 4 | สร้างฐานข้อมูล Supabase + RLS | `supabase/migrations/20260927000000_init.sql` | รัน Security/Performance Advisor พบ 3 คำเตือนด้านความปลอดภัย + 4 ด้านประสิทธิภาพ แก้ใน `20260927000100_harden.sql` ผลเหลือ 0 | ☐ ทดสอบ MT-10 (บัญชี A ไม่เห็นข้อมูล B) | Supabase Advisors |
| 5 | Edge Functions อ่านสลิปและโค้ช | `supabase/functions/*` | กำหนด JSON schema, เกณฑ์ความมั่นใจ, ห้ามเดา, จำกัดโควตาต่อวัน | ☐ ทดสอบกับสลิปจริงของสมาชิก (MT-04) | Supabase function logs |
| 6 | หน้าจอแอปและ Design System (Green + Gold) | `src/app/*`, `src/ui/*` | ต้นไม้เงินแสดงสุขภาพ Runway, ล็อกช่วงเวลาระหว่างสแกน | ☐ ทดสอบบนมือถือจริง | ภาพหน้าจอ |
| 7 | ตรวจคุณภาพ | typecheck 0 error, ESLint 0 ปัญหา, bundle Android สำเร็จ | แก้ปัญหา React hooks 6 จุดที่ lint พบ | ☐ | ผลคำสั่งใน README |

### สิ่งที่ AI ไม่ได้ทำ / ยังไม่ได้ยืนยัน
- ยังไม่ได้ทดสอบบนมือถือจริง (ต้องทำ MT-01 ถึง MT-10)
- ยังไม่ได้ทดสอบการอ่านสลิปกับสลิปจริงของหลายธนาคาร
- ข้อความ FR/NFR ในเอกสาร traceability สรุปจาก M1 Charter ต้องตรวจกับ SRS v1.3
