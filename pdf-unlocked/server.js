// UI ปลดล็อก PDF — รันบนเครื่อง เบื้องหลังเรียก qpdf
// รัน: bun server.js  แล้วเปิด http://localhost:3777
import { tmpdir } from "os";
import { join } from "path";
import { unlink } from "fs/promises";

const PORT = 3777;

Bun.serve({
  port: PORT,
  maxRequestBodySize: 1024 * 1024 * 500, // 500MB
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (req.method === "POST" && url.pathname === "/unlock") {
      const form = await req.formData();
      const file = form.get("file");
      const pw = String(form.get("password") || "");
      if (!(file instanceof File)) return new Response("ไม่มีไฟล์", { status: 400 });

      const id = crypto.randomUUID();
      const src = join(tmpdir(), `${id}.pdf`);
      const out = join(tmpdir(), `${id}-unlocked.pdf`);
      await Bun.write(src, file);

      const args = ["--decrypt"];
      if (pw) args.push(`--password=${pw}`);
      args.push(src, out);

      const proc = Bun.spawn(["qpdf", ...args], { stderr: "pipe" });
      const err = await new Response(proc.stderr).text();
      const code = await proc.exited;
      await unlink(src).catch(() => {});

      // qpdf: 0 = ok, 3 = warning (ไฟล์ยังใช้ได้)
      if (code !== 0 && code !== 3) {
        await unlink(out).catch(() => {});
        const msg = /invalid password/i.test(err) ? "รหัสผ่านไม่ถูกต้อง" : (err.trim() || "ปลดล็อกไม่สำเร็จ");
        return new Response(msg, { status: 422 });
      }

      const data = await Bun.file(out).arrayBuffer();
      await unlink(out).catch(() => {});
      const name = file.name.replace(/\.pdf$/i, "") + "-unlocked.pdf";
      return new Response(data, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`\n  🔓 ปลดล็อก PDF พร้อมแล้ว → http://localhost:${PORT}\n  (กด Ctrl+C เพื่อปิด)\n`);

const HTML = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ปลดล็อก PDF</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<style>
  :root {
    --bg:      oklch(96.5% 0.008 85);
    --bg-2:    oklch(93.5% 0.012 82);
    --card:    oklch(99.5% 0.004 90);
    --ink:     oklch(28% 0.012 60);
    --muted:   oklch(58% 0.014 65);
    --faint:   oklch(72% 0.012 70);
    --line:    oklch(90% 0.010 78);
    --field:   oklch(97.5% 0.008 85);
    --accent:  oklch(61% 0.14 42);
    --accent-d:oklch(55% 0.145 41);
    --accent-t:oklch(96% 0.03 45);
    --ok:      oklch(58% 0.10 155);
    --ok-t:    oklch(96% 0.03 155);
    --ok-line: oklch(78% 0.09 155);
    --shadow:  36px oklch(30% 0.02 60 / .10);
  }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; }
  body {
    margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
    font-family:"Anuphan",-apple-system,"Segoe UI",sans-serif;
    background:radial-gradient(120% 100% at 50% 0%, var(--bg) 0%, var(--bg-2) 100%);
    color:var(--ink); -webkit-font-smoothing:antialiased; letter-spacing:.005em;
  }
  .card {
    width:100%; max-width:452px; background:var(--card);
    border:1px solid var(--line); border-radius:22px; padding:32px 30px 30px;
    box-shadow:0 1px 2px oklch(30% 0.02 60 / .04), 0 18px var(--shadow);
  }
  .head { display:flex; align-items:center; gap:11px; margin-bottom:6px; }
  .head .lock {
    width:38px; height:38px; flex:none; display:grid; place-items:center;
    background:var(--accent-t); border-radius:11px; color:var(--accent-d);
  }
  h1 { margin:0; font-size:20px; font-weight:600; letter-spacing:-.01em; }
  p.sub { margin:0 0 24px; color:var(--muted); font-size:13.5px; font-weight:400; line-height:1.5; }

  .drop {
    position:relative; border:1.5px dashed var(--line); border-radius:16px;
    padding:34px 22px; text-align:center; cursor:pointer; background:var(--field);
    transition:border-color .18s ease, background .18s ease, transform .18s ease;
  }
  .drop:hover { border-color:var(--faint); }
  .drop.over { border-color:var(--accent); background:var(--accent-t); transform:scale(1.006); }
  .drop:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .drop .ico { color:var(--faint); transition:color .18s ease; }
  .drop:hover .ico { color:var(--muted); }
  .drop .txt { margin-top:12px; font-size:14px; font-weight:500; color:var(--muted); }
  .drop .hint { margin-top:3px; font-size:12px; font-weight:400; color:var(--faint); }
  .drop.has { border-style:solid; border-color:var(--ok-line); background:var(--ok-t); }
  .drop.has .ico { color:var(--ok); }
  .drop.has .txt { color:var(--ink); font-weight:600; word-break:break-all; }
  .drop.has .hint { color:var(--ok); }

  label { display:block; font-size:12.5px; font-weight:500; margin:22px 0 7px; color:var(--muted); }
  .pw-wrap { position:relative; }
  input[type=password], input[type=text].pw {
    width:100%; padding:12px 14px; border:1.5px solid var(--line); border-radius:12px;
    font-family:inherit; font-size:15px; font-weight:400; color:var(--ink); background:var(--field);
    transition:border-color .16s ease, box-shadow .16s ease;
  }
  input.pw::placeholder { color:var(--faint); }
  input.pw:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-t); background:var(--card); }
  .reveal {
    position:absolute; right:6px; top:50%; transform:translateY(-50%);
    width:34px; height:34px; border:0; background:none; cursor:pointer; color:var(--faint);
    display:grid; place-items:center; border-radius:8px;
  }
  .reveal:hover { color:var(--muted); background:var(--bg-2); }

  button.go {
    width:100%; margin-top:24px; padding:14px; border:0; border-radius:13px;
    background:var(--accent); color:#fff; font-family:inherit; font-size:15.5px; font-weight:600;
    letter-spacing:.01em; cursor:pointer; transition:background .16s ease, transform .08s ease, opacity .16s ease;
  }
  button.go:hover:not(:disabled) { background:var(--accent-d); }
  button.go:active:not(:disabled) { transform:translateY(1px); }
  button.go:disabled { opacity:.4; cursor:not-allowed; }
  button.go.loading { color:transparent; position:relative; }
  button.go.loading::after {
    content:""; position:absolute; inset:0; margin:auto; width:18px; height:18px;
    border:2.5px solid #fff; border-right-color:transparent; border-radius:50%;
    animation:spin .6s linear infinite;
  }
  @keyframes spin { to { transform:rotate(360deg); } }

  .msg { margin-top:16px; font-size:13px; font-weight:500; text-align:center; min-height:18px; line-height:1.45; }
  .msg.err { color:var(--accent-d); }
  .msg.ok { color:var(--ok); }
  @media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }
