/**
 * Ring.js — แผงคุมน้องกริ่ง
 * สร้างบิลผ่านฟอร์มเว็บ → เก็บลงชีต → ยิงเตือนตามวัน-เวลาที่ตั้ง (ทำซ้ำได้)
 * เสียบจาก doPost เดิมใน LineApi.js ด้วย ringDoPost(e)
 */

var TZ = 'Asia/Bangkok';
var API = 'https://api.line.me/v2/bot';
var MENU_PREFIX = 'ring-console';

// ---------- config ----------
function prop_(k, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v && fallback === undefined) throw new Error('ยังไม่ได้ตั้ง Script Property: ' + k);
  return v || fallback;
}
function token_() { return prop_('LINE_CHANNEL_ACCESS_TOKEN'); }

// ---------- LINE api ----------
function line_(path, payload, method) {
  var res = UrlFetchApp.fetch(API + path, {
    method: method || (payload ? 'post' : 'get'),
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token_() },
    payload: payload ? JSON.stringify(payload) : undefined,
    muteHttpExceptions: true
  });
  var code = res.getResponseCode(), body = res.getContentText();
  if (code >= 300) throw new Error('LINE ' + code + ': ' + body);
  return body ? JSON.parse(body) : {};
}
/** เรียกแบบไม่แคร์ error — ใช้ตอนปลดเมนูคนที่อาจไม่เคยผูก */
function lineTry_(path, payload, method) {
  try { return line_(path, payload, method); } catch (e) { return null; }
}
function reply_(replyToken, messages) {
  line_('/message/reply', { replyToken: replyToken, messages: [].concat(messages) });
}
/** push + บันทึก log — ใช้ตัวนี้แทน push ดิบทุกที่ */
function ringPush(to, messages, note) {
  var ok = true, err = '';
  try { line_('/message/push', { to: to, messages: [].concat(messages) }); }
  catch (e) { ok = false; err = String(e); }
  sheet_('pushlog').appendRow([new Date(), to, targetName_(to), note || '', ok ? 'ok' : 'fail', err]);
  if (!ok) throw new Error(err);
}

// ---------- sheets ----------
var HEADERS = {
  bills:   ['id', 'สร้างเมื่อ', 'โหมด', 'ปลายทาง', 'ชื่อบิล', 'คู่กรณี', 'ยอด',
            'ธนาคาร', 'ชื่อบัญชี', 'เลขบัญชี', 'เริ่มเมื่อ', 'เตือนเมื่อ', 'ทำซ้ำ',
            'จำนวนครั้ง', 'ส่งไปแล้ว', 'สถานะ', 'ส่งล่าสุด', 'โน้ต', 'รูป QR'],
  pushlog: ['เวลา', 'ปลายทาง', 'ชื่อ', 'ประเภท', 'ผล', 'error'],
  budgetlog: ['เวลา', 'เดือน', 'แท็บ Budget-Bajjo', 'สถานะ', 'รายการ', 'รายละเอียด'],
  targets: ['id', 'ชนิด', 'ชื่อ', 'เห็นล่าสุด', 'ให้ใช้เมนู']
};

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var s = SpreadsheetApp.create('น้องกริ่ง — แผงคุม');
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', s.getId());
  return s;
}
function sheet_(name) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(HEADERS[name]); sh.setFrozenRows(1); }
  // เผื่อชีตเก่าที่หัวตารางยังไม่ครบ (เช่นเพิ่มคอลัมน์ "ให้ใช้เมนู" ทีหลัง)
  var head = sh.getRange(1, 1, 1, HEADERS[name].length).getValues()[0];
  if (head.join('|') !== HEADERS[name].join('|')) {
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
  }
  return sh;
}
function rows_(name) {
  var sh = sheet_(name), v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var head = v[0];
  return v.slice(1).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, c) { o[h] = r[c]; });
    return o;
  });
}
function setCell_(name, row, header, value) {
  sheet_(name).getRange(row, HEADERS[name].indexOf(header) + 1).setValue(value);
}
function yes_(v) {
  var s = String(v).trim().toLowerCase();
  return v === true || s === 'ใช่' || s === 'yes' || s === 'y' || s === 'true' || s === '1';
}

// ---------- helpers ----------
function baht_(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function thaiDate_(d) {
  d = d instanceof Date ? d : new Date(d);
  var m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543).toString().slice(-2);
}
function thaiDateTime_(d) {
  d = d instanceof Date ? d : new Date(d);
  return thaiDate_(d) + ' ' + Utilities.formatDate(d, TZ, 'HH:mm') + ' น.';
}
function targetName_(id) {
  var hit = rows_('targets').filter(function (t) { return t.id === id; })[0];
  return hit ? hit['ชื่อ'] : '';
}
/** บวกเดือนแบบไม่ล้น: 31 ม.ค. +1 = 28 ก.พ. (ไม่ใช่ 3 มี.ค.) เหมือนที่ขุนทองทำ */
function addMonths_(d, n) {
  var day = d.getDate();
  var x = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), 0, 0);
  var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}
/** ครั้งที่ n (นับจาก 0) ของบิล — คิดจาก "เริ่มเมื่อ" เสมอ วันที่เลยไม่ drift */
function fireAt_(start, repeat, n) {
  start = start instanceof Date ? start : new Date(start);
  if (n === 0) return start;
  if (repeat === 'เดือน') return addMonths_(start, n);
  if (repeat === 'สัปดาห์') return new Date(start.getTime() + n * 7 * 86400000);
  return null;
}

// ---------- พร้อมเพย์ (EMVCo QR) ----------
/** CRC-16/CCITT-FALSE — poly 0x1021, init 0xFFFF, ไม่ reflect, ไม่ xor ท้าย */
function crc16_(str) {
  var crc = 0xFFFF;
  for (var i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) & 0xFF) << 8;
    for (var b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  var hex = crc.toString(16).toUpperCase();
  return '0000'.slice(hex.length) + hex;
}
function tlv_(id, value) {
  var len = String(value.length);
  return id + ('00' + len).slice(-2) + value;
}
/** เบอร์ 10 หลัก → 0066xxxxxxxxx (13 หลัก) · บัตร ปชช./e-Wallet ใช้ตัวเลขตรง ๆ */
function ppTarget_(raw) {
  var d = String(raw || '').replace(/[^0-9]/g, '');
  if (d.length >= 13) return { tag: d.length >= 15 ? '03' : '02', value: d };
  return { tag: '01', value: ('0000000000000' + d.replace(/^0/, '66')).slice(-13) };
}
/**
 * สร้าง payload พร้อมเพย์ — เรียกจากฟอร์มผ่าน google.script.run
 * ยอดเงินติดมากับ QR เลย ผู้จ่ายไม่ต้องพิมพ์เอง
 */
function ppPayload(o) {
  o = o || {};
  var t = ppTarget_(o.target);
  if (t.value.replace(/^0+/, '').length < 9) throw new Error('เลขพร้อมเพย์ไม่ครบ');
  var amount = Number(o.amount);
  var hasAmount = isFinite(amount) && amount > 0;
  var body =
    tlv_('00', '01') +
    tlv_('01', hasAmount ? '12' : '11') +
    tlv_('29', tlv_('00', 'A000000677010111') + tlv_(t.tag, t.value)) +
    tlv_('58', 'TH') +
    tlv_('53', '764') +
    (hasAmount ? tlv_('54', amount.toFixed(2)) : '');
  var withCrcTag = body + '6304';
  return withCrcTag + crc16_(withCrcTag);
}

