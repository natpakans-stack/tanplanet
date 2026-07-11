'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listJoined, type Joined } from '@/lib/identity';
import { Icon } from '@/components/ui';

export default function LandingPage() {
  const [joined, setJoined] = useState<Joined[] | null>(null);

  useEffect(() => {
    setJoined(listJoined());
  }, []);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* scrollable content */}
      <div style={{ flex: 1, padding: '24px 16px 28px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }} className="anim">
          <div className="hero">
            <h1>หารกัน 🧮</h1>
            <p>เปิด Project ชวนเพื่อนสแกน QR เข้ามา แล้วหารบิลทริปกันแบบรู้ชัดว่าใครต้องโอนใคร</p>
          </div>

          {joined && joined.length > 0 && (
            <div className="section">
              <div className="section-label">Project ของฉัน</div>
              <div className="list">
                {joined.map((j) => (
                  <Link key={j.code} href={`/p/${j.code}`} className="row">
                    <div className="row-icon">🧳</div>
                    <div className="row-main">
                      <div className="row-title">{j.projectName}</div>
                      <div className="row-sub">{j.ownerToken ? 'เจ้าของ Project' : 'สมาชิก'}</div>
                    </div>
                    <span className="row-chev">
                      <Icon name="right" size={18} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {joined && joined.length === 0 && (
            <div className="empty">
              <div className="emj">🧳</div>
              <div className="t">ยังไม่มี Project</div>
              <div className="s">สร้าง Project แรก หรือสแกน QR ที่เพื่อนชวนเพื่อเข้าร่วม</div>
            </div>
          )}
        </div>
      </div>

      {/* sticky bottom action bar */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Link href="/create" className="btn btn-primary btn-block">
            <Icon name="plus" size={20} /> สร้าง Project ใหม่
          </Link>
        </div>
      </div>
    </div>
  );
}
