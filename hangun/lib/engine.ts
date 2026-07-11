// ============================================================
// หารกัน (HanGun) — calculation engine
// framework-agnostic pure functions (ported + verified from the
// HTML prototype, matches the reference example exactly)
// ============================================================

import type { Member, Expense, Settlement } from './types';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** split an amount equally across n people, distributing leftover satang so the sum is exact */
export function splitEqual(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / n);
  const rem = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / 100);
}

/** who consumed how much in this expense → { memberId: amount } */
export function memberShares(e: Expense): Record<string, number> {
  if (e.kind === 'debt') {
    return e.counterId ? { [e.counterId]: round2(e.amount) } : {};
  }
  const out: Record<string, number> = {};
  for (const s of e.shares) out[s.memberId] = round2(s.amount);
  return out;
}

/** who fronted the money (expense: payer · debt: lender) */
export function payerOf(e: Expense): string | null {
  return e.payerId;
}

export function participantCount(e: Expense): number {
  if (e.kind === 'debt') return 1;
  return e.shares.filter((s) => s.amount > 0).length;
}

export type PerPersonRow = { paid: number; owed: number; net: number };
export type PerPerson = Record<string, PerPersonRow>;

/** per-person summary: paid (fronted), owed (consumed), net (= paid − owed) */
export function perPerson(members: Member[], expenses: Expense[]): PerPerson {
  const res: PerPerson = {};
  for (const m of members) res[m.id] = { paid: 0, owed: 0, net: 0 };
  for (const e of expenses) {
    const payer = payerOf(e);
    if (payer && res[payer]) res[payer].paid += e.amount;
    for (const [id, amt] of Object.entries(memberShares(e))) {
      if (res[id]) res[id].owed += amt;
    }
  }
  for (const r of Object.values(res)) {
    r.paid = round2(r.paid);
    r.owed = round2(r.owed);
    r.net = round2(r.paid - r.owed);
  }
  return res;
}

/** raw debts: debts[debtorId][creditorId] = amount the debtor owes the creditor */
export function rawDebts(
  members: Member[],
  expenses: Expense[],
): Record<string, Record<string, number>> {
  const d: Record<string, Record<string, number>> = {};
  for (const m of members) d[m.id] = {};
  for (const e of expenses) {
    const payer = payerOf(e);
    if (!payer) continue;
    for (const [id, amt] of Object.entries(memberShares(e))) {
      if (id === payer || amt <= 0 || !d[id]) continue;
      d[id][payer] = round2((d[id][payer] || 0) + amt);
    }
  }
  return d;
}

export type Transfer = { from: string; to: string; amount: number };

/** greedy min-cash-flow: turn a net-balance map into the fewest transfers */
function simplifyDebts(net: Record<string, number>): Transfer[] {
  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];
  for (const [id, n] of Object.entries(net)) {
    if (n > 0.005) creditors.push({ id, amt: n });
    else if (n < -0.005) debtors.push({ id, amt: -n });
  }
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: round2(pay) });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.005) i++;
    if (creditors[j].amt < 0.005) j++;
  }
  return out;
}

/**
 * outstanding transfers — fewest transfers still needed, AFTER applying
 * settlements (money members have already paid each other back).
 */
export function outstandingTransfers(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[] = [],
): Transfer[] {
  const pp = perPerson(members, expenses);
  const net: Record<string, number> = {};
  for (const m of members) net[m.id] = pp[m.id].net;
  for (const s of settlements) {
    // payer's debt shrinks, receiver's credit shrinks
    if (net[s.fromMember] !== undefined) net[s.fromMember] = round2(net[s.fromMember] + s.amount);
    if (net[s.toMember] !== undefined) net[s.toMember] = round2(net[s.toMember] - s.amount);
  }
  return simplifyDebts(net);
}

/** total shared spend (excludes personal debts) */
export function projectTotal(expenses: Expense[]): number {
  return round2(expenses.reduce((s, e) => s + (e.kind === 'expense' ? e.amount : 0), 0));
}
