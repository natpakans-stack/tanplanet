// ปฏิทินจันทรคติไทย — คำนวณ ขึ้น/แรม X ค่ำ เดือน Y และวันพระ
//
// ใช้สูตรสุริยยาตร์ (ค่าคงที่จากตำราโบราณ) หาว่าปีไหนเป็นอธิกมาส/อธิกวาร
// แล้วนับวันจากวันลอยกระทง (ขึ้น 15 ค่ำ เดือน 12) ที่รู้แน่นอนเป็นจุดอ้างอิง
//
// ตรวจความถูกต้องด้วย `node backend/thai-lunar.mjs` — เทียบกับวันพระใหญ่จริง

const ERA_DAYS = 292207;
const ERA_HORAKHUN = 373;
const KAMMACUBALA_DAILY = 800;
const CYCLE_SOLAR = 692;
const CYCLE_DAILY = 11;
const CS_DIFF = 638; // ค.ศ. → จุลศักราช

// ลอยกระทง 2558 = ขึ้น 15 ค่ำ เดือน 12 — จุดอ้างอิงที่ยืนยันได้จากปฏิทินจริง
const EPOCH_KATTIKA = Date.UTC(2015, 10, 25);
const DAY_MS = 86400000;

function suriyaYear(ce) {
  const a = (ce - CS_DIFF) * ERA_DAYS + ERA_HORAKHUN;
  const horakhun = Math.floor(a / KAMMACUBALA_DAILY) + 1;
  const kammacubala = KAMMACUBALA_DAILY - (a % KAMMACUBALA_DAILY);
  const ai = horakhun * CYCLE_DAILY + 650;
  return { avoman: ai % CYCLE_SOLAR, kammacubala, tithi: (Math.floor(ai / CYCLE_SOLAR) + horakhun) % 30 };
}

function mightBeAdhikamasa(ce) {
  const t = suriyaYear(ce).tithi;
  return (t >= 24 && t <= 29) || t <= 5;
}

// อธิกมาส = ปีที่มีเดือน 8 สองหน (ปีนั้นยาว 384 วัน)
function isAdhikamasa(ce) {
  return mightBeAdhikamasa(ce) && !mightBeAdhikamasa(ce + 1);
}

function mightBeAdhikavara(ce) {
  const y = suriyaYear(ce);
  return y.kammacubala <= 207 ? y.avoman <= 126 : y.avoman < 137;
}

// อธิกวาร = ปีที่เดือน 7 มี 30 วันแทน 29 (ปีนั้นยาว 355 วัน)
function isAdhikavara(ce) {
  if (isAdhikamasa(ce)) return false;
  if (isAdhikamasa(ce - 1) && mightBeAdhikavara(ce - 1)) return true;
  return mightBeAdhikavara(ce);
}

function yearLength(ce) {
  if (isAdhikamasa(ce)) return 384;
  if (isAdhikavara(ce)) return 355;
  return 354;
}

// ลอยกระทง (ขึ้น 15 ค่ำ เดือน 12) ของปี ค.ศ. ที่ระบุ
function kattikaOf(ce) {
  let ms = EPOCH_KATTIKA;
  let y = 2015;
  while (y < ce) ms += yearLength(++y) * DAY_MS;
  while (y > ce) ms -= yearLength(y--) * DAY_MS;
  return ms;
}

// ลำดับเดือนหลังเดือน 12 — ปีอธิกมาสแทรกเดือน 8 หลัง (คืนค่าเป็น 88)
function monthSequence(adhikamasa) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8];
  if (adhikamasa) months.push(88);
  return [...months, 9, 10, 11, 12];
}

// เดือนคี่ 29 วัน (เดือนขาด) · เดือนคู่ 30 วัน (เดือนถ้วน)
// เดือน 7 ของปีอธิกวารได้ 30 วัน · เดือน 8 หลัง (88) ได้ 30 วัน
function monthLength(month, { adhikavara }) {
  if (month === 88) return 30;
  if (month === 7 && adhikavara) return 30;
  return month % 2 === 1 ? 29 : 30;
}

/**
 * แปลงวันสุริยคติ → วันจันทรคติไทย
 * @param {Date} date
 * @returns {{phase:'ขึ้น'|'แรม', day:number, month:number, monthLabel:string, isUposatha:boolean, label:string}}
 */
