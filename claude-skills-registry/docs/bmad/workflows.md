# BMAD — ขั้นตอนทำงาน <span class="category-badge badge-bmad">BMAD</span>

Workflow สำหรับทำงานตั้งแต่วางแผนจนถึง deploy

## วางแผนผลิตภัณฑ์

### `bmad-create-product-brief`

สร้าง Product Brief — ตอบคำถามทีละข้อแล้วได้เอกสารสรุปไอเดียผลิตภัณฑ์

### `bmad-create-prd`

สร้าง PRD (เอกสารความต้องการ) — ระบุฟีเจอร์ user story acceptance criteria

### `bmad-edit-prd`

แก้ไข PRD ที่มีอยู่แล้ว — เพิ่ม ลบ ปรับเนื้อหา

### `bmad-validate-prd`

ตรวจ PRD ว่าครบถ้วนตามมาตรฐานไหม — หาส่วนที่ขาดหาย

## วิจัย

### `bmad-domain-research`

วิจัยอุตสาหกรรม — เข้าใจ domain ก่อนออกแบบหรือพัฒนา

### `bmad-market-research`

วิจัยตลาด — ดูคู่แข่ง กลุ่มลูกค้า โอกาสทางธุรกิจ

### `bmad-technical-research`

วิจัยเทคนิค — เปรียบเทียบเทคโนโลยี เลือก stack ที่เหมาะ

## ออกแบบ

### `bmad-create-architecture`

ออกแบบโครงสร้างระบบ — วาง architecture เลือก database กำหนด API

### `bmad-create-ux-design`

วางแผน UX — กำหนด pattern user flow wireframe spec

## พัฒนา

### `bmad-create-epics`

แบ่งงานใหญ่เป็นชิ้นเล็ก — Epic → Story พร้อม acceptance criteria

### `bmad-create-story`

สร้างไฟล์ Story พร้อม context ครบ — dev เปิดอ่านแล้วทำงานได้เลย

### `bmad-dev-story`

เขียนโค้ดตาม Story ที่เตรียมไว้ — อ่าน spec แล้ว implement ให้

### `bmad-quick-dev`

ทำงานเล็ก ๆ แบบเร็ว — ไม่ต้อง spec ละเอียด แก้ไขเล็กน้อย

### `bmad-quick-spec`

เขียน spec สั้น ๆ สำหรับงานเล็ก — พอให้ dev เข้าใจและทำได้

### `bmad-code-review`

ตรวจโค้ดแบบจริงจัง — หาบั๊ก ปัญหา performance ความปลอดภัย

### `bmad-qa-e2e`

สร้างชุดทดสอบอัตโนมัติ — จำลองการใช้งานจริงตั้งแต่ต้นจนจบ

## จัดการ Sprint

### `bmad-sprint-planning`

วางแผน Sprint — เลือกงานจาก Epic มาจัดเป็น sprint

### `bmad-sprint-status`

ดูสถานะ Sprint — งานเสร็จกี่ % มีอะไรเสี่ยงจะไม่ทัน

### `bmad-check-readiness`

เช็คว่าพร้อมเริ่มเขียนโค้ดหรือยัง — ตรวจว่า PRD UX Architecture ครบไหม

### `bmad-correct-course`

ปรับแผนกลาง sprint — เมื่อมีการเปลี่ยนแปลงใหญ่ต้องจัดการ

### `bmad-retrospective`

ทบทวนหลังจบงาน — อะไรดี อะไรแย่ ปรับอะไรรอบหน้า

## เอกสาร & อื่น ๆ

### `bmad-document-project`

สร้างเอกสารโปรเจกต์ที่มีอยู่แล้ว — ให้ AI เข้าใจ codebase ได้เร็วขึ้น

### `bmad-generate-context`

สร้างไฟล์ context สำหรับ AI — ให้ Claude เข้าใจโปรเจกต์โดยไม่ต้องอธิบายทุกครั้ง

### `bmad-brainstorming`

ระดมไอเดีย — ใช้เทคนิคความคิดสร้างสรรค์หลายแบบช่วยคิด

<MascotFooter />
