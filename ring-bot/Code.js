/**
 * ============================================================
 *  🌅 LINE Daily Greeting Bot — by น้องกริ่ง 🛎️
 *
 *  Schedule: 15 พ.ค. - 29 พ.ค. 2026 (14 + 1 วัน)
 *   15 พ.ค.       → รูปวันศุกร์ (ใช้รูปเดิม)
 *   16-28 พ.ค.    → รูปสวัสดีตามวัน (random theme)
 *   29 พ.ค. 🎁    → รูป QR + ข้อความขอบริจาคน้องกริ่ง
 *   30 พ.ค.+      → หยุดอัตโนมัติ
 * ============================================================
 */

const CONFIG = {
  OPENAI_API_KEY:  PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY'),
  LINE_TOKEN:      PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN'),
  LINE_GROUP_ID:   PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID'),
  DRIVE_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID'),
  TIMEZONE:        'Asia/Bangkok',

  START_DATE:      '2026-05-15',
  END_DATE:        '2026-05-29',
  DONATION_DATE:   '2026-05-29',

  DONATION_MESSAGE: 'รอรูปอยู่ใช่ไหม?? เพื่อให้ Project นี้ได้ไปต่อ\nให้โอนเงินสนับสนุน "น้องกริ่ง" ได้ง่าย ๆ\nตามกำลังศรัทธา 🛎️🙏',
};

/**
 * 🌙 Cron 00:00 — Generate รูปวันถัดไป
 */
function generateTomorrowImage() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isAfterEndDate(tomorrow)) {
      Logger.log('📅 เลย END_DATE — หยุดทำงาน + ลบ triggers');
      stopAllTriggers();
      return;
    }

    const tomorrowKey = Utilities.formatDate(tomorrow, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    if (tomorrowKey === CONFIG.DONATION_DATE) {
      Logger.log('🎁 พรุ่งนี้เป็นวัน donation — skip generate');
      return;
    }

    const dayIdx = tomorrow.getDay();
    const dayInfo = DAY_DATA[dayIdx];

    Logger.log(`🎨 กำลังสร้างรูปสำหรับวัน${dayInfo.nameTh}...`);

    const imageBlob = generateImageWithGemini(dayInfo);
    const imageUrl = uploadToDriveAndGetUrl(imageBlob, dayInfo.nameTh);

    PropertiesService.getScriptProperties().setProperty(`IMG_${tomorrowKey}`, imageUrl);

    Logger.log(`✅ เสร็จแล้ว! URL: ${imageUrl}`);
    return imageUrl;

  } catch (err) {
    Logger.log(`❌ Error: ${err.message}\n${err.stack}`);
    throw err;
  }
}

/**
 * 🌅 Cron 06ScriptApp.newTrigger('sendDailyGreeting'):00 — ส่งรูปเข้ากลุ่ม LINE
 */
function sendDailyGreeting() {
  try {
    const today = new Date();
    const dateKey = Utilities.formatDate(today, CONFIG.TIMEZONE, 'yyyy-MM-dd');

    if (isAfterEndDate(today)) {
      Logger.log('📅 เลย END_DATE');
      stopAllTriggers();
      return;
    }

    if (isBeforeStartDate(today)) {
      Logger.log('📅 ยังไม่ถึง START_DATE');
      return;
    }

    // 🎁 วัน donation
    if (dateKey === CONFIG.DONATION_DATE) {
      Logger.log('🎁 วัน Donation');
      sendDonationMessage();
      stopAllTriggers();
      return;
    }

    const dayIdx = today.getDay();
    const dayInfo = DAY_DATA[dayIdx];

    let imageUrl = PropertiesService.getScriptProperties().getProperty(`IMG_${dateKey}`);

    if (!imageUrl) {
      Logger.log('⚠️ Cache ไม่พบ — generate สด');
      const imageBlob = generateImageWithGemini(dayInfo);
      imageUrl = uploadToDriveAndGetUrl(imageBlob, dayInfo.nameTh);
    }

    sendLineImage(imageUrl);
    cleanupOldCache();

    Logger.log(`✅ ส่งภาพสวัสดีวัน${dayInfo.nameTh}เรียบร้อย`);

  } catch (err) {
    Logger.log(`❌ Error: ${err.message}\n${err.stack}`);
    throw err;
  }
}

/**
 * 💰 ส่ง QR donation + ข้อความ
 * 🆕 v2: หาไฟล์ QR แบบยืดหยุ่น — รับ PNG/JPG/JPEG
 */
function sendDonationMessage() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = folder.getFiles();
  let qrFile = null;

  // หาไฟล์ที่ชื่อมี "qr" หรือ "donation" (ไม่สน MIME type)
  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName().toLowerCase();
    if (name.includes('qr') || name.includes('donation')) {
      qrFile = f;
      break;
    }
  }

  if (!qrFile) {
    Logger.log('❌ ไม่พบรูป QR (ต้องมีคำว่า qr หรือ donation ในชื่อ)');
    return;
  }

  qrFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const qrUrl = `https://lh3.googleusercontent.com/d/${qrFile.getId()}=w1024`;

  Logger.log(`📁 ใช้ QR: ${qrFile.getName()} (${qrFile.getMimeType()})`);

  sendLineMessages([
    {
      type: 'image',
      originalContentUrl: qrUrl,
      previewImageUrl: qrUrl
    },
    {
      type: 'text',
      text: CONFIG.DONATION_MESSAGE
    }
  ]);

  Logger.log('💰 ส่ง donation message สำเร็จ — น้องกริ่งขอบคุณ 🛎️');
}

/**
 * 🧪 Test donation message (ส่ง LINE จริง!)
 */
function testDonationMessage() {
  Logger.log('=== 🧪 TEST DONATION (ส่ง LINE จริง) ===');
  sendDonationMessage();
}

function testNow() {
  Logger.log('=== 🧪 TEST MODE (ส่ง LINE จริง) ===');
  const url = generateTomorrowImage();
  if (url) sendLineImage(url);
  Logger.log('✅ Test เสร็จ');
}

function setupTriggers() {
  // ponytail: เว้น ringDailyReminder ไว้ — ไม่งั้นตั้ง trigger รูปทับทีเดียวเตือนหนี้หายหมด
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() !== 'ringDailyReminder')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('generateTomorrowImage')
    .timeBased().everyDays(1).atHour(0).create();

  ScriptApp.newTrigger('sendDailyGreeting')
    .timeBased().everyDays(1).atHour(6).create();

  Logger.log('✅ Trigger พร้อมใช้งาน:');
  Logger.log(`   📅 ${CONFIG.START_DATE} → ${CONFIG.END_DATE}`);
  Logger.log(`   🎁 ${CONFIG.DONATION_DATE} → ส่ง QR`);
}

function stopAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() !== 'ringDailyReminder');
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log(`🛑 ลบ ${triggers.length} triggers (เก็บ ringDailyReminder ไว้)`);
}

function isAfterEndDate(date) {
  return date > new Date(CONFIG.END_DATE + 'T23:59:59');
}

function isBeforeStartDate(date) {
  return date < new Date(CONFIG.START_DATE + 'T00:00:00');
}

function cleanupOldCache() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  Object.keys(all).forEach(key => {
    if (!key.startsWith('IMG_')) return;
    const dateStr = key.replace('IMG_', '');
    const d = new Date(dateStr);
    if (d < cutoff) {
      props.deleteProperty(key);
    }
  });
}