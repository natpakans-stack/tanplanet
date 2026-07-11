'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createProject } from '@/app/actions';
import { saveJoined } from '@/lib/identity';
import { MemberFields } from './MemberFields';
import { Icon } from './ui';

export function CreateProjectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const projectName = String(fd.get('name') || '').trim();
    setLoading(true);
    setErr(null);
    try {
      const res = await createProject(fd);
      saveJoined({
        code: res.joinCode,
        projectName,
        memberId: res.memberId,
        ownerToken: res.ownerToken,
        joinedAt: Date.now(),
      });
      router.push(`/p/${res.joinCode}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
      setLoading(false);
    }
  }

  return (
    <div className="center-page">
      <div className="center-card anim">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <Link href="/" className="icon-btn" aria-label="กลับ">
            <Icon name="back" />
          </Link>
          <h2 style={{ flex: 1, fontSize: 19, fontWeight: 700 }}>สร้าง Project ใหม่</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="pname">ชื่อ Project / ทริป</label>
            <input
              id="pname"
              className="input"
              name="name"
              placeholder="เช่น เที่ยวเชียงใหม่ 3 วัน"
              maxLength={60}
              required
            />
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0 16px' }} />
          <div className="section-label" style={{ marginBottom: 12 }}>โปรไฟล์ของคุณ (เจ้าของ)</div>

          <MemberFields nameKey="ownerName" onBusyChange={setImgBusy} />

          {err && (
            <div className="banner banner-warn" style={{ marginBottom: 14 }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || imgBusy}
          >
            {loading ? 'กำลังสร้าง…' : imgBusy ? 'กำลังย่อรูป…' : 'สร้าง Project'}
          </button>
        </form>
      </div>
    </div>
  );
}
