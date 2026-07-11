'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveExpense, deleteExpense, type ExpenseInput } from '@/app/actions';
import { CATEGORIES, money } from '@/lib/format';
import { round2, splitEqual } from '@/lib/engine';
import type { Member, Expense } from '@/lib/types';
import { Modal } from './Modal';
import { Avatar, Icon } from './ui';

/** horizontal member selector — chip per member, single or multi select */
function MemberPick({
  members,
  selected,
  multi,
  onChange,
}: {
  members: Member[];
  selected: string | string[];
  multi?: boolean;
  onChange: (next: string | string[]) => void;
}) {
  const isSel = (id: string) =>
    multi ? (selected as string[]).includes(id) : selected === id;
  const toggle = (id: string) => {
    if (multi) {
      const arr = selected as string[];
      onChange(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
    } else {
      onChange(id);
    }
  };
  return (
    <div className="chip-row">
      {members.map((m) => (
        <button
          type="button"
          key={m.id}
          className={'chip' + (isSel(m.id) ? ' selected' : '')}
          onClick={() => toggle(m.id)}
          aria-pressed={isSel(m.id)}
        >
          <Avatar member={m} size="xs" />
          {m.name}
          {multi && isSel(m.id) && <Icon name="check" size={14} />}
        </button>
      ))}
    </div>
  );
}

export function ExpenseModal({
  code,
  members,
  expense,
  myId,
  onClose,
}: {
  code: string;
  members: Member[];
  expense?: Expense | null;
  myId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = !!expense;

  const [kind, setKind] = useState<'expense' | 'debt'>(expense?.kind ?? 'expense');
  const [category, setCategory] = useState(expense?.category ?? 'food');
  const [title, setTitle] = useState(expense?.title ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [payerId, setPayerId] = useState(expense?.payerId ?? myId);
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>(expense?.splitMode ?? 'equal');
  const [participants, setParticipants] = useState<string[]>(
    expense && expense.kind === 'expense'
      ? expense.shares.map((s) => s.memberId)
      : members.map((m) => m.id),
  );
  const [customShares, setCustomShares] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (expense && expense.kind === 'expense' && expense.splitMode === 'custom') {
      for (const s of expense.shares) init[s.memberId] = String(s.amount);
    }
    return init;
  });
  const [borrowerId, setBorrowerId] = useState(expense?.counterId ?? myId);
  const [lenderId, setLenderId] = useState(
    expense?.kind === 'debt'
      ? expense.payerId ?? ''
      : members.find((m) => m.id !== myId)?.id ?? members[0]?.id ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amt = parseFloat(amount) || 0;
  const customSum = useMemo(
    () => round2(members.reduce((s, m) => s + (parseFloat(customShares[m.id]) || 0), 0)),
    [customShares, members],
  );
  const customDiff = round2(amt - customSum);

  function fillEqual() {
    const parts = splitEqual(amt, members.length);
    const next: Record<string, string> = {};
    members.forEach((m, i) => {
      next[m.id] = String(parts[i]);
    });
    setCustomShares(next);
  }

  // validation
  let valid = false;
  if (kind === 'expense') {
    const base = amt > 0 && title.trim().length > 0 && !!payerId;
    valid =
      splitMode === 'equal'
        ? base && participants.length > 0
        : base && Math.abs(customDiff) < 0.01 && customSum > 0;
  } else {
    valid = amt > 0 && !!borrowerId && !!lenderId && borrowerId !== lenderId;
  }

  async function handleSave() {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);

    let input: ExpenseInput;
    if (kind === 'expense') {
      let shares: { memberId: string; amount: number }[];
      if (splitMode === 'equal') {
        const parts = splitEqual(amt, participants.length);
        shares = participants.map((id, i) => ({ memberId: id, amount: parts[i] }));
      } else {
        shares = members
          .map((m) => ({ memberId: m.id, amount: round2(parseFloat(customShares[m.id]) || 0) }))
          .filter((s) => s.amount > 0);
      }
      input = {
        code,
        id: expense?.id,
        kind: 'expense',
        category,
        title,
        amount: amt,
        payerId,
        splitMode,
        shares,
        createdBy: myId,
      };
    } else {
      input = {
        code,
        id: expense?.id,
        kind: 'debt',
        category: 'other',
        title: title.trim() || 'ยืมเงิน',
        amount: amt,
        payerId: lenderId,
        counterId: borrowerId,
        splitMode: 'equal',
        shares: [],
        createdBy: myId,
      };
    }

    try {
      await saveExpense(input);
      router.refresh();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!expense || busy) return;
    if (!window.confirm(`ลบรายการ "${expense.title}"?`)) return;
    setBusy(true);
    try {
      await deleteExpense(code, expense.id);
      router.refresh();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
      setBusy(false);
    }
  }

  const onlyDigits = (v: string) => v.replace(/[^0-9.]/g, '');

  return (
    <Modal title={editing ? 'แก้ไขรายการ' : 'เพิ่มรายการ'} onClose={onClose}>
      <div className="seg" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={'seg-btn' + (kind === 'expense' ? ' active' : '')}
          onClick={() => setKind('expense')}
        >
          🧾 ค่าใช้จ่าย
        </button>
        <button
          type="button"
          className={'seg-btn' + (kind === 'debt' ? ' active' : '')}
          onClick={() => setKind('debt')}
        >
          🤝 หนี้ส่วนตัว
        </button>
      </div>

      {kind === 'expense' ? (
        <>
          <div className="field">
            <label className="field-label">หมวดหมู่</label>
            <div className="chip-row">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={'chip' + (category === c.id ? ' selected' : '')}
                  onClick={() => setCategory(c.id)}
                >
                  <span>{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="ex-title">ชื่อรายการ</label>
            <input
              id="ex-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ค่าข้าวเย็น"
              maxLength={60}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="ex-amount">จำนวนเงิน</label>
            <div className="amount-wrap">
              <span className="baht">฿</span>
              <input
                id="ex-amount"
                className="input input-amount num"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(onlyDigits(e.target.value))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">ใครเป็นคนจ่าย</label>
            <MemberPick
              members={members}
              selected={payerId}
              onChange={(v) => setPayerId(v as string)}
            />
          </div>

          <div className="field">
            <label className="field-label">หารกันยังไง</label>
            <div className="seg" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={'seg-btn' + (splitMode === 'equal' ? ' active' : '')}
                onClick={() => setSplitMode('equal')}
              >
                หารเท่ากัน
              </button>
              <button
                type="button"
                className={'seg-btn' + (splitMode === 'custom' ? ' active' : '')}
                onClick={() => setSplitMode('custom')}
              >
                กำหนดเอง
              </button>
            </div>

            {splitMode === 'equal' ? (
              <div className="card card-pad">
                <div className="field-label" style={{ marginBottom: 10 }}>เลือกคนที่ร่วมหาร</div>
                <MemberPick
                  members={members}
                  selected={participants}
                  multi
                  onChange={(v) => setParticipants(v as string[])}
                />
                {participants.length > 0 && amt > 0 && (
                  <div className="banner banner-info" style={{ marginTop: 10 }}>
                    หัวละประมาณ&nbsp;<strong>{money(amt / participants.length)}</strong>
                    &nbsp;({participants.length} คน)
                  </div>
                )}
              </div>
            ) : (
              <div className="card card-pad">
                {members.map((m) => (
                  <div
                    key={m.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}
                  >
                    <Avatar member={m} size="sm" />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{m.name}</span>
                    <input
                      className="input num"
                      inputMode="decimal"
                      value={customShares[m.id] || ''}
                      onChange={(e) =>
                        setCustomShares({ ...customShares, [m.id]: onlyDigits(e.target.value) })
                      }
                      placeholder="0"
                      style={{ width: 116, height: 44, textAlign: 'right', fontWeight: 600 }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  style={{ marginTop: 8 }}
                  onClick={fillEqual}
                >
                  เกลี่ยเท่ากันให้ทุกคน
                </button>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    fontWeight: 600,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px dashed var(--border-strong)',
                  }}
                >
                  <span className="muted">
                    รวม {money(customSum)} / {money(amt)}
                  </span>
                  <span
                    style={{
                      color:
                        Math.abs(customDiff) < 0.01 ? 'var(--positive)' : 'var(--negative)',
                    }}
                  >
                    {Math.abs(customDiff) < 0.01
                      ? '✓ ครบแล้ว'
                      : customDiff > 0
                        ? 'ขาด ' + money(customDiff)
                        : 'เกิน ' + money(-customDiff)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="banner banner-info" style={{ marginBottom: 16 }}>
            หนี้ส่วนตัว = ยืมเงินกันตรงๆ ไม่นำไปหารรวมกับคนอื่น
          </div>
          <div className="field">
            <label className="field-label">ใครเป็นคนยืม</label>
            <MemberPick
              members={members}
              selected={borrowerId}
              onChange={(v) => setBorrowerId(v as string)}
            />
          </div>
          <div className="field">
            <label className="field-label">ยืมจากใคร</label>
            <MemberPick
              members={members}
              selected={lenderId}
              onChange={(v) => setLenderId(v as string)}
            />
          </div>
          {borrowerId === lenderId && (
            <div className="hint err">คนยืมกับคนให้ยืมต้องไม่ใช่คนเดียวกัน</div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="dbt-amount">จำนวนเงิน</label>
            <div className="amount-wrap">
              <span className="baht">฿</span>
              <input
                id="dbt-amount"
                className="input input-amount num"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(onlyDigits(e.target.value))}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="dbt-note">โน้ต (ไม่บังคับ)</label>
            <input
              id="dbt-note"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ยืมไปจ่ายค่าตั๋ว"
              maxLength={60}
            />
          </div>
        </>
      )}

      {err && (
        <div className="banner banner-warn" style={{ marginBottom: 14 }}>
          {err}
        </div>
      )}

      <div className="btn-row">
        {editing && (
          <button
            type="button"
            className="btn btn-danger"
            style={{ flex: '0 0 56px' }}
            onClick={handleDelete}
            disabled={busy}
            aria-label="ลบรายการ"
          >
            <Icon name="trash" size={19} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!valid || busy}
        >
          {busy ? 'กำลังบันทึก…' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
        </button>
      </div>
    </Modal>
  );
}
