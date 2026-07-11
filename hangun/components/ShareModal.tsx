'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import { Icon } from './ui';

export function ShareModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const link = `${window.location.origin}/join/${code}`;
    setUrl(link);
    QRCode.toDataURL(link, {
      width: 520,
      margin: 2,
      color: { dark: '#18181B', light: '#FFFFFF' },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  function copy() {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  }

  return (
    <Modal title="ชวนเพื่อนเข้า Project" onClose={onClose}>
      <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 14 }}>
        ให้เพื่อนสแกน QR นี้ หรือส่งลิงก์ไปให้ — สแกนแล้วกรอกชื่อก็เข้าร่วมได้เลย
      </p>

      <div
        className="card card-pad"
        style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}
      >
        {qr ? (
          <img src={qr} alt="QR เข้าร่วม Project" style={{ width: 240, height: 240 }} />
        ) : (
          <div style={{ width: 240, height: 240 }} />
        )}
      </div>

      <div
        className="card card-pad"
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}
      >
        <Icon name="link" size={18} />
        <span
          className="num"
          style={{
            flex: 1,
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {url}
        </span>
      </div>

      <button className="btn btn-primary btn-block" onClick={copy}>
        <Icon name={copied ? 'check' : 'copy'} size={19} />
        {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
      </button>
    </Modal>
  );
}
