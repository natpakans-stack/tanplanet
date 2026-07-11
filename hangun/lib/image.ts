// ============================================================
// หารกัน (HanGun) — client-side image compression
// phone photos are 3-8MB; Server Actions cap the request body.
// downscale + re-encode to JPEG so uploads stay small & fast.
// CLIENT-ONLY (uses <canvas>).
// ============================================================

function loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

/**
 * Downscale an image to `maxDim` on its longest side and re-encode as JPEG.
 * Returns the original file untouched if it is not an image, cannot be
 * processed, or the result would not be smaller.
 */
export async function compressImage(
  file: File,
  maxDim = 1400,
  quality = 0.82,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let loaded: { img: HTMLImageElement; url: string };
  try {
    loaded = await loadImage(file);
  } catch {
    return file;
  }
  const { img, url } = loaded;

  try {
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) return file;

    const scale = Math.min(1, maxDim / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // white backfill so transparent PNGs (e.g. QR) stay readable as JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