</style>
</head>
<body>
  <div class="card">
    <div class="head">
      <span class="lock" aria-hidden="true">
        <i data-lucide="unlock" style="width:20px;height:20px"></i>
      </span>
      <h1>ปลดล็อก PDF</h1>
    </div>
    <p class="sub">ลากไฟล์ที่ติดรหัสมาวาง ใส่รหัส (ถ้ามี) แล้วดาวน์โหลดไฟล์ที่เปิด&nbsp;ก็อป&nbsp;และพิมพ์ได้ตามปกติ</p>

    <div class="drop" id="drop" tabindex="0" role="button" aria-label="เลือกไฟล์ PDF">
      <div class="ico" id="ico" aria-hidden="true">
        <i data-lucide="file-up" style="width:38px;height:38px"></i>
      </div>
      <div class="txt" id="droptxt">ลากไฟล์ PDF มาวาง</div>
      <div class="hint" id="drophint">หรือคลิกเพื่อเลือกไฟล์</div>
      <input type="file" id="file" accept="application/pdf" hidden>
    </div>

    <label for="pw">รหัสผ่าน (ถ้ามี)</label>
    <div class="pw-wrap">
      <input type="password" id="pw" class="pw" placeholder="เว้นว่างได้ ถ้าไฟล์ล็อกแค่ห้ามก็อป" autocomplete="off" spellcheck="false">
      <button type="button" class="reveal" id="reveal" aria-label="แสดงรหัสผ่าน">
        <i id="eye" data-lucide="eye" style="width:18px;height:18px"></i>
      </button>
    </div>

    <button class="go" id="go">ปลดล็อก</button>
    <div class="msg" id="msg" role="status" aria-live="polite"></div>
  </div>
<script>
  const $=id=>document.getElementById(id);
  const drop=$('drop'), fileEl=$('file'), droptxt=$('droptxt'), drophint=$('drophint'),
    go=$('go'), msg=$('msg'), pw=$('pw'), reveal=$('reveal'), eye=$('eye');
  let file=null;
  const fmtSize=b=> b<1024?b+' B' : b<1048576?(b/1024).toFixed(0)+' KB' : (b/1048576).toFixed(1)+' MB';
  const setFile=f=>{
    if(!f) return;
    if(f.type && f.type!=='application/pdf' && !/\\.pdf$/i.test(f.name)){
      msg.className='msg err'; msg.textContent='รองรับเฉพาะไฟล์ PDF'; return;
    }
    file=f; drop.classList.add('has'); droptxt.textContent=f.name;
    drophint.textContent=fmtSize(f.size);
    msg.textContent=''; msg.className='msg';
  };
  drop.onclick=()=>fileEl.click();
  drop.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fileEl.click(); } };
  fileEl.onchange=e=>setFile(e.target.files[0]);
  ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
  drop.addEventListener('drop',e=>setFile(e.dataTransfer.files[0]));

  lucide.createIcons();
  reveal.onclick=()=>{
    const on=pw.type==='password'; pw.type=on?'text':'password';
    reveal.innerHTML='<i data-lucide="'+(on?'eye-off':'eye')+'" style="width:18px;height:18px"></i>';
    lucide.createIcons({ nodes:[reveal] }); pw.focus();
  };

  go.onclick=async()=>{
    if(!file){ msg.className='msg err'; msg.textContent='เลือกไฟล์ PDF ก่อนนะ'; drop.focus(); return; }
    go.disabled=true; go.classList.add('loading'); msg.className='msg'; msg.textContent='';
    const fd=new FormData(); fd.append('file',file); fd.append('password',pw.value);
    try {
      const r=await fetch('/unlock',{method:'POST',body:fd});
      if(!r.ok){ msg.className='msg err'; msg.textContent=await r.text(); return; }
      const blob=await r.blob();
      const cd=r.headers.get('content-disposition')||'';
      const m=cd.match(/filename\\*=UTF-8''([^;]+)/);
      const name=m?decodeURIComponent(m[1]):file.name.replace(/\\.pdf$/i,'')+'-unlocked.pdf';
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
      URL.revokeObjectURL(a.href);
      msg.className='msg ok'; msg.textContent='ดาวน์โหลดแล้ว · '+name;
    } catch(e){ msg.className='msg err'; msg.textContent=e.message; }
    finally { go.classList.remove('loading'); go.disabled=false; }
  };
</script>
</body>
</html>`;
