// ตารางโพโมโดโร + เตือนกิจวัตร — คณิตศาสตร์ล้วน ไม่มี LVGL/Arduino จึงเทสต์บน Mac ได้
// เทสต์: g++ -std=c++17 firmware/test/pomodoro_sched_test.cpp -o /tmp/t && /tmp/t
#pragma once
#include <cstdio>
#include <cstddef>

// ponytail: knob ทั้งหมดอยู่ 5 บรรทัดนี้ — อยากเปลี่ยนเวลาก็แก้แล้ว flash ใหม่
static const int kPomoWorkMin = 25;
static const int kPomoBreakMin = 5;
static const int kWaterEveryMin = 60, kWaterFromMin = 9 * 60, kWaterToMin = 18 * 60;
static const int kLunchMin = 12 * 60;
static const int kOffWorkMin = 18 * 60;

// นาทีของวันที่ต้องเตือนกินน้ำครั้งถัดไป (-1 = หมดโควตาวันนี้แล้ว)
inline int nextWaterMin(int nowMin) {
  if (nowMin >= kWaterToMin) return -1;
  int t = kWaterFromMin;
  while (t <= nowMin) t += kWaterEveryMin;
  return t <= kWaterToMin ? t : -1;
}

// อันไหนถึงก่อน — คืนนาทีของวัน (-1 = วันนี้ไม่เหลือแล้ว) พร้อมชื่อไว้โชว์บนการ์ด
inline int nextRemindMin(int nowMin, const char** name) {
  const struct { const char* n; int m; } fixed[] = {{"ข้าวเที่ยง", kLunchMin},
                                                    {"เลิกงาน", kOffWorkMin}};
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
  if (nowMin == kLunchMin) return "ได้เวลาข้าวเที่ยง";
  if (nowMin == kOffWorkMin) return "เลิกงานแล้ว";
  if (nowMin >= kWaterFromMin && nowMin <= kWaterToMin &&
      (nowMin - kWaterFromMin) % kWaterEveryMin == 0)
    return "ได้เวลากินน้ำ";
  return nullptr;
}

// มิลลิวินาที → "MM:SS" (ปัดขึ้น: กดเริ่มต้องเห็น 25:00 ไม่ใช่ 24:59)
inline void fmtMMSS(char* out, size_t n, unsigned long ms) {
  unsigned long s = (ms + 999) / 1000;
  snprintf(out, n, "%02lu:%02lu", s / 60, s % 60);
}
