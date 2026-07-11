'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateMemberProfile } from '@/app/actions';
import type { Member } from '@/lib/types';
import { MemberFields } from './MemberFields';
import { Modal } from './Modal';

export function EditProfileModal({
  code,
  member,
  onClose,
}: {
  code: string;
  member: Member;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('code', code);
    fd.set('memberId', member.id);
    setBusy(true);
    setErr(null);
    try {
      await updateMemberProfile(fd);
      router.refresh();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <Modal title="แก้ไขโปรไฟล์" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <MemberFields
          defaultName={member.name}
          defaultPhotoUrl={member.photoUrl}
          defaultQrUrl={member.paymentQrUrl}
        />
        {err && (
          <div className="banner banner-warn" style={{ marginBottom: 14 }}>
            {err}
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'}
        </button>
      </form>
    </Modal>
  );
}
