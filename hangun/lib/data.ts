// ============================================================
// หารกัน (HanGun) — server-side data access (SERVER-ONLY)
// ============================================================

import { supabaseAdmin } from './supabase';
import type { Project, Member, Expense, ExpenseShare, Settlement } from './types';

type MemberRow = {
  id: string; name: string; photo_url: string | null;
  payment_qr_url: string | null; is_owner: boolean;
};
type ExpenseRow = {
  id: string; kind: 'expense' | 'debt'; category: string; title: string;
  amount: string | number; payer_id: string | null; counter_id: string | null;
  split_mode: 'equal' | 'custom'; created_by: string | null;
};
type ShareRow = { expense_id: string; member_id: string; amount: string | number };

function mapMember(r: MemberRow): Member {
  return {
    id: r.id,
    name: r.name,
    photoUrl: r.photo_url,
    paymentQrUrl: r.payment_qr_url,
    isOwner: r.is_owner,
  };
}

function mapExpense(r: ExpenseRow, shares: ShareRow[]): Expense {
  return {
    id: r.id,
    kind: r.kind,
    category: r.category,
    title: r.title,
    amount: Number(r.amount),
    payerId: r.payer_id,
    counterId: r.counter_id,
    splitMode: r.split_mode,
    createdBy: r.created_by,
    shares: shares
      .filter((s) => s.expense_id === r.id)
      .map<ExpenseShare>((s) => ({ memberId: s.member_id, amount: Number(s.amount) })),
  };
}

/** raw project row incl. the secret owner_token (used to verify ownership) */
export async function getProjectRow(code: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from('projects')
    .select('*')
    .eq('join_code', code)
    .maybeSingle();
  return data as { id: string; name: string; join_code: string; owner_token: string } | null;
}

/** full project graph for rendering */
export async function getProjectByCode(code: string): Promise<Project | null> {
  const db = supabaseAdmin();
  const proj = await getProjectRow(code);
  if (!proj) return null;

  const [{ data: members }, { data: expenses }, { data: settlements }] = await Promise.all([
    db.from('members').select('*').eq('project_id', proj.id).order('created_at'),
    db.from('expenses').select('*').eq('project_id', proj.id).order('created_at', { ascending: false }),
    db.from('settlements').select('*').eq('project_id', proj.id).order('created_at', { ascending: false }),
  ]);

  const expRows = (expenses ?? []) as ExpenseRow[];
  let shares: ShareRow[] = [];
  if (expRows.length) {
    const { data } = await db
      .from('expense_shares')
      .select('*')
      .in('expense_id', expRows.map((e) => e.id));
    shares = (data ?? []) as ShareRow[];
  }

  type SettlementRow = {
    id: string; from_member: string; to_member: string;
    amount: string | number; slip_url: string | null;
    slip_ref: string | null; note: string | null;
  };

  return {
    id: proj.id,
    name: proj.name,
    joinCode: proj.join_code,
    members: ((members ?? []) as MemberRow[]).map(mapMember),
    expenses: expRows.map((e) => mapExpense(e, shares)),
    settlements: ((settlements ?? []) as SettlementRow[]).map<Settlement>((s) => ({
      id: s.id,
      fromMember: s.from_member,
      toMember: s.to_member,
      amount: Number(s.amount),
      slipUrl: s.slip_url,
      slipRef: s.slip_ref,
      note: s.note,
    })),
  };
}
