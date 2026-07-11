# หารกัน (HanGun)

แอปหารบิลทริปกับเพื่อน — เปิด Project, ชวนเพื่อนสแกน QR เข้ามา, หารค่าใช้จ่ายร่วมกัน
แล้วรู้ชัดว่าใครต้องโอนเงินคืนใครเท่าไหร่

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres + Storage)

## Features

- เปิด Project ได้ทุกคน — ไม่ต้องสมัครสมาชิก เข้าผ่านลิงก์/QR
- สมาชิกสร้างโปรไฟล์ + อัป QR รับเงิน (พร้อมเพย์/ธนาคาร)
- เพิ่มรายการค่าใช้จ่าย — หารเท่ากัน / กำหนดเอง / หนี้ส่วนตัว
- สรุปรายคน + Transfer Matrix (ยอดดิบ ↔ หักลบกลบหนี้)
- กด "จ่ายแล้ว" → แนบสลิป (อ่าน QR ในสลิปอัตโนมัติ) → ยอดถูกหักออก
- เจ้าของ Project เชิญ/ลบสมาชิก/ลบ Project ได้

## Local development

```bash
bun install
bunx supabase start        # local Supabase (ต้องมี Docker)
cp .env.local.example .env.local   # ใส่ค่าจาก `supabase start`
bun run dev
```

## Environment variables

| key | คำอธิบาย |
|-----|----------|
| `SUPABASE_URL` | Project URL ของ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key (server-only) |

DB schema อยู่ใน `supabase/migrations/` — apply ด้วย `supabase db push`
