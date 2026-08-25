/**
 * ============================================================
 *  📅 DayData.gs — ข้อมูลประจำวัน + Theme Pool + Art Style Pool
 * ============================================================
 *  v5: เพิ่มสไตล์ทัศนศิลป์ (ไม่จำกัดแค่ภาพถ่าย)
 */

// ─── 🖼️ Art Style Pool ──────────────────────────────────
const ART_STYLE_POOL = [
  {
    id: 'watercolor',
    name: 'สีน้ำ',
    prompt: 'Beautiful watercolor painting style, soft wet-on-wet washes, visible paper texture, delicate color bleeding, fine art quality',
  },
  {
    id: 'oil_impressionist',
    name: 'สีน้ำมันอิมเพรสชันนิสต์',
    prompt: 'Impressionist oil painting style, visible expressive brushstrokes, vibrant color palette, Monet-inspired light and atmosphere',
  },
  {
    id: 'thai_traditional',
    name: 'จิตรกรรมไทยประเพณี',
    prompt: 'Traditional Thai mural painting style (Jitrakam Thai), elegant line art with gold leaf accents, flat perspective, ornate decorative borders',
  },
  {
    id: 'soft_pastel',
    name: 'พาสเทลนุ่มนวล',
    prompt: 'Soft pastel illustration style, gentle muted colors, dreamy and airy feel, kawaii-inspired cute aesthetic, rounded smooth shapes',
  },
  {
    id: 'digital_art',
    name: 'ดิจิทัลอาร์ต',
    prompt: 'Polished digital art illustration, vibrant saturated colors, clean crisp details, dramatic cinematic lighting, concept art quality',
  },
  {
    id: 'paper_cutout',
    name: 'ศิลปะกระดาษตัด',
    prompt: 'Layered paper cut-out art style (Kirigami), multi-layered depth, soft shadows between paper layers, elegant silhouettes',
  },
  {
    id: 'stained_glass',
    name: 'กระจกสี',
    prompt: 'Stained glass window art style, bold black outlines, translucent glowing colors, light shining through colored segments, cathedral-inspired',
  },
  {
    id: 'ink_wash',
    name: 'หมึกจีน',
    prompt: 'East Asian ink wash painting style (Sumi-e), minimalist monochrome with subtle color accents, elegant flowing brushwork, zen aesthetic',
  },
];

// ─── 🌤️ Dynamic Modifiers ──────────────────────────────
const PROMPT_MODIFIERS = {
  lighting: [
    'soft golden hour sunlight',
    'gentle morning light with soft mist',
    'dramatic sun rays breaking through clouds',
    'bright crisp morning daylight',
    'warm ethereal glowing backlight',
  ],
  angle: [
    'wide-angle composition',
    'close-up detailed view',
    'eye-level balanced perspective',
    'low angle looking slightly upward',
    'beautiful panoramic composition',
  ],
  vibe: [
    'peaceful and serene atmosphere',
    'fresh positive and energetic vibe',
    'calm tranquil and relaxing mood',
    'magical cinematic and dreamy feeling',
  ],
};

