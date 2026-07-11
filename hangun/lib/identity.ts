// ============================================================
// หารกัน (HanGun) — browser identity (no-login model)
// remembers which member you are in each project, in localStorage
// CLIENT-ONLY — call from Client Components / effects
// ============================================================

export type Joined = {
  code: string;
  projectName: string;
  memberId: string;
  ownerToken?: string;
  joinedAt: number;
};

const KEY = 'hangun.joined.v1';

function readAll(): Record<string, Joined> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, Joined>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

export function listJoined(): Joined[] {
  return Object.values(readAll()).sort((a, b) => b.joinedAt - a.joinedAt);
}

export function getJoined(code: string): Joined | undefined {
  return readAll()[code];
}

export function saveJoined(j: Joined): void {
  const map = readAll();
  map[j.code] = j;
  writeAll(map);
}

export function removeJoined(code: string): void {
  const map = readAll();
  delete map[code];
  writeAll(map);
}
