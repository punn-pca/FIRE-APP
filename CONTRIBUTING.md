# Contributing to FIRE KEEPER OS

ขอบคุณที่สนใจช่วยพัฒนา FIRE KEEPER OS โปรเจกต์นี้มีทั้ง Expo app, Express API, PostgreSQL/Drizzle และ evaluation pipeline ดังนั้นการเปลี่ยนแปลงควรระบุให้ชัดว่ากระทบส่วนใด

## ก่อนเริ่ม

1. อ่าน [README.md](README.md)
2. ตั้งค่า environment จาก `.env.example`
3. ติดตั้ง dependencies ด้วย `pnpm install`
4. ตรวจสอบว่า API และ database ที่ใช้เป็น development environment

## Workflow แนะนำ

สร้าง branch แยก:

```bash
git switch -c feature/short-description
```

ทำงานตามขอบเขต:

- UI/Expo: `artifacts/fire-keeper/`
- API/PCA/evaluation: `artifacts/api-server/`
- Database/schema: `lib/db/`
- Shared API contract: `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/`
- Documentation/screenshots: root หรือ `screenshots/`

## กฎสำคัญสำหรับ PCA และ Evaluation

- อย่าให้ audit rewrite, retry หรือ block คำตอบ user-facing
- อย่าใช้ `user_input` เป็น factual evidence
- อย่าเปิดเผย private chain-of-thought; ใช้ structured audit trace ที่ตรวจสอบได้
- เมื่อเปลี่ยน report shape ให้ปรับ type interface, mobile UI, HTML/PDF export และ regression tests ให้สอดคล้องกัน
- Research Evaluation ต้องแยก Truth Engine output จาก self-reported model labels
- รักษา Human Agency: ระบบเสนอผลประเมิน แต่ไม่ตัดสินใจแทนผู้ใช้
- อย่าใส่ API key, password, token หรือ PII ลงใน source, test fixture หรือ screenshot

## คำสั่งตรวจสอบก่อนส่งงาน

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server exec tsx src/__tests__/regression.ts
pnpm --filter @workspace/api-server run build
git diff --check
```

ถ้าแก้ Expo UI ให้รันเพิ่ม:

```bash
pnpm --filter @workspace/fire-keeper run typecheck
```

ถ้าแก้ workflow, package หรือ run command ให้ restart workflow ที่เกี่ยวข้องและตรวจ logs/preview ก่อนส่งงาน

## Pull request checklist

- [ ] อธิบายปัญหาและแนวทางแก้
- [ ] ระบุไฟล์หรือ package ที่ได้รับผลกระทบ
- [ ] เพิ่มหรือปรับ regression tests เมื่อ behavior หรือ report contract เปลี่ยน
- [ ] รัน typecheck และ regression suite แล้ว
- [ ] ตรวจ mobile/web responsive behavior ถ้าเป็น UI
- [ ] ตรวจ HTML/PDF export ถ้าแก้ report layer
- [ ] ไม่มี secret หรือข้อมูลส่วนตัวใน diff
- [ ] อัปเดต README หากคำสั่งรันหรือ output เปลี่ยน

## Commit และ review

ใช้ commit message ที่สื่อความหมาย เช่น:

```text
feat: add counterfactual evaluation module
fix: preserve analyst report export sections
docs: clarify local development setup
```

Pull request ควรมี screenshot หรือคำอธิบายผลลัพธ์เมื่อเปลี่ยน UI และควรระบุข้อจำกัดของ evaluation หาก metric หรือ ground truth เปลี่ยน

## รายงานปัญหา

กรุณาแนบ:

- ขั้นตอนที่ทำให้เกิดปัญหา
- ผลลัพธ์ที่คาดหวังและผลลัพธ์จริง
- package/workflow ที่เกี่ยวข้อง
- log ที่ตัดข้อมูลลับออกแล้ว
- screenshot หากเป็นปัญหา UI

อย่าแนบ `.env`, API key, session cookie, database URL ที่มี credentials หรือข้อมูลผู้ใช้จริง