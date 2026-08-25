/**
 * ============================================================
 *  💬 LineApi.gs — LINE Messaging API
 * ============================================================
 *  รองรับ:
 *   - ส่งรูป (sendLineImage)
 *   - ส่งข้อความ (sendLineText)
 *   - ส่งหลาย message พร้อมกัน (sendLineMessages)
 */

/**
 * ส่งรูปเข้ากลุ่ม LINE
 */
function sendLineImage(imageUrl) {
  const url = 'https://api.line.me/v2/bot/message/push';

  const payload = {
    to: CONFIG.LINE_GROUP_ID,
    messages: [{
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl
    }]
  };

  pushToLine(url, payload);
  Logger.log(`📤 ส่งรูปสำเร็จ: ${imageUrl}`);
}

/**
 * ส่งข้อความเข้ากลุ่ม LINE
 */
function sendLineText(text) {
  const url = 'https://api.line.me/v2/bot/message/push';

  const payload = {
    to: CONFIG.LINE_GROUP_ID,
    messages: [{
      type: 'text',
      text: text
    }]
  };

  pushToLine(url, payload);
  Logger.log(`📤 ส่งข้อความสำเร็จ`);
}

/**
 * ส่งหลาย message (รูป + ข้อความ) ในครั้งเดียว — LINE สูงสุด 5 messages/push
 */
function sendLineMessages(messages) {
  const url = 'https://api.line.me/v2/bot/message/push';

  const payload = {
    to: CONFIG.LINE_GROUP_ID,
    messages: messages
  };

  pushToLine(url, payload);
  Logger.log(`📤 ส่ง ${messages.length} messages สำเร็จ`);
}

/**
 * Helper — ยิง request ไป LINE API
 */
function pushToLine(url, payload) {
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.LINE_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error(`LINE API error ${code}: ${response.getContentText()}`);
  }
}

/**
 * 🔍 Webhook — ส่งต่อให้แผงคุม (Ring.gs) จัดการ postback + จำ groupId
 */
function doPost(e) {
  try {
    ringDoPost(e);
  } catch (err) {
    Logger.log('doPost error: ' + err + '\n' + (err.stack || ''));
  }
  return ContentService.createTextOutput('OK');
}