export function thaiLunar(date) {
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  // หาลอยกระทงครั้งล่าสุดก่อนวันที่ต้องการ แล้วนับเดินหน้าทีละเดือนจันทรคติ
  let year = date.getFullYear();
  let cursor = kattikaOf(year);
  if (cursor > target) cursor = kattikaOf(--year);

  // จากขึ้น 15 ค่ำ เดือน 12 → แรม 1 ค่ำ เดือน 12 คือวันถัดไป
  let month = 12;
  let ctx = { adhikavara: isAdhikavara(year + 1) };
  let waningStart = cursor + DAY_MS; // แรม 1 ค่ำ เดือน 12
  let waningLen = monthLength(12, ctx) - 15;

  if (target <= cursor) {
    // อยู่ในครึ่งขึ้นของเดือน 12 — ถอยจากขึ้น 15 ค่ำ
    const back = Math.round((cursor - target) / DAY_MS);
    return format("ขึ้น", 15 - back, 12);
  }

  // ครึ่งแรมของเดือน 12
  if (target < waningStart + waningLen * DAY_MS) {
    return format("แรม", Math.round((target - waningStart) / DAY_MS) + 1, 12);
  }

  let ms = waningStart + waningLen * DAY_MS; // ขึ้น 1 ค่ำ เดือนถัดไป
  const nextYear = year + 1;
  ctx = { adhikavara: isAdhikavara(nextYear) };
  for (const m of monthSequence(isAdhikamasa(nextYear))) {
    const len = monthLength(m, ctx);
    if (target < ms + len * DAY_MS) {
      const offset = Math.round((target - ms) / DAY_MS);
      return offset < 15
        ? format("ขึ้น", offset + 1, m)
        : format("แรม", offset - 14, m);
    }
    ms += len * DAY_MS;
    month = m;
  }
  return format("ขึ้น", 1, month); // ไม่ควรถึงตรงนี้ — กันพลาดปีที่ตารางไม่ครอบคลุม
}

function format(phase, day, month) {
  const monthLabel = month === 88 ? "8-8" : String(month);
  // วันพระ = ขึ้น 8, ขึ้น 15, แรม 8, แรม 14/15
  const isUposatha = day === 8 || day === 15 || (phase === "แรม" && day === 14);
  return {
    phase, day, month, monthLabel, isUposatha,
    label: `${phase} ${day} ค่ำ เดือน ${monthLabel}`,
  };
}

/** วันพระถัดไปนับจากวันที่ระบุ (ไม่รวมวันนั้น) */
export function nextUposatha(from) {
  for (let i = 1; i <= 20; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const lu = thaiLunar(d);
    if (lu.isUposatha) return { date: d, ...lu };
  }
  return null;
}

// self-check: เทียบกับวันพระใหญ่จริงจากปฏิทินราชการ (ทุกวันคือขึ้น 15 ค่ำ)
function demo() {
  const cases = [
    ["2026-03-03", "มาฆบูชา", 15, "ขึ้น"],
    ["2026-05-31", "วิสาขบูชา", 15, "ขึ้น"],
    ["2026-07-29", "อาสาฬหบูชา", 15, "ขึ้น"],
    ["2026-07-30", "เข้าพรรษา", 1, "แรม"],
    ["2015-11-25", "ลอยกระทง 2558", 15, "ขึ้น"],
    ["2026-11-24", "ลอยกระทง 2569", 15, "ขึ้น"],
  ];
  let failed = 0;
  for (const [iso, name, day, phase] of cases) {
    const [y, m, d] = iso.split("-").map(Number);
    const lu = thaiLunar(new Date(y, m - 1, d));
    const ok = lu.day === day && lu.phase === phase;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${iso} ${name.padEnd(14)} → ${lu.label}`);
  }
  console.log(`\nอธิกมาส 2026: ${isAdhikamasa(2026)} · อธิกวาร 2026: ${isAdhikavara(2026)}`);
  const n = nextUposatha(new Date(2026, 6, 25));
  console.log(`วันพระถัดไปจาก 25 ก.ค. 2026: ${n.date.toISOString().slice(0, 10)} (${n.label})`);
  if (failed) {
    console.error(`\n${failed} เคสไม่ผ่าน`);
    process.exit(1);
  }
  console.log("\nผ่านทุกเคส");
}

if (import.meta.url === `file://${process.argv[1]}`) demo();
