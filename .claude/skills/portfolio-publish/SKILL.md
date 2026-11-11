---
name: portfolio-publish
description: เขียนหน้า case study ของโปรเจกต์ใหม่ในโฟลเดอร์ tanplanet แล้ว publish ขึ้น projects.tanplanet.work (การ์ดแรก + sitemap + llms.txt + push) แล้วทำภาพ + โพสต์ LinkedIn. ใช้เมื่อแทนพูดว่า "ขึ้น portfolio", "โพสต์ LinkedIn", "publish โปรเจกต์ใหม่", "ทำ case study", "มีโปรเจกต์ไหนยังไม่ขึ้นเว็บ", "/portfolio-publish [ชื่อโฟลเดอร์]"
---

# Portfolio publish — projects.tanplanet.work

เว็บ = repo นี้ (`/Volumes/My Passport/Projects/tanplanet`, public, GitHub Pages) · push แล้วขึ้นจริงใน ~1 นาที

## 1. เลือกโปรเจกต์
- ไม่ได้ระบุชื่อ → รัน `python3 tools/portfolio-gaps.py` แล้วถามแทนว่าจะทำตัวไหน
- โปรเจกต์ที่ตั้งใจไม่ขึ้นเว็บ → เพิ่มชื่อใน `tools/portfolio-skip.txt`

## 2. เก็บข้อมูล (spawn Explore agent ถ้าข้อมูลกระจาย)
อ่าน README / โค้ด / session-snapshots / memory ของโปรเจกต์ → สรุป: โจทย์, ทางเลือกที่ตัดทิ้ง, สถาปัตยกรรม, ขั้นตอนทำงาน, ปัญหาที่แก้จริง, ตัวเลขที่เปิดเผยได้

**ห้ามขึ้นเว็บ (repo public):** ชื่อบริษัทที่ทำงานประจำ · ชื่อลูกค้า · เงิน/รายได้/พอร์ต · อีเมล ชื่อบัญชี ชื่อเพจ/ช่อง · IP, tailnet, URL ภายใน, key, รหัสผ่าน · ข้อมูลครอบครัว
ถ้าไม่แน่ใจข้อไหน ให้ตัดออกก่อน แล้วถามแทนตอนสรุป

## 3. เขียนหน้า `<slug>-portfolio/index.html` — แพทเทิร์นเดิมเป๊ะ ห้ามดีไซน์ใหม่
- ก๊อปทั้ง `<head>`/`<style>` + โครง body จาก `ring-bot-billing-portfolio/index.html`
  hero (hero-mark ไอคอน, hero-badge, h1 + `<span class="accent">`, p, hero-tags, cta-row) → section-intro ตาม eyebrow Empathize · Define / Ideate / Prototype / Test & Iterate → pain-grid, ledger (ทางเลือก + `data-picked`), arch-diagram, flow-grid, hack-grid, plain, metrics → closing → back-nav + back-to-top + JSON-LD BreadcrumbList
- เปลี่ยนสี gradient ของ hero ได้ แต่คลาสต้องเหมือนเดิม
- **hack-card:** ไอคอน svg ต้องอยู่ "ใน" `<h3>` ตามด้วย `<span>ข้อความ</span>` (h3 เป็น grid 20px — ไอคอนอยู่นอกแล้วตัดคำทีละบรรทัด)
- **footer:** เขียนแค่ `<div class="closing"><h2>…</h2><p>…</p><div class="stack-icons"><span class="stack-icon">…</span></div></div>` + ใน head
  `<link rel="stylesheet" href="../common/closing.css">` `<script src="../common/closing.js" defer></script>`
  ห้ามก๊อป CSS `.closing`/`.mascot-half`/`.stack-icon` มาซ้ำ (มาสคอต + ลิงก์กลับ JS ใส่ให้เอง)