/** เก็บ PNG ของ QR ลง Drive แล้วคืน URL ที่ LINE ใช้เป็นรูปได้ */
function saveQr_(id, dataUrl) {
  var m = String(dataUrl || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return '';
  var folders = DriveApp.getFoldersByName('น้องกริ่ง QR');
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('น้องกริ่ง QR');
  var blob = Utilities.newBlob(Utilities.base64Decode(m[1]), 'image/png', id + '.png');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + file.getId() + '=w720';
}

// ---------- ฟอร์มสร้างบิล ----------
/**
 * ponytail: ไม่มี key ซ้อน — URL /exec เป็นสตริงสุ่มยาวที่ไม่มีทางเดา และอยู่แค่ในเมนูของคนที่ถูก
 * allowlist (ดู ringSyncMenu) เท่านั้น เป็นกลไกเดียวกับที่ LINE webhook พึ่งอยู่
 * ด่านจริงคือ saveBill: ปลายทางต้องเป็น id ที่มีในชีต targets เท่านั้น ยิงมั่วไม่ได้
 */
function doGet() {
  var t = HtmlService.createTemplateFromFile('bill');
  t.targets = JSON.stringify(rows_('targets').map(function (x) {
    return { id: x.id, name: x['ชื่อ'] || x.id, type: x['ชนิด'] };
  }));
  return t.evaluate()
    .setTitle('สร้างบิล — น้องกริ่ง')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** เรียกจากฟอร์มผ่าน google.script.run — ไม่เชื่อค่าที่ส่งมาเลย ตรวจทุกช่อง */
function saveBill(o) {
  o = o || {};
  var known = rows_('targets').filter(function (t) { return t.id === String(o.to || '').trim(); })[0];
  if (!known) throw new Error('ปลายทางไม่ถูกต้อง — เลือกจากรายการที่บอทรู้จักเท่านั้น');

  var title = String(o.title || '').trim();
  if (!title) throw new Error('ใส่ชื่อบิลด้วย');

  // เว้นยอดว่างได้ — QR จะเป็นแบบให้ผู้จ่ายกรอกยอดเอง
  var amount = Number(o.amount) || 0;
  if (!isFinite(amount) || amount < 0) throw new Error('ยอดเงินไม่ถูกต้อง');

  var now = !!o.sendNow;
  var repeat = !now && ['เดือน', 'สัปดาห์'].indexOf(o.repeat) >= 0 ? o.repeat : '';
  var times = '';
  if (repeat) {
    if (o.times === '' || o.times === null || o.times === undefined) times = '';   // ไม่มีจุดสิ้นสุด
    else {
      times = Math.floor(Number(o.times));
      if (!(times >= 1 && times <= 120)) throw new Error('จำนวนครั้งต้องอยู่ระหว่าง 1–120');
    }
  } else times = 1;

  var start;
  if (now) start = new Date();
  else {
    var m = String(o.when || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!m) throw new Error('วัน-เวลาไม่ถูกต้อง');
    start = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
    if (isNaN(start.getTime())) throw new Error('วัน-เวลาไม่ถูกต้อง');
  }

  var billId = 'b' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss');
  var qrUrl = o.qr ? saveQr_(billId, o.qr) : '';

  var row = [
    billId, new Date(), o.mode === 'ทวง' ? 'ทวง' : 'จ่าย', known.id, title,
    String(o.who || '').trim(), amount,
    String(o.bank || '').trim(), String(o.accName || '').trim(), String(o.acc || '').trim(),
    start, start, repeat, times,
    now ? 1 : 0, now ? 'จบแล้ว' : '', now ? start : '',
    String(o.note || '').trim(), qrUrl
  ];
  sheet_('bills').appendRow(row);

  if (now) {
    var bill = {};
    HEADERS.bills.forEach(function (h, i) { bill[h] = row[i]; });
    bill['ส่งไปแล้ว'] = 0;   // การ์ดโชว์ "ครั้งที่ 1"
    var alt = title + (amount > 0 ? ' ฿' + baht_(amount) : '');
    ringPush(known.id, { type: 'flex', altText: alt, contents: billBubble_(bill) }, 'บิล');
    return 'ส่งเข้า ' + known['ชื่อ'] + ' แล้ว' + (amount > 0 ? ' — ฿' + baht_(amount) : ' (ไม่ระบุยอด)');
  }

  var tail = !repeat ? 'ครั้งเดียว'
    : times === '' ? 'ทำซ้ำทุก' + repeat + ' ไม่มีจุดสิ้นสุด'
    : 'ทำซ้ำทุก' + repeat + ' ' + times + ' ครั้ง (ครั้งสุดท้าย ' + thaiDate_(fireAt_(start, repeat, times - 1)) + ')';
  return 'ตั้งเวลาแล้ว' + (amount > 0 ? '' : ' (ไม่ระบุยอด — ผู้จ่ายกรอกเอง)') +
    '\nเตือนครั้งแรก ' + thaiDateTime_(start) + '\nส่งเข้า ' + known['ชื่อ'] + '\n' + tail;
}

// ---------- webhook ----------
function ringDoPost(e) {
  var body = JSON.parse(e.postData.contents);
  (body.events || []).forEach(function (ev) {
    rememberTarget_(ev);
    if (ev.type === 'postback') onPostback_(ev);
    else if (ev.type === 'message' && ev.message.type === 'text') {
      var t = ev.message.text.trim();
      // ตรวจหวยเปิดให้ทุกที่รวมกลุ่ม — แต่ตอบเฉพาะข้อความที่เป็นเลข 6 หลักล้วนหรือคำสั่งหวยตรง ๆ
      var nums = lottoNumbers_(t);
      if (nums.length) return reply_(ev.replyToken, lottoReply_(nums));
      if (t === 'หวย' || t === 'ตรวจหวย' || t === 'สลาก' || t === 'ผลสลาก') return reply_(ev.replyToken, lottoReply_([]));
      if (ev.source.type === 'user' && (t === 'เมนู' || t === 'menu' || t === 'ช่วยเหลือ')) reply_(ev.replyToken, helpCard_());
    }
  });
}

/** จำ groupId/userId ที่บอทเจอ ไว้ให้ฟอร์มเลือกปลายทาง + ใช้เป็น allowlist */
function rememberTarget_(ev) {
  var s = ev.source, id = s.groupId || s.roomId || s.userId;
  if (!id) return;
  var sh = sheet_('targets');
  var hit = rows_('targets').filter(function (t) { return t.id === id; })[0];
  var name = '';
  try {
    if (s.groupId) name = line_('/group/' + s.groupId + '/summary').groupName;
    else if (s.type === 'user') name = line_('/profile/' + s.userId).displayName;
  } catch (err) { name = hit ? hit['ชื่อ'] : ''; }
  if (hit) sh.getRange(hit._row, 1, 1, 4).setValues([[id, s.type, name || hit['ชื่อ'], new Date()]]);
  else sh.appendRow([id, s.type, name, new Date(), '']);   // ยังไม่ให้ใช้เมนูจนกว่าจะติ๊กเอง
}

function onPostback_(ev) {
  var p = {};
  ev.postback.data.split('&').forEach(function (kv) {
    var a = kv.split('='); p[a[0]] = decodeURIComponent(a[1] || '');
  });
  switch (p.action) {
    case 'quota':   return reply_(ev.replyToken, quotaCard_());
    case 'stats':   return reply_(ev.replyToken, statsCard_());
    case 'due':     return reply_(ev.replyToken, dueCard_());
    case 'targets': return reply_(ev.replyToken, targetsCard_());
    case 'close':   return reply_(ev.replyToken, closeBill_(p.id));
    default:        return reply_(ev.replyToken, helpCard_());
  }
}

// ---------- การ์ด ----------
function flex_(alt, bubble) { return { type: 'flex', altText: alt, contents: bubble }; }

function quotaCard_() {
  var q = line_('/message/quota'), c = line_('/message/quota/consumption');
  var limit = q.type === 'limited' ? q.value : null, used = c.totalUsage;
  var pct = limit ? Math.min(100, Math.round(used / limit * 100)) : 0;
  var bar = limit ? {
    type: 'box', layout: 'vertical', margin: 'lg', height: '8px',
    backgroundColor: '#E9ECEF', cornerRadius: '4px',
    contents: [{ type: 'box', layout: 'vertical', width: Math.max(pct, 2) + '%', height: '8px',
      backgroundColor: pct >= 90 ? '#D64545' : pct >= 70 ? '#E8A33D' : '#2F8F5B',
      cornerRadius: '4px', contents: [] }]
  } : { type: 'filler' };
  return flex_('เครดิตเดือนนี้', { type: 'bubble', body: {
    type: 'box', layout: 'vertical', paddingAll: '20px', contents: [
      { type: 'text', text: 'เครดิตข้อความ', size: 'sm', color: '#8A9099' },
      { type: 'text', text: Utilities.formatDate(new Date(), TZ, 'MMMM yyyy'), size: 'xs', color: '#B0B6BD', margin: 'xs' },
      { type: 'text', text: limit === null ? String(used) : used + ' / ' + limit,
        size: '3xl', weight: 'bold', color: '#1F2328', margin: 'md' },
      bar,
      { type: 'text', text: limit === null ? 'แพ็กเกจไม่จำกัด' : 'เหลือ ' + (limit - used) + ' ข้อความ (' + (100 - pct) + '%)',
        size: 'sm', color: limit && pct >= 90 ? '#D64545' : '#5A6169', margin: 'md' },
      { type: 'separator', margin: 'xl' },
      { type: 'text', text: 'นับเฉพาะ push/broadcast — reply ไม่กินโควตา',
        size: 'xxs', color: '#B0B6BD', margin: 'md', wrap: true }
    ]}});
}

function statsCard_() {
  var m = Utilities.formatDate(new Date(), TZ, 'yyyy-MM'), by = {};
  rows_('pushlog').forEach(function (r) {
    if (Utilities.formatDate(new Date(r['เวลา']), TZ, 'yyyy-MM') !== m) return;
    var k = r['ชื่อ'] || r['ปลายทาง'];
    by[k] = (by[k] || 0) + 1;
  });
  var list = Object.keys(by).map(function (k) { return { k: k, n: by[k] }; })
    .sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
  var total = list.reduce(function (s, x) { return s + x.n; }, 0);
  var lines = list.length ? list.map(function (x) {
    return { type: 'box', layout: 'horizontal', margin: 'md', contents: [
      { type: 'text', text: x.k, size: 'sm', color: '#1F2328', flex: 5 },
      { type: 'text', text: String(x.n), size: 'sm', color: '#5A6169', align: 'end', flex: 1 }]};
  }) : [{ type: 'text', text: 'เดือนนี้ยังไม่ได้ส่งอะไรออกไป', size: 'sm', color: '#B0B6BD', margin: 'md', wrap: true }];
  return flex_('สถิติการส่งเดือนนี้', { type: 'bubble', body: {
    type: 'box', layout: 'vertical', paddingAll: '20px', contents: [
      { type: 'text', text: 'ส่งไปที่ไหนบ้าง', size: 'sm', color: '#8A9099' },
      { type: 'text', text: total + ' ครั้ง', size: '3xl', weight: 'bold', color: '#1F2328', margin: 'xs' },
      { type: 'separator', margin: 'lg' }
    ].concat(lines)}});
}

function targetsCard_() {
  var list = rows_('targets').slice(-10).reverse();
  var lines = list.length ? list.map(function (t) {
    return { type: 'box', layout: 'vertical', margin: 'lg', contents: [
      { type: 'text', text: (t['ชนิด'] === 'group' ? 'กลุ่ม · ' : 'คน · ') + (t['ชื่อ'] || '(ไม่มีชื่อ)')
        + (yes_(t['ให้ใช้เมนู']) ? '  [ใช้เมนูได้]' : ''), size: 'sm', color: '#1F2328', wrap: true },
      { type: 'text', text: t.id, size: 'xxs', color: '#B0B6BD' }]};
  }) : [{ type: 'text', text: 'ยังไม่เจอใครเลย — พิมพ์ในกลุ่มสักครั้งให้บอทเห็น', size: 'sm', color: '#B0B6BD', wrap: true, margin: 'md' }];
  return flex_('ปลายทางที่บอทรู้จัก', { type: 'bubble', body: {
    type: 'box', layout: 'vertical', paddingAll: '20px', contents: [
      { type: 'text', text: 'ปลายทางที่บอทรู้จัก', size: 'sm', color: '#8A9099' },
      { type: 'text', text: 'เลือกได้ในหน้าสร้างบิล', size: 'xxs', color: '#B0B6BD', margin: 'xs' }
    ].concat(lines)}});
}

// ---------- บิล ----------
function dueCard_() {
  var list = rows_('bills').filter(function (b) {
    return String(b['สถานะ']).trim() === '' && b['เตือนเมื่อ'];
  }).sort(function (a, b) { return new Date(a['เตือนเมื่อ']) - new Date(b['เตือนเมื่อ']); }).slice(0, 5);
  if (!list.length) return { type: 'text', text: 'ยังไม่มีบิลที่รออยู่' };
  return { type: 'flex', altText: 'บิลที่รออยู่',
    contents: { type: 'carousel', contents: list.map(function (b) { return billBubble_(b, { admin: true }); }) } };
}

function billBubble_(b, opts) {
  opts = opts || {};
  var collect = b['โหมด'] === 'ทวง';
  var when = new Date(b['เตือนเมื่อ']);
  var accent = collect ? '#2F6BD6' : '#2F8F5B';
  var acc = String(b['เลขบัญชี'] || '').trim();
  var n = Number(b['ส่งไปแล้ว'] || 0) + 1;
  var total = b['จำนวนครั้ง'];
  var รอบ = !b['ทำซ้ำ'] ? '' : (total === '' || total === null
    ? 'ครั้งที่ ' + n + ' · ทุก' + b['ทำซ้ำ']
    : 'ครั้งที่ ' + n + ' / ' + total);

  var isPP = String(b['ธนาคาร'] || '').indexOf('พร้อมเพย์') === 0;
  var bank = acc ? [
    { type: 'separator', margin: 'lg' },
    { type: 'text', text: isPP ? 'โอนผ่านพร้อมเพย์' : 'โอนเข้าบัญชี', size: 'xs', color: '#8A9099', margin: 'lg' },
    { type: 'text', text: String(b['ธนาคาร'] || ''), size: 'sm', color: '#1F2328', margin: 'xs' },
    { type: 'text', text: acc, size: 'xl', weight: 'bold', color: '#1F2328', margin: 'xs' },
    { type: 'text', text: String(b['ชื่อบัญชี'] || ''), size: 'sm', color: '#5A6169', margin: 'xs' }
  ] : [];

  var buttons = [];
  if (b['รูป QR']) buttons.push({ type: 'button', style: 'primary', height: 'sm', color: accent,
    action: { type: 'uri', label: 'เปิด QR เต็มจอ', uri: String(b['รูป QR']) } });
  else if (acc) buttons.push({ type: 'button', style: 'primary', height: 'sm', color: accent,
    action: { type: 'clipboard', label: 'ก๊อปเลขบัญชี', clipboardText: acc.replace(/[^0-9]/g, '') } });
  // ponytail: ปุ่มปิดบิลเฉพาะแชต 1:1 — การ์ดในกลุ่มไม่มี ใครเผลอกดไม่ได้
  if (opts.admin) buttons.push({ type: 'button', style: acc ? 'secondary' : 'primary', height: 'sm',
    color: acc ? undefined : accent,
    action: { type: 'postback', label: 'ปิดบิลนี้', data: 'action=close&id=' + encodeURIComponent(b.id),
              displayText: 'ปิดบิล: ' + b['ชื่อบิล'] } });

  return { type: 'bubble', size: 'kilo',
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: [
      { type: 'box', layout: 'horizontal', contents: [
        { type: 'text', text: collect ? 'เรียกเก็บเงิน' : 'ครบกำหนดจ่าย', size: 'xs', color: accent, weight: 'bold', flex: 0 },
        { type: 'text', text: thaiDate_(when), size: 'xs', color: '#8A9099', align: 'end' }
      ]},
      { type: 'text', text: String(b['ชื่อบิล'] || '-'), size: 'lg', weight: 'bold', color: '#1F2328', margin: 'md', wrap: true },
      รอบ ? { type: 'text', text: รอบ, size: 'xs', color: '#8A9099', margin: 'xs' } : { type: 'filler' },
      b['คู่กรณี'] ? { type: 'text', text: (collect ? 'เก็บจาก ' : 'จ่ายให้ ') + b['คู่กรณี'],
        size: 'xs', color: '#8A9099', margin: 'xs', wrap: true } : { type: 'filler' },
      Number(b['ยอด']) > 0
        ? { type: 'text', text: '฿' + baht_(b['ยอด']), size: 'xxl', weight: 'bold', color: '#1F2328', margin: 'md' }
        : { type: 'text', text: 'ระบุยอดเอง', size: 'lg', weight: 'bold', color: '#8A9099', margin: 'md' },
      { type: 'text', text: 'เตือน ' + thaiDateTime_(when), size: 'sm', color: '#5A6169', margin: 'xs' }
    ].concat(bank).concat(
      b['รูป QR'] ? [
        { type: 'text', text: Number(b['ยอด']) > 0 ? 'สแกนจ่ายได้เลย ยอดล็อกมากับ QR' : 'สแกนแล้วกรอกยอดเอง',
          size: 'xxs', color: '#8A9099', margin: 'lg' },
        { type: 'image', url: String(b['รูป QR']), size: 'full', aspectRatio: '1:1',
          aspectMode: 'fit', backgroundColor: '#FFFFFF', margin: 'sm',
          action: { type: 'uri', label: 'เปิด QR', uri: String(b['รูป QR']) } }
      ] : []
    ).concat(
      b['โน้ต'] ? [{ type: 'text', text: String(b['โน้ต']), size: 'xs', color: '#8A9099', margin: 'lg', wrap: true }] : []
    )},
    footer: buttons.length ? { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: buttons } : undefined
  };
}

function closeBill_(id) {
  var hit = rows_('bills').filter(function (b) { return String(b.id) === String(id); })[0];
  if (!hit) return { type: 'text', text: 'ไม่เจอบิลนี้แล้ว' };
  setCell_('bills', hit._row, 'สถานะ', 'ปิดแล้ว');
  return { type: 'text', text: 'ปิดบิลแล้ว: ' + hit['ชื่อบิล'] + ' ฿' + baht_(hit['ยอด']) };
}

/** trigger ทุก 5 นาที — ยิงบิลที่ถึงเวลา แล้วเลื่อนรอบถัดไป */
function ringTick() {
  var now = new Date();
  rows_('bills').forEach(function (b) {
    if (String(b['สถานะ']).trim() !== '') return;
    if (!b['เตือนเมื่อ'] || new Date(b['เตือนเมื่อ']) > now) return;

    var card = billBubble_(b);                       // ปั้นการ์ดก่อนขยับเลข
    var sent = Number(b['ส่งไปแล้ว'] || 0) + 1;
    var total = b['จำนวนครั้ง'] === '' || b['จำนวนครั้ง'] === null ? Infinity : Number(b['จำนวนครั้ง']);
    var next = b['ทำซ้ำ'] ? fireAt_(b['เริ่มเมื่อ'], b['ทำซ้ำ'], sent) : null;

    // เขียนสถานะก่อน push — push พังยังไงก็ไม่ยิงซ้ำ
    setCell_('bills', b._row, 'ส่งไปแล้ว', sent);
    setCell_('bills', b._row, 'ส่งล่าสุด', now);
    if (next && sent < total) setCell_('bills', b._row, 'เตือนเมื่อ', next);
    else setCell_('bills', b._row, 'สถานะ', 'จบแล้ว');

    var alt = b['ชื่อบิล'] + (Number(b['ยอด']) > 0 ? ' ฿' + baht_(b['ยอด']) : '');
    try {
      ringPush(b['ปลายทาง'], { type: 'flex', altText: alt, contents: card }, 'บิล');
      if (String(b.id).indexOf('budget-') === 0) budgetLogBill_(b, 'ส่งสำเร็จ', 'LINE รับข้อความแล้ว');
    } catch (err) {
      if (String(b.id).indexOf('budget-') === 0) budgetLogBill_(b, 'ส่งไม่สำเร็จ', String(err));
      throw err;
    }
  });

  // งานเชื่อม Budget-Bajjo ใช้ trigger ตัวเดียวกัน เพื่อไม่เพิ่ม trigger ซ้ำโดยไม่จำเป็น
  budgetTick_();
  // ponytail: หวยพลาดงวดเดียว ไม่คุ้มให้บิลทั้งชุดค้าง — error ลงใน pushlog อยู่แล้ว
  try { lottoTick_(); } catch (e) {}
}

// ---------- Budget-Bajjo → LINE ----------
var BUDGET_SHEET_ID = '1ZqQeBWWKLf3OW1Lee-J5AJRFg7Ui3L1SqNmdToshgXQ';

/**
 * ตั้งค่าผ่าน Script Properties:
 * BUDGET_SEND_DAY      ไม่บังคับ; วันที่ส่งทุกเดือน (default 28)
 * BUDGET_SEND_TIME     ไม่บังคับ; เวลาที่ส่ง (default 09:00)
 * BUDGET_LINE_USER_ID  ไม่บังคับ; override LINE user id ของโจ้
 * BUDGET_MOTHER_PROMPTPAY / BUDGET_TAN_PROMPTPAY เป็น fallback กรณีไม่มีข้อมูลในแผงควบคุม
 * BUDGET_SHEET_ID      ไม่ใส่ก็ใช้ชีต Budget-Bajjo ตัวจริงด้านบน
 */
function budgetConfig_() {
  var p = PropertiesService.getScriptProperties();
  var day = Math.floor(Number(p.getProperty('BUDGET_SEND_DAY') || 28));
  var time = String(p.getProperty('BUDGET_SEND_TIME') || '09:00').trim();
  var tm = time.match(/^(\d{2}):(\d{2})$/);
  if (!(day >= 1 && day <= 31)) throw new Error('BUDGET_SEND_DAY ต้องเป็นวันที่ 1–31');
  if (!tm || Number(tm[1]) > 23 || Number(tm[2]) > 59) throw new Error('ตั้ง BUDGET_SEND_TIME เป็น HH:mm เช่น 09:00');
  var now = new Date();
  var year = Number(Utilities.formatDate(now, TZ, 'yyyy'));
  var month = Number(Utilities.formatDate(now, TZ, 'M')) - 1;
  var lastDay = new Date(year, month + 1, 0).getDate();
  var when = new Date(year, month, Math.min(day, lastDay), Number(tm[1]), Number(tm[2]), 0, 0);

  var recentBudgetBill = rows_('bills').filter(function (b) {
    var who = String(b['คู่กรณี'] || '').trim();
    return (who === 'แม่' || who === 'แทน') && String(b['ปลายทาง'] || '').trim();
  }).sort(function (a, b) { return new Date(b['สร้างเมื่อ']) - new Date(a['สร้างเมื่อ']); })[0];
  var to = String(p.getProperty('BUDGET_LINE_USER_ID') ||
    (recentBudgetBill ? recentBudgetBill['ปลายทาง'] : '')).trim();
  if (!to) throw new Error('หา LINE ของโจ้จากบิลแม่/แทนไม่พบ และยังไม่ได้ตั้ง BUDGET_LINE_USER_ID');
  if (!rows_('targets').some(function (t) { return String(t.id) === to && t['ชนิด'] === 'user'; })) {
    throw new Error('BUDGET_LINE_USER_ID ต้องเป็น user ที่เคยทักบอทและอยู่ในแท็บ targets');
  }

  return {
    when: when,
    period: Utilities.formatDate(when, TZ, 'yyyy-MM'),
    to: to,
    promptpays: {
      'แม่': budgetPromptpayFor_('แม่', 'BUDGET_MOTHER_PROMPTPAY'),
      'แทน': budgetPromptpayFor_('แทน', 'BUDGET_TAN_PROMPTPAY')
    },
    sheetId: String(p.getProperty('BUDGET_SHEET_ID') || BUDGET_SHEET_ID).trim()
  };
}

function budgetPromptpayFor_(payee, fallbackProperty) {
  var hit = rows_('bills').filter(function (b) {
    return String(b['คู่กรณี'] || '').trim() === payee &&
      String(b['ธนาคาร'] || '').indexOf('พร้อมเพย์') === 0 &&
      String(b['เลขบัญชี'] || '').replace(/[^0-9]/g, '').length >= 10;
  }).sort(function (a, b) { return new Date(b['สร้างเมื่อ']) - new Date(a['สร้างเมื่อ']); })[0];
  var value = hit
    ? String(hit['เลขบัญชี']).replace(/[^0-9]/g, '')
    : String(PropertiesService.getScriptProperties().getProperty(fallbackProperty) || '').replace(/[^0-9]/g, '');
  if (value.length < 10) throw new Error('ไม่พบพร้อมเพย์ของ' + payee + 'ในแผงควบคุม และยังไม่ได้ตั้ง ' + fallbackProperty);
  return value;
}

function budgetMonthAliases_(month) {
  return [
    ['jan', 'january'], ['feb', 'february'], ['mar', 'march'], ['apr', 'april'], ['may'],
    ['jun', 'june'], ['jul', 'july'], ['aug', 'august'], ['sep', 'sept', 'september'],
    ['oct', 'october'], ['nov', 'november'], ['dec', 'december']
  ][month];
}

function budgetSheetFor_(ss, when) {
  var month = Number(Utilities.formatDate(when, TZ, 'M')) - 1;
  var buddhistYear = (Number(Utilities.formatDate(when, TZ, 'yyyy')) + 543) % 100;
  var aliases = budgetMonthAliases_(month);
  var hit = ss.getSheets().filter(function (sh) {
    var name = sh.getName().trim().toLowerCase().replace(/\s+/g, ' ');
    return aliases.some(function (m) { return name === m + ' ' + buddhistYear; });
  })[0];
  if (!hit) throw new Error('ไม่พบแท็บเดือน ' + (month + 1) + '/' + buddhistYear + ' ใน Budget-Bajjo');
  return hit;
}

function budgetNumber_(value) {
  var cleaned = String(value == null ? '' : value).replace(/[^0-9.\-]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

/**
 * ค่าไฟของแท็บเดือนนี้ต้องมาจาก MEA รอบเดือนก่อนหน้าและมีสูตรส่วนแบ่ง 60% จริง
 * หาก email/สูตรยังไม่พร้อม ให้ throw เพื่อให้ ringTick รอบถัดไปลองใหม่โดยไม่สร้างบิลค้าง
 */
function budgetElectricityReady_(sheet, targetWhen) {
  var finder = sheet.createTextFinder('ค่าไฟ***').matchCase(false).matchEntireCell(true);
  var labelCell = finder.findNext();
  if (!labelCell) throw new Error('ไม่พบแถว ค่าไฟ*** ใน ' + sheet.getName() + ' — ยังไม่สร้างบิล');

  var amountCell = labelCell.offset(0, 1);
  var formula = String(amountCell.getFormula() || '').replace(/\s+/g, '');
  var note = String(amountCell.getNote() || '');
  if (!/^=[0-9]+(?:\.[0-9]+)?\*0\.6$/.test(formula)) {
    throw new Error('สูตรค่าไฟใน ' + sheet.getName() + ' ยังไม่ใช่สูตร MEA ส่วนแบ่ง 60% — ยังไม่สร้างบิล');
  }
  if (note.indexOf('อัปเดตอัตโนมัติจาก MEA e-Invoice') === -1) {
    throw new Error('ค่าไฟใน ' + sheet.getName() + ' ยังไม่มี Note ยืนยันจาก MEA — ยังไม่สร้างบิล');
  }

  var targetYear = Number(Utilities.formatDate(targetWhen, TZ, 'yyyy'));
  var targetMonth = Number(Utilities.formatDate(targetWhen, TZ, 'M'));
  var previous = new Date(targetYear, targetMonth - 2, 1);
  var expectedPeriod = Utilities.formatDate(previous, TZ, 'MM') + '/' +
    String(Number(Utilities.formatDate(previous, TZ, 'yyyy')) + 543).slice(-2);
  if (note.indexOf('รอบบิล: ' + expectedPeriod) === -1) {
    throw new Error('ค่าไฟใน ' + sheet.getName() + ' ไม่ใช่รอบบิล ' + expectedPeriod + ' — ยังไม่สร้างบิล');
  }
  if (!(Number(amountCell.getValue()) > 0)) {
    throw new Error('ยอดค่าไฟใน ' + sheet.getName() + ' ยังว่างหรือเป็นศูนย์ — ยังไม่สร้างบิล');
  }
  return true;
}

/** อ่านเฉพาะยอดในแถว "แม่" และ "แทน"; ไม่อ้างอิง "อื่นๆ" */
function budgetSummary_(sheet, targetWhen) {
  budgetElectricityReady_(sheet, targetWhen);
  SpreadsheetApp.flush();
  var values = sheet.getDataRange().getDisplayValues();
  var headerRow = -1, labelCol = -1;
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length - 1; c++) {
      if (String(values[r][c]).trim() === 'รายการโอน' && String(values[r][c + 1]).trim() === 'ยอดที่โอน') {
        headerRow = r; labelCol = c; break;
      }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) throw new Error('ไม่พบหัวสรุป "รายการโอน / ยอดที่โอน" ในแท็บ ' + sheet.getName());

  var wanted = { 'แม่': true, 'แทน': true }, items = [];
  for (var i = headerRow + 1; i < values.length; i++) {
    var label = String(values[i][labelCol] || '').trim();
    if (!label) break;
    if (wanted[label]) {
      var amount = Math.round(budgetNumber_(values[i][labelCol + 1]) * 100) / 100;
      if (!(amount > 0)) throw new Error('ยอดของ' + label + 'ยังว่างหรือเป็นศูนย์ ใน ' + sheet.getName());
      items.push({ payee: label, amount: amount });
    }
  }
  if (items.length !== 2) throw new Error('ต้องพบยอดของแม่และแทนครบทั้ง 2 แถว ใน ' + sheet.getName() + ' — ยังไม่ส่ง LINE');
  return { sheet: sheet.getName(), items: items };
}

/** สร้าง PNG จาก PromptPay payload แล้วเก็บ Drive เพื่อให้ LINE เปิดรูปเต็มจอได้ */
function budgetQr_(promptpay, amount, key) {
  var payload = ppPayload({ target: promptpay, amount: amount });
  var endpoint = 'https://api.qrserver.com/v1/create-qr-code/?size=720x720&ecc=M&format=png&data=' + encodeURIComponent(payload);
  var response = UrlFetchApp.fetch(endpoint, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('สร้าง QR ไม่สำเร็จ: HTTP ' + response.getResponseCode());
  var folders = DriveApp.getFoldersByName('น้องกริ่ง QR');
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('น้องกริ่ง QR');
  var file = folder.createFile(response.getBlob().setName('budget-' + key + '.png'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + file.getId() + '=w720';
}

function budgetRunKey_(cfg) {
  return 'BUDGET_IMPORTED_' + cfg.period;
}

function budgetLog_(cfg, sheetName, status, items, detail) {
  var textItems = (items || []).map(function (x) {
    return x.payee + ' ฿' + baht_(x.amount);
  }).join(' / ');
  sheet_('budgetlog').appendRow([new Date(), cfg.period, sheetName || '', status, textItems, detail || '']);
}

function budgetLogBill_(bill, status, detail) {
  var period = String(bill.id || '').match(/^budget-(\d{4})(\d{2})-/);
  sheet_('budgetlog').appendRow([
    new Date(), period ? period[1] + '-' + period[2] : '', '', status,
    String(bill['คู่กรณี'] || '') + ' ฿' + baht_(bill['ยอด']), detail || ''
  ]);
}

/** บันทึก error เดิมครั้งเดียว; ถ้าเหตุผลเปลี่ยนจึงเพิ่มแถวใหม่ */
function budgetLogWaiting_(cfg, error) {
  var props = PropertiesService.getScriptProperties();
  var key = 'BUDGET_LAST_ERROR_' + cfg.period;
  var message = String(error && error.message ? error.message : error);
  if (props.getProperty(key) === message) return;
  props.setProperty(key, message);
  budgetLog_(cfg, '', 'ยังไม่สร้างบิล', [], message);
}

/**
 * อ่าน Budget-Bajjo แล้วสร้าง record ใน bills เท่านั้น ไม่ส่ง LINE ลัดหลังบ้าน
 * รอบ ringTick ถัดไปจะส่งด้วย pipeline ปกติ พร้อมอัปเดตสถานะและ pushlog เหมือนบิลจากฟอร์ม
 */
function budgetTick_() {
  var props = PropertiesService.getScriptProperties();
  var cfg;
  try { cfg = budgetConfig_(); }
  catch (configError) {
    // ยังไม่มี period ที่เชื่อถือได้ จึงบันทึกด้วยเดือนปัจจุบัน
    cfg = { period: Utilities.formatDate(new Date(), TZ, 'yyyy-MM') };
    budgetLogWaiting_(cfg, configError);
    return;
  }
  var key = budgetRunKey_(cfg);
  if (props.getProperty(key) || new Date() < cfg.when) return;

  var summary;
  try {
    summary = budgetSummary_(budgetSheetFor_(SpreadsheetApp.openById(cfg.sheetId), cfg.when), cfg.when);
  } catch (readError) {
    budgetLogWaiting_(cfg, readError);
    return;
  }
  var now = new Date();
  var rows;
  try {
    rows = summary.items.map(function (item, index) {
      var qrUrl = budgetQr_(cfg.promptpays[item.payee], item.amount,
        Utilities.formatDate(cfg.when, TZ, 'yyyyMMdd-HHmm') + '-' + item.payee);
      var id = 'budget-' + cfg.period.replace('-', '') + '-' + (index + 1);
      return [
        id, now, 'จ่าย', cfg.to, 'ค่าใช้จ่าย ' + summary.sheet + ' — โอนให้' + item.payee,
        item.payee, item.amount, 'พร้อมเพย์', item.payee, cfg.promptpays[item.payee],
        cfg.when, cfg.when, '', 1, 0, '', '',
        'สร้างอัตโนมัติจาก Budget-Bajjo แท็บ ' + summary.sheet, qrUrl
      ];
    });
  } catch (qrError) {
    budgetLogWaiting_(cfg, qrError);
    return;
  }

  // เขียนสองบิลพร้อมกัน เพื่อไม่ให้มี record แม่แต่ขาดแทนหากการเขียนสะดุดกลางทาง
  var sh = sheet_('bills');
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.bills.length).setValues(rows);
  SpreadsheetApp.flush();
  props.setProperty(key, JSON.stringify({ importedAt: now.toISOString(), sheet: summary.sheet, items: summary.items }));
  props.deleteProperty('BUDGET_LAST_ERROR_' + cfg.period);
  budgetLog_(cfg, summary.sheet, 'สร้างบิลแล้ว', summary.items, 'เพิ่ม ' + rows.length + ' records ลงแท็บ bills; รอ ringTick ส่ง LINE');
}

/** Preview แบบไม่ส่ง LINEและไม่สร้าง QR ใช้ตรวจยอดก่อนเปิดงานจริง */
function previewBudgetPayment() {
  var cfg = budgetConfig_();
  var result = budgetSummary_(budgetSheetFor_(SpreadsheetApp.openById(cfg.sheetId), cfg.when), cfg.when);
  Logger.log(JSON.stringify(result));
  return result;
}

// ---------- สลากกินแบ่งรัฐบาล ----------
/**
 * ใช้ API เปิดของ GLO 3 ตัว (เอกสาร: gdcatalog.glo.or.th dataset_c4-9_01)
 *   getLotteryResultByPage  {page:1,limit:1}   -> งวดล่าสุดที่ประกาศแล้ว + เลขสำหรับการ์ด
 *   checking/getLotteryResult  {date,month,year} -> ผลเต็มทุกรางวัล + เงินรางวัล + pdf_url
 *   checking/getcheckLotteryResult {number,period_date} -> ให้ GLO ตรวจเลขให้ (ครั้งละ 10 ใบ)
 * การตรวจไม่คำนวณเอง ปล่อยให้ GLO ตัดสิน จึงครบถึงรางวัลที่ 5 และข้างเคียง
 * ปลายทาง default = กลุ่มชื่อ sirirat.fc ในแท็บ targets; ทับด้วย Script Property LOTTO_LINE_TARGET
 */
var LOTTO_PAGE_API = 'https://www.glo.or.th/api/lottery/getLotteryResultByPage';
var LOTTO_FULL_API = 'https://www.glo.or.th/api/checking/getLotteryResult';
var LOTTO_CHECK_API = 'https://www.glo.or.th/api/checking/getcheckLotteryResult';
var LOTTO_URL = 'https://www.glo.or.th/checking-lotto';
var LOTTO_GROUP = 'sirirat.fc';
var LOTTO_MAX = 30;      // GLO รับครั้งละ 10 ใบ เราซอยส่ง 3 รอบ
/** ชื่อรางวัลที่ GLO ตอบกลับ -> key ใน data ของผลเต็ม ใช้ดึงเงินรางวัลจริง ไม่ฮาร์ดโค้ดตัวเลข */
var LOTTO_TIER = {
  'รางวัลที่ 1': 'first', 'รางวัลข้างเคียงรางวัลที่ 1': 'near1',
  'รางวัลที่ 2': 'second', 'รางวัลที่ 3': 'third', 'รางวัลที่ 4': 'fourth', 'รางวัลที่ 5': 'fifth',
  'รางวัลเลขหน้า 3 ตัว': 'last3f', 'รางวัลเลขท้าย 3 ตัว': 'last3b', 'รางวัลเลขท้าย 2 ตัว': 'last2'
};

function lottoPost_(url, body) {
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(body || {}), muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error('GLO ' + res.getResponseCode() + ': ' + res.getContentText());
  return (JSON.parse(res.getContentText()) || {}).response;
}

function lottoLatest_() {
  // ต้องส่ง page เสมอ — ยิง body ว่างจะได้ response: null เงียบ ๆ ไม่ใช่ error
  var list = (lottoPost_(LOTTO_PAGE_API, { page: 1, limit: 1 }) || {}).lottery;
  if (!list || !list.length) throw new Error('GLO ไม่ส่งผลรางวัลมา');
  var d = list[0];
  return {
    date: d.date, first: d.data.first[0],
    last3f: d.data.last3f, last3b: d.data.last3b, last2: d.data.last2[0]
  };
}

/** ผลเต็มของงวดหนึ่ง — เอาไว้ดึงเงินรางวัลจริงกับลิงก์ PDF ทางการ */
function lottoFull_(iso) {
  var p = String(iso).split('-');
  var r = lottoPost_(LOTTO_FULL_API, { date: p[2], month: p[1], year: p[0] });
  if (!r || !r.result) throw new Error('GLO ยังไม่มีผลเต็มของงวด ' + iso);
  return r.result;
}

/** ให้ GLO ตรวจให้ทีละไม่เกิน 10 ใบ — คืน [{number, status_data:[{reward}]}] เรียงตามที่ส่งไป */
function lottoAsk_(nums, iso) {
  var out = [];
  for (var i = 0; i < nums.length; i += 10) {
    var body = {
      number: nums.slice(i, i + 10).map(function (n) { return { lottery_num: n }; }),
      period_date: iso
    };
    var r = lottoPost_(LOTTO_CHECK_API, body);
    if (!r || !r.result) throw new Error('GLO ไม่ตอบผลตรวจ');
    out = out.concat(r.result);
  }
  return out;
}

/** '2026-08-16' -> '16 ส.ค. 2569' — งวดใช้ พ.ศ. เต็ม ไม่ใช่ 2 หลักแบบการ์ดบิล */
function lottoThaiDate_(iso) {
  var m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + m[Number(p[1]) - 1] + ' ' + (Number(p[0]) + 543);
}

/** ข้อความเป็นเลข 6 หลักล้วน (คั่นด้วย , หรือเว้นวรรค) เท่านั้นจึงนับ — กันไปตอบทุกบรรทัดในกลุ่ม */
function lottoNumbers_(text) {
  var t = String(text).trim();
  if (!/^\d{6}([\s,]+\d{6})*$/.test(t)) return [];
  return t.split(/[\s,]+/).slice(0, LOTTO_MAX);
}

function lottoTarget_() {
  var override = PropertiesService.getScriptProperties().getProperty('LOTTO_LINE_TARGET');
  if (override) return override;
  var name = LOTTO_GROUP.toLowerCase();
  var hit = rows_('targets').filter(function (t) {
    return t['ชนิด'] === 'group' && String(t['ชื่อ']).toLowerCase().indexOf(name) > -1;
  })[0];
  return hit ? hit.id : '';
}

// ---------- การ์ดสลาก ----------
function lottoNumBox_(text, big) {
  return { type: 'box', layout: 'vertical', backgroundColor: '#FFFFFF', cornerRadius: '8px',
    paddingAll: big ? '16px' : '10px', margin: 'sm', contents: [
      { type: 'text', text: text, align: 'center', weight: 'bold',
        size: big ? '3xl' : 'lg', color: big ? '#F5A623' : '#1F2328' }]};
}
function lottoCol_(label, nums, big) {
  return { type: 'box', layout: 'vertical', flex: 1, contents: [
    { type: 'text', text: label, size: 'xs', weight: 'bold', color: '#FFFFFF', align: 'center', wrap: true }
  ].concat(nums.map(function (n) { return lottoNumBox_(n, big); }))};
}

function lottoCard_(r) {
  return { type: 'bubble', body: {
    type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#0B4FA0', contents: [
      { type: 'text', text: 'ผลสลากกินแบ่งรัฐบาล', size: 'xl', weight: 'bold', color: '#FFD400', align: 'center', wrap: true },
      { type: 'text', text: 'งวด ' + lottoThaiDate_(r.date), size: 'lg', weight: 'bold', color: '#FFFFFF', align: 'center', margin: 'sm' },
      { type: 'text', text: 'รางวัลที่ 1', size: 'md', weight: 'bold', color: '#FFD400', align: 'center', margin: 'md' },
      { type: 'box', layout: 'vertical', backgroundColor: '#111111', cornerRadius: '16px', paddingAll: '18px', margin: 'md',
        contents: [{ type: 'text', text: r.first.split('').join(' '), size: '3xl', weight: 'bold', color: '#FFFFFF', align: 'center' }] },
      { type: 'box', layout: 'horizontal', margin: 'xl', spacing: 'md', contents: [
        lottoCol_('เลขหน้า 3 ตัว', r.last3f, false),
        lottoCol_('เลขท้าย 3 ตัว', r.last3b, false),
        lottoCol_('เลขท้าย 2 ตัว', [r.last2], true)
      ]},
      { type: 'button', style: 'primary', color: '#F5A623', height: 'sm', margin: 'xl',
        action: { type: 'uri', label: 'ไปเช็คเลขเพิ่มเติม', uri: LOTTO_URL } },
      { type: 'text', text: 'พิมพ์เลข 6 หลักในแชทเพื่อตรวจ (คั่นด้วย , ได้หลายใบ)',
        size: 'xxs', color: '#BFD6F0', align: 'center', margin: 'lg', wrap: true },
      { type: 'text', text: 'แจ้งเตือนเพื่อความสะดวก กรุณาตรวจสอบซ้ำกับแหล่งทางการ',
        size: 'xxs', color: '#BFD6F0', align: 'center', margin: 'xs', wrap: true }
    ]}};
}

function lottoCheckCard_(hits, full) {
  var won = 0;
  var money = function (reward) {
    var tier = (full.data || {})[LOTTO_TIER[reward]];
    return tier ? Number(tier.price) : 0;
  };
  var lines = hits.map(function (h) {
    var rewards = h.status_data || [];
    var sum = rewards.reduce(function (a, x) { return a + money(x.reward); }, 0);
    won += sum;
    return { type: 'box', layout: 'vertical', margin: 'lg', contents: [
      { type: 'box', layout: 'horizontal', contents: [
        { type: 'text', text: String(h.number).split('').join(' '), size: 'lg', weight: 'bold',
          color: rewards.length ? '#2F8F5B' : '#1F2328', flex: 0 },
        { type: 'text', text: rewards.length ? 'ถูกรางวัล' : 'ไม่ถูกรางวัล', size: 'sm', align: 'end',
          color: rewards.length ? '#2F8F5B' : '#B0B6BD', gravity: 'center' }]},
      { type: 'text', wrap: true, size: 'xs', margin: 'xs', color: '#5A6169',
        text: rewards.length
          ? rewards.map(function (x) {
              var m = money(x.reward);
              return x.reward + (m ? ' · ' + m.toLocaleString('en-US') + ' บาท' : '');
            }).join('\n')
          : 'ไม่ตรงรางวัลใดของงวดนี้' }]};
  });
  return { type: 'bubble', body: {
    type: 'box', layout: 'vertical', paddingAll: '20px', contents: [
      { type: 'text', text: 'ผลตรวจสลาก', size: 'sm', color: '#8A9099' },
      { type: 'text', text: 'งวด ' + lottoThaiDate_(full.date), size: 'xl', weight: 'bold', color: '#1F2328', margin: 'xs' },
      { type: 'text', text: 'ตรวจโดยระบบของสำนักงานสลากฯ ครบทุกรางวัล', size: 'xxs', color: '#B0B6BD', margin: 'xs', wrap: true },
      { type: 'separator', margin: 'lg' }
    ].concat(lines).concat([
      { type: 'separator', margin: 'xl' },
      { type: 'text', text: won ? 'รวมเงินรางวัล ' + won.toLocaleString('en-US') + ' บาท' : 'ไม่ถูกรางวัลสักใบ',
        size: 'md', weight: 'bold', color: won ? '#2F8F5B' : '#5A6169', margin: 'lg' },
      { type: 'button', style: won ? 'primary' : 'secondary', color: won ? '#2F8F5B' : undefined,
        height: 'sm', margin: 'lg',
        action: { type: 'uri', label: 'ใบตรวจทางการ (PDF)', uri: full.pdf_url || LOTTO_URL } }
    ])}};
}

/** ตอบในแชท: ไม่มีเลข = การ์ดผลงวดล่าสุด, มีเลข = ให้ GLO ตรวจแล้วสรุปเป็นการ์ด */
function lottoReply_(nums) {
  var r;
  try { r = lottoLatest_(); }
  catch (e) { return { type: 'text', text: 'ตอนนี้ดึงผลรางวัลจาก GLO ไม่ได้ ลองใหม่อีกทีนะ' }; }
  if (!nums.length) return flex_('ผลสลากงวด ' + lottoThaiDate_(r.date), lottoCard_(r));
  try {
    var full = lottoFull_(r.date);
    return flex_('ผลตรวจสลาก งวด ' + lottoThaiDate_(r.date), lottoCheckCard_(lottoAsk_(nums, r.date), full));
  } catch (e) {
    return { type: 'text', text: 'ตรวจให้ไม่ได้ตอนนี้ (' + String(e).slice(0, 80) + ') ลองใหม่อีกทีนะ' };
  }
}

/**
 * ยิงจริงไป GLO แล้วเช็คว่ายังตรวจครบทุกชั้นอยู่ — รันมือเวลาสงสัยว่า API เปลี่ยน
 * ใช้งวด 16 ส.ค. 2569 ของจริงเป็น fixture (รางวัลที่ 1–4, ข้างเคียง, เลขหน้า/ท้าย, ไม่ถูก)
 */
function lottoSelfTestLive() {
  var want = {
    '004615': 'รางวัลที่ 1', '004616': 'รางวัลข้างเคียงรางวัลที่ 1',
    '576660': 'รางวัลที่ 2', '573767': 'รางวัลที่ 3', '009670': 'รางวัลที่ 4',
    '429111': 'รางวัลเลขหน้า 3 ตัว', '111094': 'รางวัลเลขท้าย 3 ตัว',
    '111153': 'รางวัลเลขท้าย 2 ตัว', '111111': ''
  };
  var nums = Object.keys(want);
  var full = lottoFull_('2026-08-16');
  lottoAsk_(nums, '2026-08-16').forEach(function (h) {
    var got = (h.status_data || []).map(function (x) { return x.reward; }).join('+');
    if (got !== want[h.number]) throw new Error(h.number + ' ควรได้ "' + want[h.number] + '" แต่ได้ "' + got + '"');
    (h.status_data || []).forEach(function (x) {
      if (!full.data[LOTTO_TIER[x.reward]]) throw new Error('ไม่รู้จักชื่อรางวัล "' + x.reward + '" — ต้องเพิ่มใน LOTTO_TIER');
    });
  });
  if (Number(full.data.first.price) !== 6000000) throw new Error('เงินรางวัลที่ 1 เพี้ยน: ' + full.data.first.price);
  Logger.log('GLO ตรวจครบทุกชั้น ผ่าน');
  return 'ok';
}

/** ทดสอบมือ: ดูว่าเจอกลุ่มไหม แล้วยิงการ์ดงวดล่าสุดเข้าไปเลย (ไม่แตะ LOTTO_LAST_SENT) */
function lottoNow() {
  var to = lottoTarget_();
  if (!to) throw new Error('หากลุ่ม "' + LOTTO_GROUP + '" ในแท็บ targets ไม่เจอ — ให้พิมพ์ในกลุ่มสักครั้งให้บอทเห็นก่อน หรือตั้ง Script Property LOTTO_LINE_TARGET');
  var r = lottoLatest_();
  ringPush(to, flex_('ผลสลากงวด ' + lottoThaiDate_(r.date), lottoCard_(r)), 'สลาก');
  var msg = 'ส่งงวด ' + lottoThaiDate_(r.date) + ' ไปที่ ' + (targetName_(to) || to) + ' แล้ว';
  Logger.log(msg);
  return msg;
}

/** ยิงผลงวดใหม่เข้ากลุ่มครั้งเดียวต่องวด — เกาะ ringTick ตัวเดิม ไม่เพิ่ม trigger */
function lottoTick_() {
  var props = PropertiesService.getScriptProperties();
  // ponytail: เปิดหน้าต่างบ่าย-ค่ำแล้ว poll เอา ไม่ต้องรู้ปฏิทินงวด (1/16 เลื่อนตามวันหยุดได้)
  var h = Number(Utilities.formatDate(new Date(), TZ, 'HH'));
  if (h < 15 || h > 20) return;

  var r;
  try { r = lottoLatest_(); } catch (e) { return; }        // GLO ล่มรอบเดียวไม่ต้องทำอะไร รอบหน้าลองใหม่
  if (props.getProperty('LOTTO_LAST_SENT') === r.date) return;

  props.setProperty('LOTTO_LAST_SENT', r.date);            // จองก่อน push — push พังยังไงก็ไม่ยิงซ้ำ
  // งวดเก่ากว่า 3 วัน = รันครั้งแรกหรือเพิ่งกู้ระบบ อย่าเด้งผลเก่าเข้ากลุ่ม
  if ((new Date() - new Date(r.date + 'T17:00:00+07:00')) / 86400000 > 3) return;

  var to = lottoTarget_();
  if (!to) return;
  ringPush(to, flex_('ผลสลากงวด ' + lottoThaiDate_(r.date), lottoCard_(r)), 'สลาก');
}

// ---------- สิทธิ์ใช้เมนู ----------
/**
 * ผูก rich menu ให้เฉพาะคนที่ติ๊ก "ให้ใช้เมนู" ในชีต targets
 * รันใหม่ทุกครั้งที่เพิ่ม/ถอนคน — ไม่มี default menu แปลว่าคนที่ไม่ได้ติ๊กจะไม่เห็นเมนูเลย
 */
function ringSyncMenu() {
  var menus = line_('/richmenu/list').richmenus || [];
  var menu = menus.filter(function (m) { return m.name.indexOf(MENU_PREFIX) === 0; })[0];
  if (!menu) throw new Error('ยังไม่มี rich menu ชื่อขึ้นต้นด้วย ' + MENU_PREFIX + ' — รัน richmenu/setup.sh ก่อน');

  lineTry_('/user/all/richmenu', null, 'delete');   // ห้ามเป็น default เด็ดขาด

  var on = [], off = [];
  rows_('targets').forEach(function (t) {
    if (t['ชนิด'] !== 'user') return;
    if (yes_(t['ให้ใช้เมนู'])) {
      line_('/user/' + t.id + '/richmenu/' + menu.richMenuId, '', 'post');
      on.push(t['ชื่อ'] || t.id);
    } else {
      lineTry_('/user/' + t.id + '/richmenu', null, 'delete');
      off.push(t['ชื่อ'] || t.id);
    }
  });
  var msg = 'เมนู "' + menu.name + '"\nให้ใช้ได้: ' + (on.join(', ') || '(ยังไม่มีใคร)') +
            '\nปิดไว้: ' + (off.join(', ') || '-');
  Logger.log(msg);
  return msg;
}

// ---------- misc ----------
function helpCard_() {
  return { type: 'text', text: [
    'แผงคุมน้องกริ่ง',
    '• สร้างบิล — กรอกฟอร์ม ตั้งวัน-เวลา และทำซ้ำได้',
    '• บิลที่รออยู่ — ดูบิลที่ยังไม่ถึงเวลา + ปิดบิล',
    '• เครดิต — โควตาข้อความเดือนนี้',
    '• สถิติ — ส่งไปที่ไหนกี่ครั้ง',
    '• ปลายทาง — กลุ่ม/คนที่บอทรู้จัก',
    '• พิมพ์ "หวย" ดูผลงวดล่าสุด · พิมพ์เลข 6 หลัก (คั่นด้วย , ได้หลายใบ) เพื่อตรวจ'
  ].join('\n') };
}

/** รันครั้งเดียวหลัง deploy: สร้างชีต + ตั้ง trigger */
function ringSetup() {
  ['bills', 'pushlog', 'budgetlog', 'targets'].forEach(sheet_);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'ringTick' || f === 'ringDailyReminder') ScriptApp.deleteTrigger(t);
  });
  // ponytail: เช็คทุก 5 นาที แม่นพอสำหรับบิล ถ้าอยากเป๊ะนาทีต้องตั้ง trigger ต่อบิล (เพดาน 20 อัน)
  ScriptApp.newTrigger('ringTick').timeBased().everyMinutes(5).create();
  Logger.log('ชีต: ' + ss_().getUrl());
  return ss_().getUrl();
}

