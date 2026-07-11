'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Project, Member, Expense } from '@/lib/types';
import { getJoined, removeJoined } from '@/lib/identity';
import {
  perPerson,
  outstandingTransfers,
  projectTotal,
  memberShares,
  participantCount,
} from '@/lib/engine';
import { catOf, money } from '@/lib/format';
import { removeMember, deleteProject, deleteSettlement } from '@/app/actions';
import { Avatar, Icon } from './ui';
import { ExpenseModal } from './ExpenseModal';
import { ShareModal } from './ShareModal';
import { SummaryView } from './SummaryView';
import { EditProfileModal } from './EditProfileModal';
import { SettleModal } from './SettleModal';
import { Modal } from './Modal';

type Tab = 'expenses' | 'summary' | 'members' | 'me';
const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'expenses', label: 'รายการ', icon: 'list' },
  { id: 'summary', label: 'สรุป', icon: 'chart' },
  { id: 'members', label: 'สมาชิก', icon: 'users' },
  { id: 'me', label: 'ของฉัน', icon: 'user' },
];

export function ProjectApp({ project }: { project: Project }) {
  const router = useRouter();
  const [identity, setIdentity] = useState<ReturnType<typeof getJoined> | null | undefined>(
    undefined,
  );
  const [tab, setTab] = useState<Tab>('expenses');
  const [expenseModal, setExpenseModal] = useState<{ expense: Expense | null } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [qrMember, setQrMember] = useState<Member | null>(null);
  const [settleTarget, setSettleTarget] = useState<{ to: Member; amount: number } | null>(null);

  const me = useMemo(
    () => (identity ? project.members.find((m) => m.id === identity.memberId) ?? null : null),
    [identity, project.members],
  );

  useEffect(() => {
    const j = getJoined(project.joinCode);
    if (j && !project.members.some((m) => m.id === j.memberId)) {
      // removed from the project — forget local identity
      removeJoined(project.joinCode);
      setIdentity(null);
    } else {
      setIdentity(j ?? null);
    }
  }, [project.joinCode, project.members]);

  if (identity === undefined) return null;

  // not joined on this device
  if (!identity || !me) {
    return (
      <div className="center-page">
        <div className="center-card">
          <div className="card card-pad empty">
            <div className="emj">🧳</div>
            <div className="t">{project.name}</div>
            <div className="s">คุณยังไม่ได้เข้าร่วม Project นี้</div>
            <Link
              href={`/join/${project.joinCode}`}
              className="btn btn-primary"
              style={{ marginTop: 18 }}
            >
              เข้าร่วม Project
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = !!identity.ownerToken;
  const total = projectTotal(project.expenses);

  return (
    <div className="project-shell">
      {/* ---- desktop sidebar ---- */}
      <aside className="sidebar">
        <div className="sidebar-brand">{project.name}</div>
        <div className="sidebar-sub">
          {project.members.length} คน · {money(total)}
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={'nav-item' + (tab === n.id ? ' active' : '')}
            onClick={() => setTab(n.id)}
          >
            <Icon name={n.icon} size={19} />
            {n.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="nav-item" onClick={() => setShareOpen(true)}>
          <Icon name="share" size={19} />
          ชวนเพื่อน
        </button>
        <Link href="/" className="nav-item">
          <Icon name="back" size={19} />
          Project อื่น
        </Link>
      </aside>

      <div className="shell">
        {/* ---- mobile topbar ---- */}
        <header className="topbar">
          <Link href="/" className="icon-btn" aria-label="หน้าแรก">
            <Icon name="back" />
          </Link>
          <div className="topbar-title">{project.name}</div>
          <button className="icon-btn" onClick={() => setShareOpen(true)} aria-label="ชวนเพื่อน">
            <Icon name="share" size={20} />
          </button>
        </header>

        <main className="project-main">
          <div className="project-main-inner anim" key={tab}>
            {tab === 'expenses' && (
              <ExpensesView
                project={project}
                onAdd={() => setExpenseModal({ expense: null })}
                onOpen={(e) => setExpenseModal({ expense: e })}
              />
            )}
            {tab === 'summary' && (
              <SummaryView
                members={project.members}
                expenses={project.expenses}
                settlements={project.settlements}
              />
            )}
            {tab === 'members' && (
              <MembersView
                project={project}
                isOwner={isOwner}
                ownerToken={identity.ownerToken}
                onShare={() => setShareOpen(true)}
                onShowQr={setQrMember}
                onLeave={() => {
                  removeJoined(project.joinCode);
                  router.push('/');
                }}
              />
            )}
            {tab === 'me' && (
              <MeView
                project={project}
                me={me}
                onEditProfile={() => setEditProfile(true)}
                onOpenExpense={(e) => setExpenseModal({ expense: e })}
                onSettle={(to, amount) => setSettleTarget({ to, amount })}
              />
            )}
          </div>
        </main>

        {/* ---- mobile tab bar ---- */}
        <nav className="tabbar">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? 'active' : ''}
              onClick={() => setTab(n.id)}
            >
              <Icon name={n.icon} size={21} />
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      {expenseModal && (
        <ExpenseModal
          code={project.joinCode}
          members={project.members}
          expense={expenseModal.expense}
          myId={me.id}
          onClose={() => setExpenseModal(null)}
        />
      )}
      {shareOpen && <ShareModal code={project.joinCode} onClose={() => setShareOpen(false)} />}
      {settleTarget && (
        <SettleModal
          code={project.joinCode}
          from={me}
          to={settleTarget.to}
          amount={settleTarget.amount}
          onClose={() => setSettleTarget(null)}
        />
      )}
      {editProfile && (
        <EditProfileModal
          code={project.joinCode}
          member={me}
          onClose={() => setEditProfile(false)}
        />
      )}
      {qrMember && (
        <Modal title={`QR รับเงิน · ${qrMember.name}`} onClose={() => setQrMember(null)}>
          {qrMember.paymentQrUrl ? (
            <img
              src={qrMember.paymentQrUrl}
              alt={`QR ของ ${qrMember.name}`}
              style={{ width: '100%', borderRadius: 'var(--r)' }}
            />
          ) : (
            <div className="empty">
              <div className="emj">📭</div>
              <div className="t">ยังไม่ได้ใส่ QR รับเงิน</div>
              <div className="s">{qrMember.name} ยังไม่ได้อัปโหลด QR</div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---- expenses tab --------------------------------------------- */
function ExpensesView({
  project,
  onAdd,
  onOpen,
}: {
  project: Project;
  onAdd: () => void;
  onOpen: (e: Expense) => void;
}) {
  const byId = Object.fromEntries(project.members.map((m) => [m.id, m]));
  const total = projectTotal(project.expenses);

  return (
    <>
      <div className="total-card" style={{ marginBottom: 18 }}>
        <div className="lab">ยอดใช้จ่ายรวมทั้งทริป</div>
        <div className="big num">{money(total)}</div>
        <div className="meta">
          <div className="avatar-stack">
            {project.members.slice(0, 6).map((m) => (
              <Avatar key={m.id} member={m} size="xs" />
            ))}
          </div>
          <span>
            {project.members.length} คน · {project.expenses.length} รายการ
          </span>
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 12 }}>
        <div className="section-label" style={{ margin: 0 }}>รายการค่าใช้จ่าย</div>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>
          <Icon name="plus" size={17} /> เพิ่มรายการ
        </button>
      </div>

      {project.expenses.length === 0 ? (
        <div className="card card-pad empty">
          <div className="emj">🧾</div>
          <div className="t">ยังไม่มีรายการ</div>
          <div className="s">กด “เพิ่มรายการ” เพื่อเริ่มหารบิล</div>
        </div>
      ) : (
        <div className="list">
          {project.expenses.map((e) => {
            const payer = e.payerId ? byId[e.payerId] : null;
            const isDebt = e.kind === 'debt';
            return (
              <button key={e.id} className="row" onClick={() => onOpen(e)}>
                <div className="row-icon">{isDebt ? '🤝' : catOf(e.category).emoji}</div>
                <div className="row-main">
                  <div className="row-title">{e.title}</div>
                  <div className="row-sub">
                    {isDebt
                      ? `${e.counterId ? byId[e.counterId]?.name : '?'} ยืม ${payer?.name ?? '?'}`
                      : `จ่ายโดย ${payer?.name ?? '?'} · หาร ${participantCount(e)} คน`}
                  </div>
                </div>
                <div className="row-amount num">{money(e.amount)}</div>
                <span className="row-chev">
                  <Icon name="right" size={18} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---- members tab ---------------------------------------------- */
function MembersView({
  project,
  isOwner,
  ownerToken,
  onShare,
  onShowQr,
  onLeave,
}: {
  project: Project;
  isOwner: boolean;
  ownerToken?: string;
  onShare: () => void;
  onShowQr: (m: Member) => void;
  onLeave: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function kick(m: Member) {
    if (!ownerToken || busy) return;
    if (!window.confirm(`เอา ${m.name} ออกจาก Project?`)) return;
    setBusy(true);
    try {
      await removeMember(project.joinCode, ownerToken, m.id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    }
    setBusy(false);
  }

  async function delProject() {
    if (!ownerToken || busy) return;
    if (!window.confirm(`ลบ Project "${project.name}" และข้อมูลทั้งหมด?`)) return;
    setBusy(true);
    try {
      await deleteProject(project.joinCode, ownerToken);
      onLeave();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <>
      <button className="row" onClick={onShare} style={{ marginBottom: 18 }}>
        <div className="row-icon">📲</div>
        <div className="row-main">
          <div className="row-title">ชวนเพื่อนเข้า Project</div>
          <div className="row-sub">เปิด QR / คัดลอกลิงก์ให้เพื่อนสแกน</div>
        </div>
        <span className="row-chev">
          <Icon name="right" size={18} />
        </span>
      </button>

      <div className="section-label">สมาชิก ({project.members.length})</div>
      <div className="list">
        {project.members.map((m) => (
          <div key={m.id} className="row">
            <Avatar member={m} size="md" />
            <div className="row-main">
              <div className="row-title">{m.name}</div>
              <div className="row-sub">
                {m.isOwner ? 'เจ้าของ Project' : 'สมาชิก'}
                {m.paymentQrUrl ? ' · มี QR รับเงิน' : ''}
              </div>
            </div>
            {m.paymentQrUrl && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onShowQr(m)}
                aria-label={`ดู QR ของ ${m.name}`}
              >
                <Icon name="wallet" size={16} /> QR
              </button>
            )}
            {isOwner && !m.isOwner && (
              <button
                className="icon-btn danger"
                onClick={() => kick(m)}
                disabled={busy}
                aria-label={`เอา ${m.name} ออก`}
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '22px 0 14px' }} />
      <button className="btn btn-secondary btn-block" onClick={onLeave}>
        ออกจาก Project นี้
      </button>
      {isOwner && (
        <button
          className="btn btn-danger btn-block"
          style={{ marginTop: 10 }}
          onClick={delProject}
          disabled={busy}
        >
          <Icon name="trash" size={18} /> ลบ Project (เจ้าของ)
        </button>
      )}
    </>
  );
}

/* ---- "me" tab ------------------------------------------------- */
function MeView({
  project,
  me,
  onEditProfile,
  onOpenExpense,
  onSettle,
}: {
  project: Project;
  me: Member;
  onEditProfile: () => void;
  onOpenExpense: (e: Expense) => void;
  onSettle: (to: Member, amount: number) => void;
}) {
  const router = useRouter();
  const byId = Object.fromEntries(project.members.map((m) => [m.id, m]));
  const pp = perPerson(project.members, project.expenses);
  const transfers = outstandingTransfers(project.members, project.expenses, project.settlements);
  const mine = pp[me.id] ?? { paid: 0, owed: 0, net: 0 };
  const iPay = transfers.filter((t) => t.from === me.id);
  const iGet = transfers.filter((t) => t.to === me.id);
  const myExpenses = project.expenses.filter(
    (e) => e.payerId === me.id || memberShares(e)[me.id] > 0,
  );
  const mySettlements = project.settlements.filter(
    (s) => s.fromMember === me.id || s.toMember === me.id,
  );

  const payTotal = iPay.reduce((s, t) => s + t.amount, 0);
  const getTotal = iGet.reduce((s, t) => s + t.amount, 0);
  const netCls = payTotal > 0.005 ? 'net-neg' : getTotal > 0.005 ? 'net-pos' : 'net-zero';
  const netLabel =
    payTotal > 0.005
      ? 'ต้องโอนอีก ' + money(payTotal, true)
      : getTotal > 0.005
        ? 'รอรับอีก ' + money(getTotal, true)
        : 'เคลียร์หมดแล้ว 🎉';

  async function undoSettlement(id: string) {
    if (!window.confirm('ยกเลิกรายการจ่ายนี้? ยอดจะกลับมาแสดงใหม่')) return;
    try {
      await deleteSettlement(project.joinCode, id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    }
  }

  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar member={me} size="lg" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{me.name}</div>
              <div className="row-sub num">
                ใช้ไป {money(mine.owed)} · สำรองจ่าย {money(mine.paid)}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onEditProfile} aria-label="แก้ไขโปรไฟล์">
            <Icon name="edit" size={19} />
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          <span className={'net-badge ' + netCls} style={{ fontSize: 14, padding: '8px 14px' }}>
            {netLabel}
          </span>
        </div>
      </div>

      {iPay.length > 0 && (
        <div className="section">
          <div className="section-label">ฉันต้องโอนให้</div>
          <div className="list">
            {iPay.map((t, i) => {
              const to = byId[t.to];
              if (!to) return null;
              return (
                <div key={i} className="row">
                  <Avatar member={to} size="md" />
                  <div className="row-main">
                    <div className="row-title">{to.name}</div>
                    <div className="row-amount num" style={{ color: 'var(--negative)', fontWeight: 700 }}>
                      {money(t.amount, true)}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onSettle(to, t.amount)}
                  >
                    <Icon name="wallet" size={16} /> จ่าย
                  </button>
                </div>
              );
            })}
          </div>
          <div className="hint">กด “จ่าย” เพื่อสแกน QR โอน แล้วยืนยัน — ยอดจะถูกหักออกให้</div>
        </div>
      )}

      {iGet.length > 0 && (
        <div className="section">
          <div className="section-label">รอรับเงินจาก</div>
          <div className="list">
            {iGet.map((t, i) => {
              const from = byId[t.from];
              return (
                <div key={i} className="row">
                  <Avatar member={from} size="md" />
                  <div className="row-main">
                    <div className="row-title">{from?.name}</div>
                    <div className="row-sub">ยังไม่ได้โอนให้คุณ</div>
                  </div>
                  <div className="row-amount num" style={{ color: 'var(--positive)' }}>
                    {money(t.amount, true)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mySettlements.length > 0 && (
        <div className="section">
          <div className="section-label">จ่ายแล้ว ({mySettlements.length})</div>
          <div className="list">
            {mySettlements.map((s) => {
              const out = s.fromMember === me.id;
              const other = byId[out ? s.toMember : s.fromMember];
              return (
                <div key={s.id} className="row">
                  <div
                    className="row-icon"
                    style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}
                  >
                    <Icon name="check" size={20} />
                  </div>
                  <div className="row-main">
                    <div className="row-title">
                      {out ? `ฉัน → ${other?.name ?? '?'}` : `${other?.name ?? '?'} → ฉัน`}
                    </div>
                    <div className="row-sub">
                      {s.slipUrl ? 'แนบสลิปแล้ว' : 'ไม่มีสลิป'}
                      {s.slipRef ? ' · อ่าน QR สลิปแล้ว ✓' : ''}
                    </div>
                  </div>
                  <div className="row-amount num" style={{ color: 'var(--positive)' }}>
                    {money(s.amount, true)}
                  </div>
                  {s.slipUrl && (
                    <a
                      className="btn btn-ghost btn-sm"
                      href={s.slipUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      สลิป
                    </a>
                  )}
                  <button
                    className="icon-btn danger"
                    onClick={() => undoSettlement(s.id)}
                    aria-label="ยกเลิกรายการจ่าย"
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-label">รายการที่ฉันเกี่ยวข้อง ({myExpenses.length})</div>
        {myExpenses.length === 0 ? (
          <div className="card card-pad empty" style={{ padding: '28px 20px' }}>
            <div className="emj">📋</div>
            <div className="s">ยังไม่มีรายการที่เกี่ยวกับคุณ</div>
          </div>
        ) : (
          <div className="list">
            {myExpenses.map((e) => {
              const myShare = memberShares(e)[me.id] ?? 0;
              const iPaid = e.payerId === me.id;
              return (
                <button key={e.id} className="row" onClick={() => onOpenExpense(e)}>
                  <div className="row-icon">
                    {e.kind === 'debt' ? '🤝' : catOf(e.category).emoji}
                  </div>
                  <div className="row-main">
                    <div className="row-title">{e.title}</div>
                    <div className="row-sub">
                      {iPaid ? 'ฉันสำรองจ่าย' : 'ส่วนของฉัน'}
                      {myShare > 0 ? ` · ${money(myShare)}` : ''}
                    </div>
                  </div>
                  <div className="row-amount num">{money(e.amount)}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