- meta title/description/og/twitter/canonical ชี้ `https://projects.tanplanet.work/<slug>-portfolio/`
- งานวิดีโอ/motion → คลิปสั้น 3–6 วิ ทีละเทคนิค การ์ดเล็กเล่นวนเอง (ดู `motion-reel-portfolio/`) ไม่ใช่คลิปยาว
- **ทุก section ต้องมีภาพประกอบอย่างน้อย 1 รูป** (อ่านลื่นแบบบทความ Medium): UI จริงของแพลตฟอร์มก่อนเสมอ > รูปในโปรเจกต์ > mockup > Unsplash (สุดท้าย, ดาวน์โหลดเก็บใน `img/` + เครดิต) · ใช้ `<figure class="shot">` · งานลูกค้า/บริษัท ใช้ภาพจริงแล้วเบลอโลโก้/ชื่อแบรนด์ · งานส่วนตัวไม่ต้องเบลอ · เบลอข้อมูลอ่อนไหวเสมอ (เงิน เลขบัญชี ชื่อคนจริง อีเมล key)
- ภาษาไทยเรียบ ๆ ประโยคสั้น เหมือนหน้าอ้างอิง

## 4. การ์ดในหน้ารวม `index.html`
- วางเป็น **การ์ดแรก** ใน `#projectsGrid` (เรียงตาม DOM) · `data-added="YYYY-MM-DD"` (วันนี้ → ขึ้นป้าย New เอง)
- markup เหมือนการ์ดข้าง ๆ: card-visual + badge-new + icon · card-type · h3 · p · card-tags · card-footer "Case Study — …"
- `data-category` ใช้ค่าที่มีอยู่: web-app / automation / design-thinking / tooling / content
- เพิ่ม JSON-LD ListItem (position ถัดไป + `numberOfItems`)
- รัน `python3 tools/gen-seo.py` → อัปเดต sitemap.xml + llms.txt จากการ์ด

## 5. ตรวจก่อน push
Playwright (`~/.claude/skills/playwright-skill/node_modules/playwright/index.mjs`, import ด้วย path เต็ม) ที่ 1280 และ 393:
ไม่ล้นแนวนอน · หัวการ์ด hack ไม่ตัดคำทีละบรรทัด · มาสคอตโผล่เหนือ footer · ไม่มี console error · grep หาคำต้องห้ามในข้อ 2

## 6. Publish
- `git add` เฉพาะไฟล์ของงานนี้ (repo มีไฟล์ค้างของโปรเจกต์อื่นเสมอ ห้าม `git add -A` ทั้ง repo)
- commit → push (ถ้า reject: `git pull --rebase --autostash` แล้ว push ใหม่ — มี cron MegaCoach commit เข้ามาตลอด)
- รอจน `curl https://projects.tanplanet.work/<slug>-portfolio/` ได้ 200 แล้วส่งลิงก์ให้แทน

## 6.5 ภาพประกอบที่ "ดูแล้วเข้าใจทันที" (แทนสั่ง 11 พ.ย. 2026 รอบ DEV panel)
- งานที่เป็นเครื่องมือ/ระบบ: ภาพ UI เดี่ยว ๆ ไม่พอ — ทำ **ภาพจอเต็มแบบใช้งานจริง** (ซ้าย = แอป/เว็บ · ขวา = IDE/เทอร์มินัล/แผง) จัดวางด้วย HTML แล้วแคป · ติด**ป้ายเลข ① ② ③ เหนือหน้าต่าง** (ไม่ทับเนื้อหา) · caption บอกตรง ๆ ว่าส่วนไหนจัดวาง/เป็นตัวอย่าง
- **อินโฟกราฟิก "ทำงานยังไงใน 1 ภาพ"**: กล่องหน้าต่าง + ตัวกลาง + เส้นไหลมีสี/ตัวอักษรกำกับ (A/B/C) + legend · ตัวหนังสือใหญ่พอให้อ่านที่ความกว้างคอลัมน์ (หัว ~64px บน canvas 2400)
- ภาพทุกภาพเท่าความกว้างคอลัมน์ · **มีไลท์บ็อกซ์** (คลิกขยาย · `<dialog>`) + โน้ตใต้ภาพ "คลิกภาพเพื่อขยาย"
- งานบริษัท: เบลอด้วย regex **ไม่สนตัวพิมพ์** (โดเมน/ชื่อไฟล์ตัวเล็กหลุดได้ เช่น design.<บริษัท>.ai) + ไล่ text node ทุกหน้าที่ถ่ายก่อนใช้ · หัวข้อไทยที่ตัดคำแปลก → `<span class="nb">` ครอบวลี

