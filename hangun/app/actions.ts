'use server';

// ============================================================
// หารกัน (HanGun) — server actions
// every DB mutation goes through here (service_role, bypasses RLS)
// ============================================================

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import { getProjectRow } from '@/lib/data';
import { makeJoinCode, makeOwnerToken } from '@/lib/ids';
import { round2 } from '@/lib/engine';

/** upload an image File to Supabase Storage, return its public URL */
async function uploadImage(file: FormDataEntryValue | null, folder: string): Promise<string | null> {
  if (!file || typeof file === 'string') return null;
  const f = file as File;
  if (!f.size) return null;
  const db = supabaseAdmin();
  const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${folder}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await f.arrayBuffer());
  const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, buf, {
    contentType: f.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + error.message);
  return db.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** assert an image file is present (uploads are mandatory for the payment QR) */
function requireImage(file: FormDataEntryValue | null, label: string) {
  if (!file || typeof file === 'string' || !(file as File).size) {
    throw new Error(`กรุณาอัปโหลด${label}`);
  }
}

async function requireProject(code: string) {
  const proj = await getProjectRow(code);
  if (!proj) throw new Error('ไม่พบ Project นี้');
  return proj;
}

async function requireOwner(code: string, ownerToken: string) {
  const proj = await requireProject(code);
  if (proj.owner_token !== ownerToken) throw new Error('ต้องเป็นเจ้าของ Project เท่านั้น');
  return proj;
}

// ---- create project (owner) -----------------------------------
export type CreateResult = { joinCode: string; ownerToken: string; memberId: string };

export async function createProject(fd: FormData): Promise<CreateResult> {
  const name = String(fd.get('name') || '').trim();
  const ownerName = String(fd.get('ownerName') || '').trim();
  if (!name) throw new Error('กรุณาตั้งชื่อ Project');
  if (!ownerName) throw new Error('กรุณากรอกชื่อของคุณ');
  requireImage(fd.get('qr'), 'QR รับเงิน');

  const db = supabaseAdmin();
  const joinCode = makeJoinCode();
  const ownerToken = makeOwnerToken();

  const { data: proj, error } = await db
    .from('projects')
    .insert({ name, join_code: joinCode, owner_token: ownerToken })
    .select('id')
    .single();
  if (error || !proj) throw new Error('สร้าง Project ไม่สำเร็จ');

  const photoUrl = await uploadImage(fd.get('photo'), `m/${proj.id}`);
  const qrUrl = await uploadImage(fd.get('qr'), `m/${proj.id}`);

  const { data: member, error: me } = await db
    .from('members')
    .insert({
      project_id: proj.id,
      name: ownerName,
      photo_url: photoUrl,
      payment_qr_url: qrUrl,
      is_owner: true,
    })
    .select('id')
    .single();
  if (me || !member) throw new Error('สร้างสมาชิกไม่สำเร็จ');

  return { joinCode, ownerToken, memberId: member.id };
}

// ---- join project (member) ------------------------------------
export async function joinProject(fd: FormData): Promise<{ memberId: string }> {
  const code = String(fd.get('code') || '').trim();
  const name = String(fd.get('name') || '').trim();
  if (!name) throw new Error('กรุณากรอกชื่อของคุณ');
  requireImage(fd.get('qr'), 'QR รับเงิน');
  const proj = await requireProject(code);

  const db = supabaseAdmin();
  const photoUrl = await uploadImage(fd.get('photo'), `m/${proj.id}`);
  const qrUrl = await uploadImage(fd.get('qr'), `m/${proj.id}`);

  const { data: member, error } = await db
    .from('members')
    .insert({
      project_id: proj.id,
      name,
      photo_url: photoUrl,
      payment_qr_url: qrUrl,
      is_owner: false,
    })
    .select('id')
    .single();
  if (error || !member) throw new Error('เข้าร่วม Project ไม่สำเร็จ');

  revalidatePath(`/p/${code}`);
  return { memberId: member.id };
}

// ---- update member profile ------------------------------------
export async function updateMemberProfile(fd: FormData): Promise<void> {
  const code = String(fd.get('code') || '').trim();
  const memberId = String(fd.get('memberId') || '').trim();
  const name = String(fd.get('name') || '').trim();
  if (!name) throw new Error('กรุณากรอกชื่อ');
  const proj = await requireProject(code);

  const db = supabaseAdmin();
  const patch: Record<string, string | null> = { name };
  const photoUrl = await uploadImage(fd.get('photo'), `m/${proj.id}`);
  const qrUrl = await uploadImage(fd.get('qr'), `m/${proj.id}`);
  if (photoUrl) patch.photo_url = photoUrl;
  if (qrUrl) patch.payment_qr_url = qrUrl;
  if (fd.get('clearPhoto') === '1') patch.photo_url = null;
  if (fd.get('clearQr') === '1') patch.payment_qr_url = null;

  const { error } = await db
    .from('members')
    .update(patch)
    .eq('id', memberId)
    .eq('project_id', proj.id);
  if (error) throw new Error('อัปเดตโปรไฟล์ไม่สำเร็จ');
  revalidatePath(`/p/${code}`);
}

