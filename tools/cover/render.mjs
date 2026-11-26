// engine ปกผลงาน: pj/covers.json → pj/covers/<slug>-<lang>.png (1600×900) — รันมือ: node tools/cover/render.mjs [slug…]
// ไม่มีอะไรรันเอง · ข้อความปกเขียนลง covers.json (Claude ในเครื่องเขียนให้เมื่อแทนสั่ง) · แปลงเป็น webp/jpg ด้วย tools/cover/finish.py
import { chromium } from '/Users/natpakansirirat/.claude/skills/playwright-skill/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'pj/covers.json'), 'utf8'));
const dDir = path.join(ROOT, 'pj/covers.d');   // ส่วนที่ agent แต่ละตัวเขียนแยกไฟล์ (รวมทับ covers.json)
if (fs.existsSync(dDir)) for (const f of fs.readdirSync(dDir).filter(f => f.endsWith('.json'))) Object.assign(data, JSON.parse(fs.readFileSync(path.join(dDir, f), 'utf8')));
const tpl = fs.readFileSync(path.join(ROOT, 'tools/cover/template.html'), 'utf8');
const BG = { magenta:'linear-gradient(135deg,#fce7f3,#fbcfe8)', blue:'linear-gradient(135deg,#dbeafe,#bfdbfe)', cyan:'linear-gradient(135deg,#cffafe,#a5f3fc)',
  green:'linear-gradient(135deg,#d1fae5,#a7f3d0)', orange:'linear-gradient(135deg,#ffedd5,#fed7aa)', purple:'linear-gradient(135deg,#ede9fe,#ddd6fe)',
  yellow:'linear-gradient(135deg,#fef9c3,#fde68a)', red:'linear-gradient(135deg,#fee2e2,#fecaca)', gold:'linear-gradient(135deg,#f5e6c8,#ead2a4)' };
const ICON = { 'Web App':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>', 'Automation':'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  'Design Thinking':'<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>', 'Tooling':'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  'Content':'<path d="M4 4h16v16H4z"/><path d="m10 9 5 3-5 3z"/>' };
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const L = { th:{ type:'ประเภท', status:'สถานะ', me:'ผู้ออกแบบ', done:'เสร็จแล้ว', wip:'กำลังทำ' }, en:{ type:'Type', status:'Status', me:'Designer', done:'Complete', wip:'In progress' } };
const avatar = pathToFileURL(path.join(ROOT, 'tanplanet-sites/myfolio/_ext/cdn.prod.website-files.com/608d62778637273e1880cb8d/688f5899cad39483c4e11c49_Profile_Webflow.webp')).href;
const only = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' }); const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
for (const [slug, c] of Object.entries(data)) {
  if (only.length && !only.includes(slug)) continue;
  for (const lang of ['th', 'en']) {
    const t = c[lang]; if (!t) continue;
    const img = pathToFileURL(path.join(ROOT, slug, c.image)).href;
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const html = tpl.replaceAll('{{BG}}', BG[c.color] || BG.green).replaceAll('{{LANG}}', lang)
      .replace('{{TAGS}}', t.tags.map(x => `<span class="tag">${esc(x)}</span>`).join(''))
      .replace('{{TITLE}}', esc(t.title).replace(/\n/g, '<br>'))
      .replace('{{K_TYPE}}', L[lang].type).replace('{{K_STATUS}}', L[lang].status).replace('{{K_ME}}', L[lang].me)
      .replace('{{TYPE_ICON}}', svg(ICON[c.type] || ICON['Web App'])).replace('{{TYPE}}', c.type)
      .replace('{{STATUS_CLS}}', c.status === 'wip' ? 'wip' : '').replace('{{STATUS}}', L[lang][c.status === 'wip' ? 'wip' : 'done'])
      .replace('{{AVATAR}}', avatar).replace('{{IMAGE}}', img).replace('{{SHOT_CLS}}', c.phone ? 'phone' : '');
    const tmp = path.join(ROOT, `tools/cover/.tmp-${slug}-${lang}.html`); fs.writeFileSync(tmp, html);
    await p.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(ROOT, `pj/covers/${slug}-${lang}.png`) });
    fs.unlinkSync(tmp); console.log('ok', slug, lang);
  }
}
await b.close();
