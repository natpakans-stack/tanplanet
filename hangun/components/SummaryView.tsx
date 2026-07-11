'use client';

import { useMemo, useState } from 'react';
import { perPerson, rawDebts, outstandingTransfers } from '@/lib/engine';
import { money } from '@/lib/format';
import type { Member, Expense, Settlement } from '@/lib/types';
import { Avatar, Icon } from './ui';

export function SummaryView({
  members,
  expenses,
  settlements,
}: {
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
}) {
  const [mode, setMode] = useState<'netted' | 'raw'>('netted');
  const [rounded, setRounded] = useState(true);

  const byId = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );
  const pp = useMemo(() => perPerson(members, expenses), [members, expenses]);
  const transfers = useMemo(
    () => outstandingTransfers(members, expenses, settlements),
    [members, expenses, settlements],
  );
  const debts = useMemo(() => rawDebts(members, expenses), [members, expenses]);

  // raw-matrix totals
  const { rowRecv, colPay, grand } = useMemo(() => {
    const rowRecv: Record<string, number> = {};
    const colPay: Record<string, number> = {};
    members.forEach((m) => {
      rowRecv[m.id] = 0;
      colPay[m.id] = 0;
    });
    members.forEach((debtor) => {
      members.forEach((creditor) => {
        const v = debts[debtor.id]?.[creditor.id] ?? 0;
        rowRecv[creditor.id] += v;
        colPay[debtor.id] += v;
      });
    });
    const grand = Object.values(rowRecv).reduce((a, b) => a + b, 0);
    return { rowRecv, colPay, grand };
  }, [members, debts]);

  if (members.length === 0) {
    return (
      <div className="empty">
        <div className="emj">👥</div>
        <div className="t">ยังไม่มีสมาชิก</div>
      </div>
    );
  }

  return (
    <div className="two-col">
      {/* per-person */}
      <div className="section">
        <div className="section-label">สรุปรายคน</div>
        <div className="list">
          {members.map((m) => {
            const r = pp[m.id];
            const cls =
              r.net > 0.005 ? 'net-pos' : r.net < -0.005 ? 'net-neg' : 'net-zero';
            const label =
              r.net > 0.005
                ? 'รับ ' + money(r.net, rounded)
                : r.net < -0.005
                  ? 'จ่าย ' + money(-r.net, rounded)
                  : 'พอดี';
            return (
              <div key={m.id} className="row">
                <Avatar member={m} size="md" />
                <div className="row-main">
                  <div className="row-title">{m.name}</div>
                  <div className="row-sub num">
                    ใช้ไป {money(r.owed)} · สำรองจ่าย {money(r.paid)}
                  </div>
                </div>
                <span className={'net-badge ' + cls}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* transfers */}
      <div className="section">
        <div className="section-label">ใครโอนให้ใคร</div>

        <button
          type="button"
          className="switch-row"
          style={{ marginBottom: 12 }}
          onClick={() => setRounded((v) => !v)}
          aria-pressed={rounded}
        >
          <span className="lab">
            <span className="t">ปัดเศษเป็นจำนวนเต็ม</span>
            <span className="s">โอนง่าย ไม่มีเศษสตางค์</span>
          </span>
          <span className={'switch' + (rounded ? ' on' : '')}>
            <span className="knob" />
          </span>
        </button>

        <div className="seg" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={'seg-btn' + (mode === 'netted' ? ' active' : '')}
            onClick={() => setMode('netted')}
          >
            หักลบแล้ว
          </button>
          <button
            type="button"
            className={'seg-btn' + (mode === 'raw' ? ' active' : '')}
            onClick={() => setMode('raw')}
          >
            ยอดดิบ
          </button>
        </div>

        {mode === 'netted' ? (
          transfers.length === 0 ? (
            <div className="card card-pad empty" style={{ padding: '32px 20px' }}>
              <div className="emj">🎉</div>
              <div className="t">ทุกคนเคลียร์กันหมดแล้ว</div>
              <div className="s">ไม่มีใครต้องโอนเงินให้ใคร</div>
            </div>
          ) : (
            <>
              <div className="list">
                {transfers.map((t, i) => (
                  <div key={i} className="transfer">
                    <span className="who">
                      <Avatar member={byId[t.from]} size="sm" />
                      <span>{byId[t.from]?.name}</span>
                    </span>
                    <span className="arrow">
                      <Icon name="arrow" size={18} />
                    </span>
                    <span className="who">
                      <Avatar member={byId[t.to]} size="sm" />
                      <span>{byId[t.to]?.name}</span>
                    </span>
                    <span className="amt num">{money(t.amount, rounded)}</span>
                  </div>
                ))}
              </div>
              <div className="hint">
                หักลบกลบหนี้แล้ว — โอนแค่ {transfers.length} ครั้งก็จบ
                {rounded ? ' (ยอดปัดขึ้น คนรับอาจได้เกินเล็กน้อย)' : ''}
              </div>
            </>
          )
        ) : (
          <>
            <div className="matrix-wrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th className="corner">รับ \ จ่าย</th>
                    {members.map((m) => (
                      <th key={m.id}>{m.name}</th>
                    ))}
                    <th className="recv">รวมรับ</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((creditor) => (
                    <tr key={creditor.id}>
                      <th className="rowhead">{creditor.name}</th>
                      {members.map((debtor) => {
                        if (debtor.id === creditor.id)
                          return <td key={debtor.id} className="diag" />;
                        const v = debts[debtor.id]?.[creditor.id] ?? 0;
                        return (
                          <td key={debtor.id} className={'num' + (v <= 0 ? ' zero' : '')}>
                            {v > 0 ? money(v, rounded) : '–'}
                          </td>
                        );
                      })}
                      <td className="num tot recv">{money(rowRecv[creditor.id], rounded)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th className="rowhead pay">รวมจ่าย</th>
                    {members.map((m) => (
                      <td key={m.id} className="num tot pay">
                        {money(colPay[m.id], rounded)}
                      </td>
                    ))}
                    <td className="num tot">{money(grand, rounded)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="hint">
              อ่านว่า &ldquo;คนบนสุด (คอลัมน์) โอนให้ คนซ้ายมือ (แถว)&rdquo; · ยอดดิบยังไม่หักลบ
            </div>
          </>
        )}
      </div>
    </div>
  );
}
