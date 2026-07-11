// ============================================================
// หารกัน (HanGun) — presentation helpers
// ============================================================

import { round2 } from './engine';

export type CategoryDef = { id: string; label: string; emoji: string };

export const CATEGORIES: CategoryDef[] = [
  { id: 'food', label: 'ค่ากิน', emoji: '🍜' },
  { id: 'transport', label: 'ค่าเดินทาง', emoji: '🚕' },
  { id: 'stay', label: 'ที่พัก', emoji: '🏨' },
  { id: 'shopping', label: 'ช้อปปิ้ง', emoji: '🛍️' },
  { id: 'activity', label: 'กิจกรรม', emoji: '🎉' },
  { id: 'other', label: 'อื่นๆ', emoji: '📦' },
];

export const catOf = (id: string): CategoryDef =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[5];

/** format baht — `|| 0` guards against -0 / NaN reaching the screen */
export function money(n: number, rounded = false): string {
  const v = (rounded ? Math.ceil(round2(n) - 1e-9) : round2(n)) || 0;
  return (
    '฿' +
    v.toLocaleString('en-US', rounded
      ? { maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export const AVATAR_COLORS = [
  '#6366F1', '#0EA5E9', '#0D9488', '#F59E0B',
  '#EF4444', '#EC4899', '#8B5CF6', '#F97316',
];

/** stable avatar colour derived from an id */
export function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const initial = (name: string): string =>
  (name || '?').trim().charAt(0) || '?';
