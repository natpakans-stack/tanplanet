// /api/holdings-inbox — ZK relay mailbox สำหรับ holdings
// เก็บ/คืน "เฉพาะ ciphertext" เท่านั้น — ไม่มีวันเห็น plaintext และไม่มีคีย์ (decrypt ได้ที่ Mac เท่านั้น)
// storage: Vercel KV / Upstash REST  (env: KV_REST_API_URL, KV_REST_API_TOKEN)
const URL_ = process.env.KV_REST_API_URL, TOK = process.env.KV_REST_API_TOKEN;
const K = "megacoach:holdings-inbox";
const kv = (path, opts = {}) =>
  fetch(`${URL_}/${path}`, { ...opts, headers: { Authorization: `Bearer ${TOK}`, ...(opts.headers || {}) } }).then(r => r.json());

export default async function handler(req, res) {
  if (!URL_ || !TOK) return res.status(500).json({ error: "KV not configured" });
  try {
    if (req.method === "GET") {
      const { result } = await kv(`get/${K}`);
      return result ? res.status(200).json(JSON.parse(result)) : res.status(404).end();
    }
    if (req.method === "POST") {
      const blob = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
      // ❗ รับเฉพาะ ciphertext ที่ฟอร์มเข้ารหัสมาแล้ว — ปฏิเสธ plaintext/ขยะ (บังคับ ZK ที่ชั้น relay)
      if (!blob || blob.kdf !== "PBKDF2" || !blob.salt || !blob.iv || !blob.ct)
        return res.status(400).json({ error: "encrypted blob only" });
      const clean = { v: blob.v, kdf: blob.kdf, hash: blob.hash, iter: blob.iter, salt: blob.salt, iv: blob.iv, ct: blob.ct };
      await kv(`set/${K}`, { method: "POST", body: JSON.stringify(clean) });
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") { await kv(`del/${K}`); return res.status(200).json({ ok: true }); }
    return res.status(405).end();
  } catch { return res.status(500).json({ error: "relay error" }); }   // ไม่ leak รายละเอียด error
}
