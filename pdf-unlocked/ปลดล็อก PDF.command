#!/usr/bin/env bash
# ดับเบิลคลิกไฟล์นี้เพื่อเปิดเครื่องมือปลดล็อก PDF
cd /Users/natpakansirirat/Documents/Projects/tanplanet/pdf-unlocked
( sleep 1 && open http://localhost:3777 ) &
exec ~/.bun/bin/bun server.js
