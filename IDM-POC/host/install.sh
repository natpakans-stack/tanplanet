#!/bin/bash
# ติดตั้ง native messaging host — รันซ้ำได้ทุกครั้งที่แก้ idm_host.py
# ใช้: ./host/install.sh <EXTENSION_ID>
# หา EXTENSION_ID ได้ที่ chrome://extensions (เปิด Developer mode)
set -e
ID="$1"
[ -z "$ID" ] && { echo "ใช้: $0 <EXTENSION_ID>  (ดูที่ chrome://extensions)"; exit 1; }

SRC="$(cd "$(dirname "$0")" && pwd)/idm_host.py"
# ห้ามชี้ตรงไป repo ใน ~/Documents — macOS TCC กันไม่ให้ Chrome exec ไฟล์ในนั้น
# ("Native host has exited") จึง copy ไปไว้ที่ Application Support ซึ่งไม่ติด TCC
DEST_DIR="$HOME/Library/Application Support/idm-poc"
mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST_DIR/idm_host.py"
chmod +x "$DEST_DIR/idm_host.py"
HOST="$DEST_DIR/idm_host.py"

for DIR in \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" \
  "$HOME/Library/Application Support/Chromium/NativeMessagingHosts" \
  "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
do
  [ -d "$(dirname "$DIR")" ] || continue   # ข้ามเบราว์เซอร์ที่ไม่ได้ลง
  mkdir -p "$DIR"
  cat > "$DIR/com.tanplanet.idm.json" <<EOF
{
  "name": "com.tanplanet.idm",
  "description": "IDM-POC yt-dlp runner",
  "path": "$HOST",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$ID/"]
}
EOF
  echo "ติดตั้งแล้ว: $DIR/com.tanplanet.idm.json"
done

command -v yt-dlp >/dev/null || echo "⚠️  ยังไม่มี yt-dlp — brew install yt-dlp"
echo "host: $HOST"
echo "เสร็จ — reload extension ที่ chrome://extensions แล้วกด Download"
