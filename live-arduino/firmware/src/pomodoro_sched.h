// ตารางโพโมโดโร + เตือนกิจวัตร — คณิตศาสตร์ล้วน ไม่มี LVGL/Arduino จึงเทสต์บน Mac ได้
// เทสต์: g++ -std=c++17 firmware/test/pomodoro_sched_test.cpp -o /tmp/t && /tmp/t
#pragma once
#include <cstdio>
#include <cstddef>

// ค่าเริ่มต้น — หลังบ้านส่ง device.focus มาทับได้ทุกตัว (ตั้งที่ /manage ไม่ต้อง flash)
// ค่าที่ตั้งไว้นี่คือค่าที่ใช้ตอนยังดึงข้อมูลไม่ได้ ห้ามปล่อยว่าง
static int cfgWorkMin = 25;
static int cfgBreakMin = 5;
static int cfgWaterEvery = 60, cfgWaterFrom = 9 * 60, cfgWaterTo = 18 * 60;
static int cfgLunch = 12 * 60;
static int cfgOffWork = 18 * 60;

// นาทีของวันที่ต้องเตือนกินน้ำครั้งถัดไป (-1 = หมดโควตาวันนี้แล้ว)
inline int nextWaterMin(int nowMin) {
  if (nowMin >= cfgWaterTo) return -1;
  int t = cfgWaterFrom;
  while (t <= nowMin) t += cfgWaterEvery;
  return t <= cfgWaterTo ? t : -1;
}

// อันไหนถึงก่อน — คืนนาทีของวัน (-1 = วันนี้ไม่เหลือแล้ว) พร้อมชื่อไว้โชว์บนการ์ด
inline int nextRemindMin(int nowMin, const char** name) {
  const struct { const char* n; int m; } fixed[] = {{"ข้าวเที่ยง", cfgLunch},
                                                    {"เลิกงาน", cfgOffWork}};
  int best = nextWaterMin(nowMin);
  const char* bn = best >= 0 ? "กินน้ำ" : nullptr;
  for (const auto& f : fixed)
    // <= เพราะ 12:00 เป็นทั้งรอบกินน้ำและข้าวเที่ยง — ให้ตัวที่สำคัญกว่าชนะ
    if (f.m > nowMin && (best < 0 || f.m <= best)) { best = f.m; bn = f.n; }
  *name = bn;
  return best;
}

// นาทีนี้ถึงเวลาเตือนไหม (เรียกนาทีละครั้ง) — nullptr = ยังไม่ถึง
inline const char* remindDueAt(int nowMin) {
  if (nowMin == cfgLunch) return "ได้เวลาข้าวเที่ยง";
  if (nowMin == cfgOffWork) return "เลิกงานแล้ว";
  if (nowMin >= cfgWaterFrom && nowMin <= cfgWaterTo &&
      (nowMin - cfgWaterFrom) % cfgWaterEvery == 0)
    return "ได้เวลากินน้ำ";
  return nullptr;
}

// มิลลิวินาที → "MM:SS" (ปัดขึ้น: กดเริ่มต้องเห็น 25:00 ไม่ใช่ 24:59)
inline void fmtMMSS(char* out, size_t n, unsigned long ms) {
  unsigned long s = (ms + 999) / 1000;
  snprintf(out, n, "%02lu:%02lu", s / 60, s % 60);
}