// ─── 🎨 Theme Pool (12 themes, ลบคำว่า "photography" ออกหมด) ───
const THEME_POOL = [
  {
    id: 'buddha',
    name: 'พระพุทธรูป',
    subject: 'A serene golden Buddha statue sitting in meditation pose, {angle}, illuminated by {lighting}. {vibe}.',
    decoration: 'Lotus flowers at the bottom in {color} tone',
    preferredStyle: { layout: 'top_bottom', shape: 'arch', effect: 'heavy_stroke' },
  },
  {
    id: 'lotus',
    name: 'ดอกบัวบาน',
    subject: 'Beautiful blooming lotus flowers floating on still water. {angle}. {lighting}. Focus on vibrant petals and dewdrops. {vibe}.',
    decoration: 'Multiple lotus petals in {color} shades, gentle ripples',
    preferredStyle: { layout: 'bottom_only', shape: 'straight', effect: 'soft_shadow' },
  },
  {
    id: 'thai_flowers',
    name: 'ดอกไม้ไทยมงคล',
    subject: 'Auspicious Thai flowers — jasmine, marigold, and orchids arranged elegantly in a ceramic vase. {angle}. {lighting}. {vibe}.',
    decoration: 'Flowers predominantly in {color} tones',
    preferredStyle: { layout: 'center_bottom', shape: 'straight', effect: 'drop_shadow' },
  },
  {
    id: 'thai_architecture',
    name: 'สถาปัตยกรรมไทย',
    subject: 'A traditional Thai pavilion (Sala Thai) surrounded by lush green gardens. {angle}. {lighting}. {vibe}.',
    decoration: 'Sky tinted with {color} sunrise hues',
    preferredStyle: { layout: 'top_left', shape: 'straight', effect: 'glow' },
  },
  {
    id: 'morning_nature',
    name: 'ธรรมชาติยามเช้า',
    subject: 'A lush green forest with tall trees and sunbeams. {angle}. {lighting}. {vibe}.',
    decoration: 'Light tinted with {color} warm tones, dewdrops on leaves',
    preferredStyle: { layout: 'top_bottom', shape: 'straight', effect: 'soft_shadow' },
  },
  {
    id: 'sky_birds',
    name: 'นกและท้องฟ้า',
    subject: 'A flock of beautiful birds flying gracefully across the open sky. {angle}. {lighting}. {vibe}.',
    decoration: 'Sky predominantly in {color} tones, soft fluffy clouds',
    preferredStyle: { layout: 'center_bottom', shape: 'straight', effect: 'heavy_stroke' },
  },
  {
    id: 'golden_leaves',
    name: 'ใบไม้ทอง',
    subject: 'Beautiful autumn leaves and tree branches in warm dramatic light. {angle}. {lighting}. {vibe}.',
    decoration: 'Leaves in {color} and gold tones',
    preferredStyle: { layout: 'top_left', shape: 'straight', effect: 'glow' },
  },
  {
    id: 'mountain_landscape',
    name: 'ทิวทัศน์ภูเขา',
    subject: 'Breathtaking rolling hills and distant mountains with mist in the valleys. {angle}. {lighting}. {vibe}.',
    decoration: 'Sky and mist tinted with {color} dawn hues',
    preferredStyle: { layout: 'top_bottom', shape: 'straight', effect: 'drop_shadow' },
  },
  {
    id: 'waterfall',
    name: 'น้ำตกในป่าลึก',
    subject: 'A beautiful waterfall cascading down mossy rocks in a deep forest. {angle}. {lighting}. {vibe}.',
    decoration: 'Water mist reflecting {color} morning light',
    preferredStyle: { layout: 'bottom_only', shape: 'straight', effect: 'soft_shadow' },
  },
  {
    id: 'morning_coffee',
    name: 'กาแฟยามเช้า',
    subject: 'A cozy cup of morning coffee on a rustic wooden table with nature view behind. {angle}. {lighting}. {vibe}.',
    decoration: 'Coffee mug matching {color} tones, steam rising gently',
    preferredStyle: { layout: 'top_left', shape: 'straight', effect: 'glow' },
  },
  {
    id: 'flower_field',
    name: 'ทุ่งดอกไม้กว้าง',
    subject: 'A vast field of blooming colorful flowers stretching to the horizon. {angle}. {lighting}. {vibe}.',
    decoration: 'Flowers featuring {color} hues',
    preferredStyle: { layout: 'center_bottom', shape: 'straight', effect: 'heavy_stroke' },
  },
  {
    id: 'beach_sunrise',
    name: 'ทะเลยามเช้า',
    subject: 'A calm beach with gentle waves washing ashore under a beautiful sky. {angle}. {lighting}. {vibe}.',
    decoration: 'Water and sky reflecting {color} dawn colors',
    preferredStyle: { layout: 'top_bottom', shape: 'straight', effect: 'drop_shadow' },
  },
];

