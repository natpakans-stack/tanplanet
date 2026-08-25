/**
 * 🔧 Debug.gs — Helper functions
 */

const TEST_PREFIX = 'TEST_';
const SEND_LIVE_LINE = false;

/**
 * 🎯 ส่งรูปจาก Drive URL เข้ากลุ่ม LINE (one-shot)
 * แก้ FILE_ID ด้านล่างก่อน run
 *
 * ⚠️ ส่ง LINE จริง!
 */
function sendSpecificImage() {
  // 🎯 File ID จาก URL: drive.google.com/file/d/{FILE_ID}/view
  const FILE_ID = '1d3J0KQF-xe7REzYOrBM-6QZ4gqpajGvN';

  Logger.log('=== 🎯 Send Specific Image ===');

  try {
    // 1) เปิดไฟล์
    const file = DriveApp.getFileById(FILE_ID);
    Logger.log(`📁 ไฟล์: ${file.getName()}`);
    Logger.log(`📦 Type: ${file.getMimeType()}`);
    Logger.log(`💾 Size: ${(file.getSize() / 1024 / 1024).toFixed(2)} MB`);

    // 2) ตั้ง public
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('✅ ตั้ง public');

    // 3) สร้าง URL ที่ LINE โหลดได้
    const imageUrl = `https://lh3.googleusercontent.com/d/${FILE_ID}=w1024`;
    Logger.log(`🔗 URL: ${imageUrl}`);

    // 4) ส่ง LINE
    sendLineImage(imageUrl);
    Logger.log('✅ ส่งสำเร็จ — เช็คใน LINE');

  } catch (err) {
    Logger.log(`❌ Error: ${err.message}`);
    throw err;
  }
}

/**
 * 🔍 List ทุกไฟล์ใน folder
 */
function listAllFilesAnyType() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = folder.getFiles();
  const arr = [];

  while (files.hasNext()) {
    const f = files.next();
    arr.push({
      name: f.getName(),
      type: f.getMimeType(),
      date: f.getDateCreated(),
    });
  }

  arr.sort((a, b) => b.date - a.date);

  Logger.log(`📋 พบ ${arr.length} ไฟล์:`);
  arr.forEach((f, i) => {
    Logger.log(`${i + 1}. ${f.name} (${f.type})`);
  });
}

/**
 * 🛠️ Auto fix QR
 */
function autoFixDonationQR() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = folder.getFiles();
  let qrFile = null;

  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName().toLowerCase();
    if (name.includes('qr') || name.includes('donation')) {
      qrFile = f;
      break;
    }
  }

  if (!qrFile) {
    Logger.log('❌ ไม่พบ');
    return;
  }

  Logger.log(`📁 พบ: ${qrFile.getName()}`);
  if (qrFile.getName() !== 'donation-qr.png') {
    qrFile.setName('donation-qr.png');
  }
  qrFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  Logger.log('✅ Ready');
}

/**
 * ⭐ MEGA TEST
 */
function megaTest() {
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║         🧪 MEGA TEST START             ║');
  Logger.log('╚════════════════════════════════════════╝');

  const issues = [];

  // 1-2 Properties
  Logger.log('━━━ 1-2  Script Properties ━━━');
  const props = PropertiesService.getScriptProperties().getProperties();
  const required = ['OPENAI_API_KEY', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_GROUP_ID', 'DRIVE_FOLDER_ID'];
  required.forEach(key => {
    if (props[key]) {
      Logger.log(`✅ ${key}: OK`);
    } else {
      Logger.log(`❌ ${key}: MISSING`);
      issues.push(key);
    }
  });

  // 3-4 Drive + QR
  Logger.log('━━━ 3-4  Drive + QR ━━━');
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const allFiles = folder.getFiles();
  const fileList = [];
  while (allFiles.hasNext()) {
    const f = allFiles.next();
    fileList.push({ name: f.getName(), type: f.getMimeType() });
  }
  Logger.log(`📋 พบ ${fileList.length} ไฟล์`);

  const qr = fileList.find(f =>
    f.name.toLowerCase().includes('qr') || f.name.toLowerCase().includes('donation')
  );
  if (qr) {
    Logger.log(`✅ QR: ${qr.name}`);
  } else {
    Logger.log('❌ ไม่พบ QR');
    issues.push('QR');
  }

  // 5 Cache
  Logger.log('━━━ 5  Cache for Tomorrow ━━━');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = Utilities.formatDate(tomorrow, 'Asia/Bangkok', 'yyyy-MM-dd');
  if (props[`IMG_${tomorrowKey}`]) {
    Logger.log(`✅ Cache for ${tomorrowKey}`);
  } else {
    Logger.log(`⚠️ No cache for ${tomorrowKey}`);
  }

  // 6 Worker
  Logger.log('━━━ 6  Cloudflare Worker ━━━');
  try {
    const r = UrlFetchApp.fetch(`${WORKER_URL}/v1/models`, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() === 200) {
      Logger.log('✅ Worker OK');
    } else {
      Logger.log(`❌ Worker: ${r.getResponseCode()}`);
      issues.push('Worker');
    }
  } catch (err) {
    Logger.log(`❌ ${err.message}`);
    issues.push('Worker');
  }

  // 7 LINE
  Logger.log('━━━ 7  LINE API ━━━');
  try {
    const r = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + CONFIG.LINE_TOKEN },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() === 200) {
      Logger.log(`✅ LINE: ${JSON.parse(r.getContentText()).displayName}`);
    } else {
      issues.push('LINE');
    }
  } catch (err) {
    Logger.log(`❌ ${err.message}`);
    issues.push('LINE');
  }

  // 8 Triggers
  Logger.log('━━━ 8  Triggers ━━━');
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log(`⏰ Triggers: ${triggers.length}`);

  // Summary
  Logger.log('');
  if (issues.length === 0) {
    Logger.log('🎉 ALL PASSED!');
  } else {
    Logger.log(`⚠️ Issues: ${issues.join(', ')}`);
  }
}

function reuseLatestImage() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = folder.getFilesByType(MimeType.PNG);
  let latestFile = null;
  let latestDate = new Date(0);

  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName().toLowerCase();
    if (!name.includes('donation') && !name.includes('qr')) {
      const created = f.getDateCreated();
      if (created > latestDate) {
        latestDate = created;
        latestFile = f;
      }
    }
  }

  if (!latestFile) {
    Logger.log('❌ ไม่พบ');
    return;
  }

  latestFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const imageUrl = `https://lh3.googleusercontent.com/d/${latestFile.getId()}=w1024`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = Utilities.formatDate(tomorrow, 'Asia/Bangkok', 'yyyy-MM-dd');
  PropertiesService.getScriptProperties().setProperty(`IMG_${dateKey}`, imageUrl);
  Logger.log(`✅ Cache สำหรับ ${dateKey}: ${latestFile.getName()}`);
}

function cleanupTestImages() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = folder.getFiles();
  let count = 0;
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().startsWith(TEST_PREFIX)) {
      f.setTrashed(true);
      count++;
    }
  }
  Logger.log(`✅ ลบ ${count}`);
}