// ---- save expense (create or update) --------------------------
export type ExpenseInput = {
  code: string;
  id?: string;
  kind: 'expense' | 'debt';
  category: string;
  title: string;
  amount: number;
  payerId: string;
  counterId?: string | null;
  splitMode: 'equal' | 'custom';
  shares: { memberId: string; amount: number }[];
  createdBy?: string | null;
};

export async function saveExpense(input: ExpenseInput): Promise<{ id: string }> {
  const proj = await requireProject(input.code);
  const db = supabaseAdmin();

  const title = input.title.trim() || (input.kind === 'debt' ? 'ยืมเงิน' : 'รายการ');
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new Error('จำนวนเงินต้องมากกว่า 0');
  if (!input.payerId) throw new Error('ต้องระบุคนจ่าย');

  const row = {
    project_id: proj.id,
    kind: input.kind,
    category: input.category,
    title,
    amount,
    payer_id: input.payerId,
    counter_id: input.kind === 'debt' ? input.counterId ?? null : null,
    split_mode: input.splitMode,
  };

  let expenseId: string;
  if (input.id) {
    const { error } = await db.from('expenses').update(row).eq('id', input.id).eq('project_id', proj.id);
    if (error) throw new Error('แก้ไขรายการไม่สำเร็จ');
    expenseId = input.id;
    await db.from('expense_shares').delete().eq('expense_id', expenseId);
  } else {
    const { data, error } = await db
      .from('expenses')
      .insert({ ...row, created_by: input.createdBy ?? null })
      .select('id')
      .single();
    if (error || !data) throw new Error('เพิ่มรายการไม่สำเร็จ');
    expenseId = data.id;
  }

  if (input.kind === 'expense') {
    const shareRows = input.shares
      .filter((s) => s.amount > 0)
      .map((s) => ({ expense_id: expenseId, member_id: s.memberId, amount: round2(s.amount) }));
    if (shareRows.length) {
      const { error } = await db.from('expense_shares').insert(shareRows);
      if (error) throw new Error('บันทึกการหารไม่สำเร็จ');
    }
  }

  revalidatePath(`/p/${input.code}`);
  return { id: expenseId };
}

// ---- delete expense -------------------------------------------
export async function deleteExpense(code: string, expenseId: string): Promise<void> {
  const proj = await requireProject(code);
  const db = supabaseAdmin();
  const { error } = await db.from('expenses').delete().eq('id', expenseId).eq('project_id', proj.id);
  if (error) throw new Error('ลบรายการไม่สำเร็จ');
  revalidatePath(`/p/${code}`);
}

// ---- owner: remove member -------------------------------------
export async function removeMember(code: string, ownerToken: string, memberId: string): Promise<void> {
  const proj = await requireOwner(code, ownerToken);
  const db = supabaseAdmin();
  const { error } = await db.from('members').delete().eq('id', memberId).eq('project_id', proj.id);
  if (error) throw new Error('ลบสมาชิกไม่สำเร็จ');
  revalidatePath(`/p/${code}`);
}

// ---- owner: delete project ------------------------------------
export async function deleteProject(code: string, ownerToken: string): Promise<void> {
  const proj = await requireOwner(code, ownerToken);
  const db = supabaseAdmin();
  const { error } = await db.from('projects').delete().eq('id', proj.id);
  if (error) throw new Error('ลบ Project ไม่สำเร็จ');
}

// ---- settle a debt ("I've paid X back to Y") ------------------
export async function addSettlement(fd: FormData): Promise<void> {
  const code = String(fd.get('code') || '').trim();
  const fromMember = String(fd.get('fromMember') || '');
  const toMember = String(fd.get('toMember') || '');
  const amount = round2(parseFloat(String(fd.get('amount') || '0')));
  const slipRef = String(fd.get('slipRef') || '').trim() || null;
  const note = String(fd.get('note') || '').trim() || null;
  if (!fromMember || !toMember || fromMember === toMember) {
    throw new Error('ข้อมูลผู้โอน/ผู้รับไม่ถูกต้อง');
  }
  if (!(amount > 0)) throw new Error('จำนวนเงินต้องมากกว่า 0');

  const proj = await requireProject(code);
  const db = supabaseAdmin();
  const slipUrl = await uploadImage(fd.get('slip'), `slip/${proj.id}`);

  const { error } = await db.from('settlements').insert({
    project_id: proj.id,
    from_member: fromMember,
    to_member: toMember,
    amount,
    slip_url: slipUrl,
    slip_ref: slipRef,
    note,
  });
  if (error) throw new Error('บันทึกการจ่ายไม่สำเร็จ');
  revalidatePath(`/p/${code}`);
}

export async function deleteSettlement(code: string, id: string): Promise<void> {
  const proj = await requireProject(code);
  const db = supabaseAdmin();
  const { error } = await db
    .from('settlements')
    .delete()
    .eq('id', id)
    .eq('project_id', proj.id);
  if (error) throw new Error('ยกเลิกรายการจ่ายไม่สำเร็จ');
  revalidatePath(`/p/${code}`);
}