// ─── 📅 DAY_DATA (คงเดิม) ────────────────────────────────
const DAY_DATA = {
  0: { nameTh: 'อาทิตย์', greeting: 'สวัสดีวันอาทิตย์',
    blessing: ['ขอให้ชีวิตสดใส มีพลังเหมือนแสงอาทิตย์','ทำสิ่งใดก็สำเร็จ ร่ำรวย มั่งคั่ง','สุขภาพแข็งแรง คิดดี ทำดี'],
    primaryColor: '#D32F2F', accentColor: '#FFD54F' },
  1: { nameTh: 'จันทร์', greeting: 'สวัสดีวันจันทร์',
    blessing: ['ขอให้สัปดาห์นี้เริ่มต้นด้วยสิ่งดีๆ','ทำงานราบรื่น สุขภาพแข็งแรง','มีแต่ความสุข ความเจริญ'],
    primaryColor: '#F9A825', accentColor: '#FFEB3B' },
  2: { nameTh: 'อังคาร', greeting: 'สวัสดีวันอังคาร',
    blessing: ['ขอให้มีพลังกาย พลังใจ','ทำการสิ่งใดก็ประสบความสำเร็จ','แคล้วคลาดปลอดภัย โชคดีตลอดวัน'],
    primaryColor: '#E91E63', accentColor: '#F8BBD0' },
  3: { nameTh: 'พุธ', greeting: 'สวัสดีวันพุธ',
    blessing: ['ขอให้ชีวิตเขียวขจี เจริญรุ่งเรือง','มีปัญญาเฉียบแหลม ใจเย็น','การงานก้าวหน้า เงินทองไหลมา'],
    primaryColor: '#388E3C', accentColor: '#A5D6A7' },
  4: { nameTh: 'พฤหัสบดี', greeting: 'สวัสดีวันพฤหัสบดี',
    blessing: ['ขอให้ชีวิตดี มีแต่ความสุข ความเจริญ','รุ่งโรจน์ รุ่งเรือง ร่ำรวย','ไร้โรค ปลอดภัย สุขภาพแข็งแรง'],
    primaryColor: '#F57C00', accentColor: '#FFB74D' },
  5: { nameTh: 'ศุกร์', greeting: 'สวัสดีวันศุกร์',
    blessing: ['ขอให้สดใสเหมือนท้องฟ้า','จบสัปดาห์ด้วยรอยยิ้ม','พบแต่สิ่งดีๆ มีความสุขกับครอบครัว'],
    primaryColor: '#1976D2', accentColor: '#90CAF9' },
  6: { nameTh: 'เสาร์', greeting: 'สวัสดีวันเสาร์',
    blessing: ['ขอให้ได้พักผ่อนอย่างเต็มที่','มีความสุขกับครอบครัว','ชีวิตเบิกบาน ใจสงบ'],
    primaryColor: '#7B1FA2', accentColor: '#CE93D8' },
};


// ─── 🎲 pickRandomTheme — สุ่ม Theme + Art Style + Modifiers ───
function pickRandomTheme() {
  const props = PropertiesService.getScriptProperties();
  const getRand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // --- สุ่ม Theme (กีดกัน 6 วันล่าสุด) ---
  let themeHistory = [];
  try { themeHistory = JSON.parse(props.getProperty('THEME_HISTORY') || '[]'); } catch(e) {}
  const recentThemes = themeHistory.slice(0, 6);
  let themePool = THEME_POOL.filter(t => !recentThemes.includes(t.id));
  if (themePool.length === 0) themePool = THEME_POOL;
  const chosenTheme = JSON.parse(JSON.stringify(getRand(themePool)));

  // --- สุ่ม Art Style (กีดกัน 3 ครั้งล่าสุด) ---
  let styleHistory = [];
  try { styleHistory = JSON.parse(props.getProperty('STYLE_HISTORY') || '[]'); } catch(e) {}
  const recentStyles = styleHistory.slice(0, 3);
  let stylePool = ART_STYLE_POOL.filter(s => !recentStyles.includes(s.id));
  if (stylePool.length === 0) stylePool = ART_STYLE_POOL;
  const chosenStyle = getRand(stylePool);

  // --- แทนที่ Dynamic Modifiers ใน subject ---
  chosenTheme.subject = chosenTheme.subject
    .replace('{lighting}', getRand(PROMPT_MODIFIERS.lighting))
    .replace('{angle}',    getRand(PROMPT_MODIFIERS.angle))
    .replace('{vibe}',     getRand(PROMPT_MODIFIERS.vibe));

  // --- ต่อท้าย Art Style เข้าไปใน subject ---
  chosenTheme.subject += ' ' + chosenStyle.prompt;
  chosenTheme.artStyleId   = chosenStyle.id;
  chosenTheme.artStyleName = chosenStyle.name;

  Logger.log(`🎯 Theme: ${chosenTheme.name} | 🖼️ Style: ${chosenStyle.name}`);
  Logger.log(`📝 Final prompt: ${chosenTheme.subject}`);

  // --- บันทึกประวัติ ---
  themeHistory.unshift(chosenTheme.id);
  styleHistory.unshift(chosenStyle.id);
  props.setProperty('THEME_HISTORY', JSON.stringify(themeHistory.slice(0, 7)));
  props.setProperty('STYLE_HISTORY', JSON.stringify(styleHistory.slice(0, 7)));

  return chosenTheme;
}