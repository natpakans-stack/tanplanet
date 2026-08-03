// g++ -std=c++17 firmware/test/pomodoro_sched_test.cpp -o /tmp/t && /tmp/t
#include <cassert>
#include <cstring>
#include "../src/pomodoro_sched.h"

int main() {
  // กินน้ำทุกชั่วโมง 9:00–18:00
  assert(nextWaterMin(8 * 60) == 9 * 60);       // ก่อนเริ่มงาน → นัดแรก 9:00
  assert(nextWaterMin(9 * 60) == 10 * 60);      // ตรงเวลาพอดี → อันถัดไป
  assert(nextWaterMin(9 * 60 + 1) == 10 * 60);
  assert(nextWaterMin(17 * 60 + 30) == 18 * 60);
  assert(nextWaterMin(18 * 60) == -1);          // เลิกงานแล้วไม่ต้องเตือน

  const char* nm = nullptr;
  assert(nextRemindMin(9 * 60 + 5, &nm) == 10 * 60 && !strcmp(nm, "กินน้ำ"));
  assert(nextRemindMin(11 * 60 + 30, &nm) == kLunchMin && !strcmp(nm, "ข้าวเที่ยง"));
  assert(nextRemindMin(17 * 60 + 30, &nm) == kOffWorkMin && !strcmp(nm, "เลิกงาน"));
  assert(nextRemindMin(19 * 60, &nm) == -1 && nm == nullptr);

  // ชนกัน (12:00 เป็นทั้งรอบน้ำและข้าวเที่ยง) → ข้าวเที่ยงต้องชนะ
  assert(!strcmp(remindDueAt(12 * 60), "ได้เวลาข้าวเที่ยง"));
  assert(!strcmp(remindDueAt(10 * 60), "ได้เวลากินน้ำ"));
  assert(remindDueAt(10 * 60 + 1) == nullptr);
  assert(!strcmp(remindDueAt(18 * 60), "เลิกงานแล้ว"));

  char b[8];
  fmtMMSS(b, sizeof(b), 25UL * 60000UL); assert(!strcmp(b, "25:00"));
  fmtMMSS(b, sizeof(b), 1);              assert(!strcmp(b, "00:01"));
  fmtMMSS(b, sizeof(b), 0);              assert(!strcmp(b, "00:00"));
  puts("pomodoro_sched ok");
}
