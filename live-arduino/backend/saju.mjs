// สาจู/ปาจื้อ เท่าที่จอต้องใช้ — เสาวัน เสายาม และพลังงานรายชั่วโมงเทียบธาตุเจ้าเรือน
//
// ไม่ได้ลอกมาจากแอป saju-kaaju (ไฟล์ที่มีเป็นเวอร์ชันก่อนมีหน้าปฏิทิน) แต่ใช้วิธีมาตรฐาน:
//   เสาวัน  → วัฏจักร 60 จากเลขวันจูเลียน
//   เสายาม → 五鼠遁 คำนวณก้านยามจากก้านวัน
//   พลังงาน → ความสัมพันธ์ธาตุ (เกิด/ข่ม) ระหว่างธาตุยามกับธาตุเจ้าเรือน (日干)

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// ธาตุ 0=ไม้ 1=ไฟ 2=ดิน 3=ทอง 4=น้ำ — เรียงตามวงจรเกิด (ไม้→ไฟ→ดิน→ทอง→น้ำ→ไม้)
const STEM_ELEM = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
const BRANCH_ELEM = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
const ELEM_TH = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"];
const ELEM_COLOR = [
  { name: "เขียว", hex: "4ADE80" },
  { name: "แดง", hex: "F87171" },
  { name: "เหลืองดิน", hex: "D9A441" },
  { name: "ขาวทอง", hex: "E8E4D9" },
  { name: "น้ำเงินเข้ม", hex: "60A5FA" },
];

function julianDay(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/** เสาวันของวันที่นั้น (ตามปฏิทินสุริยคติ ไม่ปรับเวลาสุริยะจริง) */
export function dayPillar(y, m, d) {
  const jdn = julianDay(y, m, d);
  const s = (jdn + 9) % 10;
  const b = (jdn + 1) % 12;
  return { s, b, label: STEMS[s] + BRANCHES[b], elem: STEM_ELEM[s] };
}

/** ยามจีน 12 ยาม — 子 คือ 23:00-01:00 จึงต้องบวก 1 ก่อนหาร */
export function hourBranch(hour) {
  return Math.floor(((hour + 1) % 24) / 2);
}

/** 五鼠遁: ก้านยามคำนวณจากก้านวัน */
export function hourStem(dayStem, branch) {
  return (dayStem * 2 + branch) % 10;
}

// ระดับพลังงาน 2 ดี / 1 ท้าทาย / 0 ระวัง
// เกณฑ์นี้ย้อนมาจากหน้าปฏิทินของแอป saju-kaaju (วัน 丁未 1 ส.ค. 2569): ช่วงที่แอปทำเป็น
// "พลังดี" ตรงกับยามที่ก้าน (天干) เป็นธาตุพี่น้องหรือธาตุที่มาเกิดเรา ส่วน "ควรระวัง"
// ตรงกับธาตุที่เราไปข่มและธาตุที่มาข่มเรา — ใช้ธาตุของก้านยาม ไม่ใช่ธาตุของกิ่ง
const LEVEL_TH = ["ควรระวัง", "ท้าทาย", "พลังดี"];
const LEVEL_NOTE = [
  "แรงกดดันจากข้างนอกเยอะ เลี่ยงตัดสินใจใหญ่",
  "ต้องออกแรงกว่าปกติ เหมาะกับงานที่ต้องเคี่ยว",
  "เหมาะกับการแสดงออก เสนอ และเริ่มเรื่องใหม่",
];

function level(dmElem, elem) {
  if (elem === dmElem) return 2;                    // 比 ธาตุเดียวกัน
  if ((elem + 1) % 5 === dmElem) return 2;          // 印 ธาตุที่มาเกิดเรา
  if ((dmElem + 1) % 5 === elem) return 1;          // 食傷 ธาตุที่เราไปเกิด
  return 0;                                          // 財 / 官殺 ธาตุที่ข่มกัน
}

/**
 * พลังงานรายยามของวันนั้น เทียบกับธาตุเจ้าเรือนของเจ้าของดวง
 * birth = {y,m,d} — ถ้าไม่มีจะคืนแค่ข้อมูลของวัน ไม่มีคะแนนส่วนตัว
 */
export function sajuDay(date, birth) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const today = dayPillar(y, m, d);
  const out = {
    pillar: today.label,
    dayElem: ELEM_TH[today.elem],
    color: ELEM_COLOR[today.elem],
    blocks: null,
    now: null,
    dm: null,
  };
  if (!birth?.y) return out;

  const natal = dayPillar(birth.y, birth.m, birth.d);
  out.dm = { label: STEMS[natal.s], elem: ELEM_TH[natal.elem] };

  // 12 ยาม เริ่มที่ 子 (23:00) — เก็บเป็นชั่วโมงเริ่มต้นจริงเพื่อให้จอ label ได้ตรง
  out.blocks = BRANCHES.map((_, b) => {
    const st = hourStem(today.s, b);
    const elem = STEM_ELEM[st];
    const lv = level(natal.elem, elem);
    return {
      h: (b * 2 + 23) % 24,
      label: STEMS[st] + BRANCHES[b],
      elem: ELEM_TH[elem],
      lv,
      lvLabel: LEVEL_TH[lv],
    };
  });

  const b = hourBranch(date.getHours());
  out.now = { ...out.blocks[b], note: LEVEL_NOTE[out.blocks[b].lv] };
  return out;
}

/** ระดับพลังงานของทั้งวัน (ค่าเฉลี่ยของ 12 ยาม) — ใช้ทำจุดสีในปฏิทินรายเดือน */
export function sajuMonth(y, m, birth) {
  if (!birth?.y) return [];
  const days = new Date(y, m, 0).getDate();
  const out = [];
  for (let d = 1; d <= days; d++) {
    const info = sajuDay(new Date(y, m - 1, d, 12), birth);
    const avg = info.blocks.reduce((a, x) => a + x.lv, 0) / info.blocks.length;
    out.push({ d, lv: avg >= 1.5 ? 2 : avg >= 0.8 ? 1 : 0 });
  }
  return out;
}