## 6.6 โพสต์ LinkedIn (แทนสั่ง 11 พ.ย. 2026: "ทำรูปแล้วโพสต์ลง LinkedIn · ติดล็อกอินเดี๋ยวล็อกอินให้")
1. **ภาพโพสต์ 4:5 (1080×1350)** — ภาพหลักให้ **Codex วาด** (`codex exec "…prompt…" -i ref1.jpg -i ref2.jpg` — ใส่ prompt **ก่อน** `-i` เพราะ `-i` รับหลายไฟล์แล้วกิน prompt) · สั่ง **ห้ามมีตัวหนังสือในภาพ** แล้ววางหัวข้อไทยด้วย HTML ทีหลัง (ตัวไทยที่ AI วาดเพี้ยน) · ภาพอ้างอิง = อินโฟกราฟิก/ภาพจอเต็มของหน้า
2. **ข้อความโพสต์ไทย** สั้น: hook 1 บรรทัด → 3–4 bullet ผลลัพธ์จริง (ตัวเลข) → ลิงก์ case study → hashtag 4–5 ตัว · ห้ามชื่อบริษัท/ลูกค้า (กติกาเดียวกับข้อ 2)
3. **ให้แทนดูภาพ + ข้อความก่อนเสมอ** — การโพสต์เป็นสาธารณะ ห้ามกดโพสต์เองโดยไม่ได้คำยืนยัน
4. โพสต์ผ่าน chrome-devtools MCP (เปิดแท็บด้านหน้าให้แทนเห็น) · ติดหน้าล็อกอิน = เปิด linkedin.com/login ทิ้งไว้แล้วบอกแทนให้ล็อกอิน · หลังโพสต์ เก็บลิงก์โพสต์ส่งให้แทน

## 7. Workflow: เติมภาพประกอบหลายหน้าพร้อมกัน (ใช้จริง 20 ต.ค. 2026 — แทนบอก "แบบนี้แหละ")
1. `python3 tools/portfolio-image-audit.py` → รายการ section ที่ยังไม่มีภาพ (ข้ามหน้าที่ gitignore = อยู่ repo อื่น)
2. แบ่งหน้าเป็นชุด ชุดละ ≤7 หน้า ตามประเภทงาน (ส่วนตัว / แอป live / extension-bot / งานบริษัท / งานดีไซน์) → spawn agent ชุดละตัว ส่งต่อ brief `image-brief.md` (ในโฟลเดอร์ skill นี้) + hint แหล่งภาพของแต่ละหน้า
3. agent ห้าม commit / ห้ามแตะ index.html, sitemap, llms.txt, common/ — แก้เฉพาะโฟลเดอร์หน้าของตัวเอง
4. ชุดไหนเสร็จ: เปิดดูภาพที่เสี่ยงเอง (แดชบอร์ด, ตาราง, หน้าที่มีตัวเลข) + grep คำต้องห้าม → `git add` เฉพาะโฟลเดอร์ของชุดนั้น → commit + push ทันที → สรุปให้แทนสั้น ๆ ทีละชุด
5. แทนเปลี่ยนกติกากลางทาง → อัปเดต image-brief.md แล้ว SendMessage บอก agent ที่ยังรันอยู่ทุกตัว
6. จบ: ย้ายไฟล์ภาพหลงที่ root ของ repo ออก · รัน audit อีกรอบให้ได้ "ครบแล้ว"
