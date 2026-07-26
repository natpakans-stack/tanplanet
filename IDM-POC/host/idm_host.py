#!/usr/bin/env python3
"""Native messaging host — รับ job จาก popup แล้วสั่ง yt-dlp ในเครื่อง

โปรโตคอล: stdin/stdout = [4 byte length little-endian][JSON]
job: {url, headers:{}, format?, outdir?}
reply: {ok, pid, log} หรือ {ok:false, error}

ponytail: ยิงแล้วปล่อย (detached) — ไม่รายงาน progress กลับ popup
เพราะปิด popup = port ปิด = Chrome ฆ่า host ทิ้ง งานโหลดจะตายกลางคัน
อยากได้ progress จริง ต้องให้ host เขียน state ลงไฟล์แล้ว popup มา poll
"""
import json, os, shutil, struct, subprocess, sys, time

# PATH ของ native host มาจาก launchd ไม่ใช่ shell — ต้องเติมที่ homebrew ลงเอง
PATH = os.environ.get("PATH", "") + ":/opt/homebrew/bin:/usr/local/bin"
LOGDIR = os.path.expanduser("~/Library/Logs/idm-poc")


def read_msg():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    return json.loads(sys.stdin.buffer.read(struct.unpack("=I", raw)[0]))


def send(obj):
    b = json.dumps(obj).encode()
    sys.stdout.buffer.write(struct.pack("=I", len(b)) + b)
    sys.stdout.buffer.flush()


def build_argv(job, ytdlp):
    outdir = os.path.expanduser(job.get("outdir") or "~/Downloads")
    argv = [ytdlp, "--no-playlist", "-P", outdir, "-o", "%(title)s.%(ext)s"]
    if job.get("format"):
        argv += ["-f", job["format"], "--merge-output-format", "mp4"]
    for k, v in (job.get("headers") or {}).items():
        if not v:
            continue
        if k.lower() == "referer":
            argv += ["--referer", v]
        else:
            argv += ["--add-header", f"{k}:{v}"]
    argv.append(job["url"])
    return argv


def run(job):
    ytdlp = shutil.which("yt-dlp", path=PATH)
    if not ytdlp:
        return {"ok": False, "error": "ไม่พบ yt-dlp — brew install yt-dlp"}
    if not str(job.get("url", "")).startswith(("http://", "https://")):
        return {"ok": False, "error": "URL ไม่ถูกต้อง"}
    os.makedirs(LOGDIR, exist_ok=True)
    log = os.path.join(LOGDIR, time.strftime("%Y%m%d-%H%M%S.log"))
    with open(log, "wb") as f:
        # start_new_session = หลุดจาก process group ของ Chrome → popup ปิดแล้วยังโหลดต่อ
        p = subprocess.Popen(
            build_argv(job, ytdlp), stdout=f, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL, start_new_session=True,
            env={**os.environ, "PATH": PATH},
        )
    return {"ok": True, "pid": p.pid, "log": log}


def trace(msg):
    """Chrome กลืน stderr ของ host — ถ้าไม่เขียนลงไฟล์เองจะ debug ไม่ได้เลย"""
    try:
        os.makedirs(LOGDIR, exist_ok=True)
        with open(os.path.join(LOGDIR, "host.log"), "a") as f:
            f.write(f"{time.strftime('%F %T')} {msg}\n")
    except Exception:
        pass


if __name__ == "__main__":
    trace(f"start pid={os.getpid()} py={sys.version.split()[0]}")
    try:
        while (job := read_msg()) is not None:
            trace(f"job {job.get('url','')[:80]}")
            try:
                res = run(job)
            except Exception as e:
                res = {"ok": False, "error": str(e)}
            trace(f"reply {res}")
            send(res)
    except Exception:
        import traceback
        trace("CRASH " + traceback.format_exc())
        raise
    trace("bye")
