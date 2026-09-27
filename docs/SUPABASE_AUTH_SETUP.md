# ตั้งค่าการสมัคร / เข้าสู่ระบบใน Supabase

ทำครั้งเดียวใน Supabase Dashboard ของโปรเจค `dufvcdwswcaqsfbxjwat` (ต้องทำเองใน Dashboard ไม่มีในโค้ด)

## 1. ที่อยู่ที่ลิงก์ในอีเมลพากลับมา (จำเป็น)

Authentication → **URL Configuration**
https://supabase.com/dashboard/project/dufvcdwswcaqsfbxjwat/auth/url-configuration

| ช่อง | ค่า |
|---|---|
| Site URL | `https://2550expo-tech.github.io/Socrates-and-Skeletons-/` |
| Redirect URLs | `https://2550expo-tech.github.io/Socrates-and-Skeletons-/**` |
| | `mindpay://**` (แอป Android / iPhone) |
| | `http://localhost:8081/**` (ตอนพัฒนา) |

ถ้าไม่ตั้ง ลิงก์ในอีเมลจะพาไป `localhost:3000` ซึ่งเปิดไม่ได้ (ปัญหาที่เจอเมื่อ 27 ก.ย.)

## 2. จะให้ยืนยันอีเมลไหม (เลือก 1 แบบ)

Authentication → Sign In / Providers → **Email** → Confirm email
https://supabase.com/dashboard/project/dufvcdwswcaqsfbxjwat/auth/providers

| | ปิด Confirm email (แนะนำช่วงเรียน/พรีเซนต์) | เปิด Confirm email |
|---|---|---|
| สมัครแล้ว | เข้าใช้ได้ทันที + หน้าต่าง "สมัครบัญชีสำเร็จ" | ต้องใส่รหัส 6 หลักจากอีเมล (หรือกดลิงก์) ก่อน |
| ใครสมัครได้ | ทุกคน | **เฉพาะอีเมลของสมาชิกทีมใน Supabase** ถ้ายังใช้อีเมลฟรีของ Supabase |
| จำนวนอีเมล | ไม่ใช้อีเมล | อีเมลฟรีส่งได้ **ชั่วโมงละ 2 ฉบับ** |

ข้อจำกัดของอีเมลฟรีมาจาก Supabase: ส่งได้เฉพาะที่อยู่ของสมาชิกทีมโปรเจค และจำกัด 2 ฉบับต่อชั่วโมง ถ้าจะเปิดให้คนทั่วไปยืนยันอีเมล ต้องตั้ง **Custom SMTP** (Authentication → Emails → SMTP Settings) กับผู้ให้บริการอีเมล

แอปรองรับทั้งสองแบบโดยไม่ต้องแก้โค้ด ส่วน "ลืมรหัสผ่าน" ใช้อีเมลเสมอ จึงมีข้อจำกัดเดียวกัน

## 3. ให้อีเมลมีรหัส 6 หลัก (แนะนำเมื่อเปิด Confirm email)

แอปมีช่องใส่รหัส 6 หลักเหมือนการยืนยันด้วย OTP ในแอปธนาคาร/เหมียวจด แต่เทมเพลตเดิมของ Supabase มีแค่ลิงก์ ให้แก้ 2 เทมเพลต:

Authentication → **Emails** → Templates
https://supabase.com/dashboard/project/dufvcdwswcaqsfbxjwat/auth/templates

### Confirm signup

Subject: `รหัสยืนยัน MindPay`

```html
<h2>ยืนยันอีเมลสำหรับ MindPay</h2>
<p>รหัสยืนยันของคุณคือ</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">{{ .Token }}</p>
<p>กรอกรหัสนี้ในแอป MindPay (ใช้ได้ครั้งเดียว หมดอายุใน 1 ชั่วโมง)</p>
<p>หรือกดลิงก์นี้แทนก็ได้: <a href="{{ .ConfirmationURL }}">ยืนยันอีเมล</a></p>
<p style="color:#888">ถ้าคุณไม่ได้สมัคร MindPay ไม่ต้องทำอะไร</p>
```

### Reset password

Subject: `รหัสตั้งรหัสผ่านใหม่ MindPay`

```html
<h2>ตั้งรหัสผ่านใหม่สำหรับ MindPay</h2>
<p>รหัสของคุณคือ</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">{{ .Token }}</p>
<p>กรอกรหัสนี้ในแอป MindPay แล้วตั้งรหัสผ่านใหม่ (หมดอายุใน 1 ชั่วโมง)</p>
<p>หรือกดลิงก์นี้แทนก็ได้: <a href="{{ .ConfirmationURL }}">ตั้งรหัสผ่านใหม่</a></p>
<p style="color:#888">ถ้าคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ไม่ต้องทำอะไร บัญชียังปลอดภัย</p>
```

## ขั้นตอนในแอป (อ้างอิงแบบเหมียวจด: ทีละขั้น + รหัสยืนยัน)

1. **ข้อมูลบัญชี**: ชื่อเล่น (บังคับ), อีเมล, รหัสผ่านอย่างน้อย 8 ตัว (มีปุ่มดูรหัส)
2. **ยืนยันอีเมล** (เมื่อเปิด Confirm email): ใส่รหัส 6 หลัก ครบ 6 ตัวแล้วส่งเอง, ขอรหัสใหม่ได้ทุก 60 วินาที, หรือกดลิงก์ในอีเมล
3. **ตั้งค่าเงิน**: ยอดเงินตอนนี้, เงินสำรอง, งบรายเดือน

สมัครเสร็จ ฟอร์มจะถูกล้าง ขึ้นหน้าต่าง "สมัครบัญชีสำเร็จ" แล้วไปขั้นที่ 3 กดย้อนกลับไม่กลับมาหน้าสมัคร

ข้อความผิดพลาดทุกแบบแปลเป็นภาษาไทยใน `src/domain/auth.ts` (ทดสอบ TC-43 ถึง TC-48)

เหมียวจดใช้เบอร์มือถือ + SMS OTP แต่ MindPay ใช้อีเมล เพราะการส่ง SMS ต้องมีผู้ให้บริการที่เสียเงิน (เช่น Twilio) ถ้าทีมอยากใช้เบอร์มือถือ Supabase รองรับ Phone Auth เมื่อผูกผู้ให้บริการ SMS แล้ว
