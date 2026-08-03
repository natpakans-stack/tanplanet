// node backend/claude-sessions.test.mjs
import assert from "node:assert/strict";
import { sessionState } from "./live-sources.mjs";

const NOW = Date.parse("2026-08-03T10:00:00Z");
const at = (secAgo, e) => ({ ts: NOW - secAgo * 1000, cwd: "/x/live-arduino", branch: "main", ...e });

// เพิ่งเรียกเครื่องมือเมื่อกี้ = ยังทำงานอยู่ และต้องรู้ว่าเครื่องมือไหน
assert.deepEqual(
  (({ state, tool }) => ({ state, tool }))(
    sessionState([at(30, { role: "assistant", tool: "Bash" })], NOW)),
  { state: "busy", tool: "Bash" },
);

// tool_result เด้งกลับมาแล้ว แต่ tool ล่าสุดยังนับจากข้อความของ Claude
assert.equal(
  sessionState([at(40, { role: "assistant", tool: "Edit" }), at(38, { role: "user", tool: null })], NOW).tool,
  "Edit",
);

// พูดจบแล้วเงียบไป 5 นาที = รอคนตอบ (สถานะเดียวที่ต้องเด้ง)
assert.equal(sessionState([at(300, { role: "assistant", tool: null })], NOW).state, "waiting");

// เงียบหลังเรียกเครื่องมือ = ค้าง/ตายไปแล้ว ไม่ใช่รอคำตอบ
assert.equal(sessionState([at(300, { role: "assistant", tool: "Bash" })], NOW).state, "idle");

// เงียบเกินครึ่งชั่วโมง = จบไปแล้ว
assert.equal(sessionState([at(3600, { role: "assistant", tool: null })], NOW).state, "idle");

assert.equal(sessionState([], NOW), null);

console.log("ok");
