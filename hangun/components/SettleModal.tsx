'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';
import { addSettlement } from '@/app/actions';
import { money } from '@/lib/format';
import { compressImage } from '@/lib/image';
import type { Member } from '@/lib/types';
import { Modal } from './Modal';
import { Avatar, Icon } from './ui';

/** load an image File into a canvas and read any QR code embedded in it */
async function decodeSlipQR(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new window.Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    let { width, height } = img;
    const maxDim = 1600;
    if (Math.max(width, height) > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return jsQR(data, width, height)?.data ?? null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SettleModal({
  code,
  from,
  to,
  amount,
  onClose,
}: {
  code: string;
  from: Member;
  to: Member;
  amount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipRef, setSlipRef] = useState<string | null>(null);
  const [slipState, setSlipState] = useState<'idle' | 'reading' | 'found' | 'none'>('idle');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPickSlip(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSlipFile(f);
    setSlipPreview(URL.createObjectURL(f));
    setSlipState('reading');
    setSlipRef(null);
    // decode the QR from the original (sharpest), then compress for upload
    const ref = await decodeSlipQR(f);
    setSlipRef(ref);
    setSlipState(ref ? 'found' : 'none');
    try {
      setSlipFile(await compressImage(f));
    } catch {
      /* keep original */
    }
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set('code', code);
      fd.set('fromMember', from.id);
      fd.set('toMember', to.id);
      fd.set('amount', String(amount));
      if (slipRef) fd.set('slipRef', slipRef);
      if (slipFile) fd.set('slip', slipFile);
      await addSettlement(fd);
      router.refresh();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <Modal title="ยืนยันการจ่ายเงิน" onClose={onClose}>
      {/* who → who */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <Avatar member={from} size="sm" />
            ฉัน
          </span>
          <Icon name="arrow" size={18} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <Avatar member={to} size="sm" />
            {to.name}
          </span>
          <span className="num" style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
            {money(amount, true)}
          </span>
        </div>
      </div>

      {/* recipient QR to scan */}
      {to.paymentQrUrl && (
        <div className="field">
          <label className="field-label">สแกน QR นี้เพื่อโอนให้ {to.name}</label>
          <div className="card card-pad" style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src={to.paymentQrUrl}
              alt={`QR ของ ${to.name}`}
              style={{ width: 200, height: 200, objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

      {/* optional slip */}
      <div className="field">
        <label className="field-label">
          แนบสลิป <span className="muted">(ไม่บังคับ — ระบบจะอ่าน QR ในสลิปให้)</span>
        </label>
        <label className="upload">
          {slipPreview ? (
            <img src={slipPreview} alt="" className="upload-preview" style={{ maxHeight: 200 }} />
          ) : (
            <>
              <Icon name="camera" size={26} />
              <span>แตะเพื่อแนบสลิปโอนเงิน</span>
            </>
          )}
          <input type="file" accept="image/*" onChange={onPickSlip} />
        </label>
        {slipState === 'reading' && <div className="hint">กำลังอ่าน QR ในสลิป…</div>}
        {slipState === 'found' && (
          <div className="banner banner-info" style={{ marginTop: 8 }}>
            <Icon name="check" size={16} /> อ่าน QR ในสลิปได้ — แนบเป็นหลักฐานการโอนแล้ว
          </div>
        )}
        {slipState === 'none' && (
          <div className="hint">ไม่พบ QR ในรูป — ยังแนบเป็นรูปหลักฐานได้ตามปกติ</div>
        )}
      </div>

      {err && (
        <div className="banner banner-warn" style={{ marginBottom: 14 }}>
          {err}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={confirm}
        disabled={busy}
      >
        <Icon name="check" size={19} />
        {busy ? 'กำลังบันทึก…' : `ยืนยันว่าจ่ายแล้ว ${money(amount, true)}`}
      </button>
      <div className="hint" style={{ textAlign: 'center' }}>
        เมื่อยืนยัน ยอดที่ต้องโอนให้ {to.name} จะถูกหักออกให้
      </div>
    </Modal>
  );
}
