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
    else if (ev.type === 'message' && ev.message.type === 'text' && ev.source.type === 'user') {
      var t = ev.message.text.trim();
      if (t === 'เมนู' || t === 'menu' || t === 'ช่วยเหลือ') reply_(ev.replyToken, helpCard_());
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
  if (acc) buttons.push({ type: 'button', style: 'primary', height: 'sm', color: accent,
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
          aspectMode: 'fit', backgroundColor: '#FFFFFF', margin: 'sm' }
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
    ringPush(b['ปลายทาง'], { type: 'flex', altText: alt, contents: card }, 'บิล');
  });
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
    '• ปลายทาง — กลุ่ม/คนที่บอทรู้จัก'
  ].join('\n') };
}

/** รันครั้งเดียวหลัง deploy: สร้างชีต + ตั้ง trigger */
function ringSetup() {
  ['bills', 'pushlog', 'targets'].forEach(sheet_);
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
  Logger.log('ผ่านหมด');
  return 'ok';
}