/** ตรวจ logic ที่พังเงียบได้: เงิน / วันที่ / รอบทำซ้ำที่ห้าม drift */
function ringSelfTest() {
  if (baht_(6566) !== '6,566.00') throw new Error('baht_ ผิด: ' + baht_(6566));
  if (baht_('') !== '0.00') throw new Error('baht_ ค่าว่างผิด');
  if (thaiDate_(new Date(2026, 8, 5)) !== '5 ก.ย. 69') throw new Error('thaiDate ผิด');

  var jan31 = new Date(2027, 0, 31, 9, 30);
  var feb = fireAt_(jan31, 'เดือน', 1);
  if (feb.getMonth() !== 1 || feb.getDate() !== 28) throw new Error('31 ม.ค. +1 ควรเป็น 28 ก.พ. ได้ ' + feb);
  // ห้าม drift: ก.พ. โดนบีบเหลือ 28 แล้ว มี.ค. ต้องกลับไป 31
  var mar = fireAt_(jan31, 'เดือน', 2);
  if (mar.getDate() !== 31) throw new Error('รอบเดือนที่ 3 ควรกลับเป็น 31 ได้ ' + mar.getDate());
  if (mar.getHours() !== 9 || mar.getMinutes() !== 30) throw new Error('fireAt_ ทำเวลาหาย');

  var aug31 = new Date(2026, 7, 31, 9, 0);
  var got = [0, 1, 2, 3].map(function (i) {
    var d = fireAt_(aug31, 'เดือน', i); return (d.getMonth() + 1) + '/' + d.getDate();
  }).join(' ');
  if (got !== '8/31 9/30 10/31 11/30') throw new Error('ไล่งวดสิ้นเดือนผิด: ' + got);

  var w = fireAt_(new Date(2026, 7, 25, 8, 0), 'สัปดาห์', 2);
  if (w.getDate() !== 8 || w.getMonth() !== 8) throw new Error('รอบสัปดาห์ผิด: ' + w);
  if (fireAt_(aug31, '', 1) !== null) throw new Error('ไม่ทำซ้ำต้องคืน null');

  if (!yes_('ใช่') || !yes_(true) || yes_('') || yes_('ไม่')) throw new Error('yes_ ผิด');

  // CRC-16/CCITT-FALSE มีค่า check มาตรฐาน: "123456789" -> 0x29B1
  if (crc16_('123456789') !== '29B1') throw new Error('crc16 ผิด: ' + crc16_('123456789'));
  if (ppTarget_('089-999-9999').value !== '0066899999999') throw new Error('แปลงเบอร์ผิด: ' + ppTarget_('089-999-9999').value);
  if (ppTarget_('1234567890123').tag !== '02') throw new Error('เลขบัตร ปชช. ควรเป็น tag 02');
  var pay = ppPayload({ target: '0899999999', amount: 4.22 });
  ['000201', '010212', '0016A000000677010111', '01130066899999999',
   '5802TH', '5303764', '54044.22'].forEach(function (part) {
    if (pay.indexOf(part) === -1) throw new Error('payload ขาด ' + part + ' → ' + pay);
  });
  if (!/6304[0-9A-F]{4}$/.test(pay)) throw new Error('ท้าย payload ต้องเป็น 6304+CRC: ' + pay);
  if (crc16_(pay.slice(0, -4)) !== pay.slice(-4)) throw new Error('CRC ใน payload ไม่ตรง');
  if (ppPayload({ target: '0899999999' }).indexOf('010211') === -1) throw new Error('ไม่ใส่ยอด ต้องเป็น static 11');
  // ยอด 3 หลักขึ้นไปต้องนับความยาวใหม่ ไม่ใช่ fix ที่ 04
  if (ppPayload({ target: '0899999999', amount: 6566 }).indexOf('54076566.00') === -1)
    throw new Error('ความยาวยอดผิด: ' + ppPayload({ target: '0899999999', amount: 6566 }));
  // ชื่อรางวัลที่ GLO ตอบ ต้อง map ไปหา key ที่มีจริงในผลเต็ม ไม่งั้นเงินรางวัลจะกลายเป็น 0 เงียบ ๆ
  var dataKeys = ['first', 'second', 'third', 'fourth', 'fifth', 'last2', 'last3f', 'last3b', 'near1'];
  Object.keys(LOTTO_TIER).forEach(function (name) {
    if (dataKeys.indexOf(LOTTO_TIER[name]) === -1) throw new Error('LOTTO_TIER ชี้ key ที่ไม่มีจริง: ' + name);
  });
  if (Object.keys(LOTTO_TIER).length !== dataKeys.length) throw new Error('LOTTO_TIER ต้องครบ 9 รางวัล');

  if (lottoNumbers_('458145, 123456').join('|') !== '458145|123456') throw new Error('แยกเลขคั่น , ผิด');
  if (lottoNumbers_('458145 123456').length !== 2) throw new Error('แยกเลขคั่นเว้นวรรคผิด');
  if (lottoNumbers_('โอน 123456 บาท').length !== 0) throw new Error('ข้อความปนต้องไม่นับเป็นเลขหวย');
  if (lottoNumbers_('12345').length !== 0) throw new Error('เลขไม่ครบ 6 หลักต้องไม่นับ');
  if (lottoThaiDate_('2026-08-16') !== '16 ส.ค. 2569') throw new Error('งวดไทยผิด: ' + lottoThaiDate_('2026-08-16'));

  Logger.log('ผ่านหมด');
  return 'ok';
}
