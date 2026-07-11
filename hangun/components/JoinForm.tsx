'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinProject } from '@/app/actions';
import { getJoined, saveJoined } from '@/lib/identity';
import { MemberFields } from './MemberFields';

export function JoinForm({
  code,
  projectName,
  memberCount,
}: {
  code: string;
  projectName: string;
  memberCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // already a member on this device → go straight in
  useEffect(() => {
    if (getJoined(code)) router.replace(`/p/${code}`);
    else setChecked(true);
  }, [code, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('code', code);
    setLoading(true);
    setErr(null);
    try {
      const res = await joinProject(fd);
      saveJoined({
        code,
        projectName,
        memberId: res.memberId,
        joinedAt: Date.now(),
      });
      router.push(`/p/${code}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
      setLoading(false);
    }
  }

  if (!checked) return null;

  return (
    <div className="center-page">
      <div className="center-card anim">
        <div className="hero">
          <p style={{ opacity: 0.9 }}>เข้าร่วม Project</p>
          <h1 style={{ fontSize: 23 }}>{projectName}</h1>
          <p>มีสมาชิกอยู่แล้ว {memberCount} คน — กรอกข้อมูลของคุณเพื่อเข้าร่วม</p>
        </div>

        <form onSubmit={handleSubmit}>
          <MemberFields onBusyChange={setImgBusy} />

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
            {loading ? 'กำลังเข้าร่วม…' : imgBusy ? 'กำลังย่อรูป…' : 'เข้าร่วม Project'}
          </button>
        </form>
      </div>
    </div>
  );
}
