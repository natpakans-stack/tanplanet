'use client';

import { useState } from 'react';
import { compressImage } from '@/lib/image';
import { Icon } from './ui';

/** name + photo + payment-QR inputs — shared by create / join / edit profile */
export function MemberFields({
  nameKey = 'name',
  defaultName = '',
  defaultPhotoUrl = null,
  defaultQrUrl = null,
  onBusyChange,
}: {
  nameKey?: string;
  defaultName?: string;
  defaultPhotoUrl?: string | null;
  defaultQrUrl?: string | null;
  /** fired while an image is being compressed — parent disables submit */
  onBusyChange?: (busy: boolean) => void;
}) {
  const [photo, setPhoto] = useState<string | null>(defaultPhotoUrl);
  const [qr, setQr] = useState<string | null>(defaultQrUrl);
  const [busy, setBusy] = useState(false);

  // on pick: preview instantly, then compress + swap the input's file so the
  // form submits a small image (phone photos blow past the Server Action limit)
  const pick =
    (set: (v: string | null) => void) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const file = input.files?.[0];
      if (!file) {
        set(null);
        return;
      }
      set(URL.createObjectURL(file));
      setBusy(true);
      onBusyChange?.(true);
      try {
        const small = await compressImage(file);
        if (small !== file && typeof DataTransfer !== 'undefined') {
          const dt = new DataTransfer();
          dt.items.add(small);
          input.files = dt.files;
          set(URL.createObjectURL(small));
        }
      } catch {
        /* compression failed — keep the original file */
      } finally {
        setBusy(false);
        onBusyChange?.(false);
      }
    };

  return (
    <>
      <div className="field">
        <label className="field-label" htmlFor="mf-name">ชื่อของคุณ</label>
        <input
          id="mf-name"
          className="input"
          name={nameKey}
          defaultValue={defaultName}
          placeholder="เช่น แทน"
          maxLength={40}
          required
        />
      </div>

      <div className="field">
        <label className="field-label">
          รูปโปรไฟล์ <span className="muted">(ไม่บังคับ)</span>
        </label>
        <label className="upload">
          {photo ? (
            <img
              src={photo}
              alt="รูปโปรไฟล์"
              style={{
                width: '100%',
                maxWidth: 200,
                aspectRatio: '1 / 1',
                objectFit: 'cover',
                borderRadius: 'var(--r)',
                display: 'block',
              }}
            />
          ) : (
            <>
              <Icon name="camera" size={26} />
              <span>แตะเพื่อเลือกรูป (จะถูกครอบเป็นสี่เหลี่ยมจัตุรัส)</span>
            </>
          )}
          <input type="file" name="photo" accept="image/*" onChange={pick(setPhoto)} />
        </label>
      </div>

      <div className="field">
        <label className="field-label">
          QR รับเงิน <span style={{ color: 'var(--negative)' }}>* จำเป็น</span>
        </label>
        <label className="upload">
          {qr ? (
            <img
              src={qr}
              alt="QR รับเงิน"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: 'var(--r)',
              }}
            />
          ) : (
            <>
              <Icon name="wallet" size={26} />
              <span>แตะเพื่ออัปรูป QR พร้อมเพย์ / ธนาคาร</span>
            </>
          )}
          <input
            type="file"
            name="qr"
            accept="image/*"
            required={!defaultQrUrl}
            onChange={pick(setQr)}
          />
        </label>
        <div className={busy ? 'hint' : 'hint'}>
          {busy ? 'กำลังย่อรูป…' : 'ต้องอัป QR รับเงินไว้ เพื่อนจะได้สแกนโอนเงินคืนให้คุณได้'}
        </div>
      </div>
    </>
  );
}
