#!/usr/bin/env node
/**
 * Migrate all data from index.html to Supabase
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://nveyjftyclwvvgudynqt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52ZXlqZnR5Y2x3dnZndWR5bnF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Nzg0MzksImV4cCI6MjA5MDE1NDQzOX0.wowQs2LlQZC-w6hkFCTqo23bKqOez4YiAdMdm-GoI-k';

async function supaInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const err = await res.text();
    console.log(`  ERROR ${table}: ${res.status} ${err.substring(0, 200)}`);
    return false;
  }
  return true;
}

async function run() {
  // Extract data from HTML
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  const js = scriptMatch[1];

  // Use a sandboxed eval to extract data
  const sandbox = {};
  const extractCode = `
    ${js.split('// ========')[0]}
    _COLOR_DATA = typeof COLOR_DATA !== 'undefined' ? COLOR_DATA : [];
    _GLOSSARY_DATA = typeof GLOSSARY_DATA !== 'undefined' ? GLOSSARY_DATA : [];
    _CHAPTERS = typeof CHAPTERS !== 'undefined' ? CHAPTERS : [];
    _FAMILIES = typeof FAMILIES !== 'undefined' ? FAMILIES : [];
  `;

  // Simpler approach: use regex to extract data arrays
  console.log('Extracting data from HTML...');

  // Extract COLOR_DATA
  const colorJson = fs.readFileSync(path.join(__dirname, 'color-stories.json'), 'utf8');
  const colorStories = JSON.parse(colorJson);

  // Extract chapters
  const chapterJson = fs.readFileSync(path.join(__dirname, 'chapter-stories.json'), 'utf8');
  const chapterStories = JSON.parse(chapterJson);

  // Parse COLOR_DATA from HTML using regex
  const colorPattern = /\{[^}]*id:\s*"([^"]+)"[^}]*name:\s*"([^"]+)"[^}]*hex:\s*"([^"]+)"[^}]*rgb:\s*"([^"]*)"[^}]*hsl:\s*"([^"]*)"[^}]*family:\s*"([^"]+)"/g;
  const colors = [];
  let match;

  // Better approach: extract the full JS data by running it
  // For now, parse the JSON files we already have + extract remaining fields from HTML

  // Extract all color objects with their fields
  const idPattern = /id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*hex:\s*"([^"]+)",\s*rgb:\s*"([^"]*)",\s*hsl:\s*"([^"]*)",\s*\n\s*family:\s*"([^"]+)",\s*familyColor:\s*"([^"]*)"/g;

  let colorMatch;
  let sortOrder = 0;
  while ((colorMatch = idPattern.exec(html)) !== null) {
    const [, id, name, hex, rgb, hsl, family, familyColor] = colorMatch;

    // Find summary
    const summaryMatch = html.substring(colorMatch.index).match(/summary:\s*"([^"]*)"/);
    const summary = summaryMatch ? summaryMatch[1] : '';

    // Find descTh
    const descThMatch = html.substring(colorMatch.index).match(/descTh:\s*"([^"]*)"/);
    const descTh = descThMatch ? descThMatch[1] : '';

    // Get story from color-stories.json (full PDF content)
    const storyData = colorStories[id];
    const story = storyData ? storyData.story : '';

    // Find storyTh from HTML
    const storyThStart = html.indexOf('storyTh:', colorMatch.index);
    let storyTh = '';
    if (storyThStart !== -1 && storyThStart < colorMatch.index + 50000) {
      const btStart = html.indexOf('`', storyThStart);
      if (btStart !== -1) {
        let btEnd = -1;
        for (let i = btStart + 1; i < html.length; i++) {
          if (html[i] === '\\' && i + 1 < html.length) { i++; continue; }
          if (html[i] === '`') { btEnd = i; break; }
        }
        if (btEnd !== -1) {
          storyTh = html.substring(btStart + 1, btEnd)
            .replace(/\\n/g, '\n')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');
        }
      }
    }

    sortOrder++;
    colors.push({
      id, name, hex, rgb, hsl, family,
      family_color: familyColor,
      summary,
      summary_th: descTh,
      desc_th: descTh,
      story: story || '',
      story_th: storyTh || '',
      sort_order: sortOrder
    });
  }

  console.log(`  Colors: ${colors.length}`);

  // Chapters
  const chapterMeta = {
    'preface': { title_th: 'คำนำ', subtitle: '', order: 1 },
    'color-vision': { title_th: 'การมองเห็นสี', subtitle: 'How we see', order: 2 },
    'simple-arithmetic': { title_th: 'เลขคณิตง่าย ๆ', subtitle: 'On light', order: 3 },
    'building-the-palette': { title_th: 'สร้างจานสี', subtitle: 'Artists and their pigments', order: 4 },
    'vintage-paint-charts': { title_th: 'ชาร์ตสีโบราณ', subtitle: 'Mapping color', order: 5 },
    'chromophilia': { title_th: 'รักสี เกลียดสี', subtitle: 'Politics of color', order: 6 },
    'colorful-language': { title_th: 'ภาษาของสี', subtitle: 'Do words shape the shades we see?', order: 7 },
  };

  const chapters = Object.entries(chapterStories).map(([id, data]) => ({
    id,
    title: data.name,
    title_th: chapterMeta[id]?.title_th || '',
    subtitle: chapterMeta[id]?.subtitle || '',
    story: data.story,
    story_th: '', // Thai translation from HTML if available
    sort_order: chapterMeta[id]?.order || 0
  }));
  console.log(`  Chapters: ${chapters.length}`);

  // Glossary - extract from HTML
  const glossaryPattern = /\{\s*name:\s*"([^"]+)",\s*desc(?:ription)?:\s*"([^"]*)",\s*(?:descTh:\s*"([^"]*)",\s*)?hex:\s*"([^"]*)"/g;
  const glossaryItems = [];
  let gMatch;
  // Find GLOSSARY_DATA section
  const glossaryStart = html.indexOf('GLOSSARY_DATA');
  const glossarySection = html.substring(glossaryStart, glossaryStart + 50000);

  let gOrder = 0;
  const gPattern = /name:\s*"([^"]+)"[^}]*?desc(?:ription)?:\s*"([^"]*)"[^}]*?hex:\s*"([^"]*)"/g;
  while ((gMatch = gPattern.exec(glossarySection)) !== null) {
    gOrder++;
    glossaryItems.push({
      name: gMatch[1],
      description: gMatch[2],
      desc_th: '',
      hex: gMatch[3],
      sort_order: gOrder
    });
  }
  console.log(`  Glossary: ${glossaryItems.length}`);

  // Quotes
  const quotes = [
    { family: 'White', quote_en: 'The purest and most thoughtful minds are those which love color the most.', quote_th: 'จิตใจที่บริสุทธิ์และลึกซึ้งที่สุด คือจิตใจที่รักสีมากที่สุด', author: 'John Ruskin, The Stones of Venice (1851)', bg_color: '#2a2a2e', sort_order: 1 },
    { family: 'Yellow', quote_en: 'Mere color, unspoiled by meaning, and unallied with definite form, can speak to the soul in a thousand different ways.', quote_th: 'สีที่บริสุทธิ์ ไม่ถูกปนเปื้อนด้วยความหมาย สามารถพูดกับจิตวิญญาณได้นับพันแบบ', author: 'Oscar Wilde, 1882', bg_color: '#92400E', sort_order: 2 },
    { family: 'Orange', quote_en: 'Orange is like a man, convinced of his own powers.', quote_th: 'สีส้มเหมือนชายที่มั่นใจในพลังของตัวเอง', author: 'Wassily Kandinsky', bg_color: '#c2410c', sort_order: 3 },
    { family: 'Pink', quote_en: 'Pink is the navy blue of India.', quote_th: 'ชมพูคือสีกรมท่าของอินเดีย', author: 'Diana Vreeland', bg_color: '#9d174d', sort_order: 4 },
    { family: 'Red', quote_en: 'Red is the great clarifier — bright and revealing.', quote_th: 'แดงคือผู้ไขความกระจ่าง — สว่างและเผยทุกสิ่ง', author: 'Mary McFadden', bg_color: '#991b1b', sort_order: 5 },
    { family: 'Purple', quote_en: "I think it pisses God off if you walk by the color purple in a field somewhere and don't notice it.", quote_th: 'ฉันคิดว่าพระเจ้าคงโกรธ ถ้าเราเดินผ่านสีม่วงในทุ่งหญ้าแล้วไม่สังเกตมัน', author: 'Alice Walker, The Color Purple', bg_color: '#581c87', sort_order: 6 },
    { family: 'Blue', quote_en: 'Blue is the only color which maintains its own character in all its tones.', quote_th: 'น้ำเงินเป็นสีเดียวที่รักษาอุปนิสัยของตัวเองไว้ได้ในทุกโทน', author: 'Raoul Dufy', bg_color: '#1e3a5f', sort_order: 7 },
    { family: 'Green', quote_en: 'Absolute green is the most restful color, lacking any undertone of joy, grief, or passion.', quote_th: 'เขียวสมบูรณ์แบบคือสีที่สงบที่สุด ปราศจากทุกเสียงแห่งความสุข ความเศร้า หรือความเร่าร้อน', author: 'Wassily Kandinsky', bg_color: '#14532d', sort_order: 8 },
    { family: 'Brown', quote_en: 'The creation of man from clay is a motif that appears across many cultures and religions.', quote_th: 'การสร้างมนุษย์จากดิน เป็นสัญลักษณ์ที่ปรากฏข้ามวัฒนธรรมและศาสนา', author: 'Kassia St Clair', bg_color: '#5c3317', sort_order: 9 },
    { family: 'Black', quote_en: 'Black Is a Color.', quote_th: 'ดำเป็นสี', author: 'Galerie Maeght exhibition, Paris, 1946', bg_color: '#0a0a0a', sort_order: 10 },
  ];

  // Families
  const families = [
    { name: 'White', color: '#F0EDE8', intro: 'ขาว งาช้าง เงิน — สีแห่งความบริสุทธิ์และความว่างเปล่า', sort_order: 1 },
    { name: 'Yellow', color: '#F0C800', intro: 'ทอง เหลือง อำพัน — สีแห่งแสงสว่าง ความมั่งคั่ง และอันตราย', sort_order: 2 },
    { name: 'Orange', color: '#F08C28', intro: 'ส้ม อำพัน ขิง — สีแห่งพลัง ความอบอุ่น และอัตลักษณ์ชาติ', sort_order: 3 },
    { name: 'Pink', color: '#E8789A', intro: 'ชมพู ฟูเชีย อมรันธ์ — สีแห่งความขบถ สตรีนิยม และจิตวิทยา', sort_order: 4 },
    { name: 'Red', color: '#C0392B', intro: 'แดง สการ์เล็ต ชาด — สีแห่งอำนาจ สงคราม ความรัก และเลือด', sort_order: 5 },
    { name: 'Purple', color: '#8E44AD', intro: 'ม่วง มอว์ ไวโอเล็ต — สีแห่งราชวงศ์ ความหรูหรา และการปฏิวัติเคมี', sort_order: 6 },
    { name: 'Blue', color: '#2563EB', intro: 'น้ำเงิน คราม อินดิโก — สีแห่งท้องฟ้า ทะเล ศรัทธา และอิสรภาพ', sort_order: 7 },
    { name: 'Green', color: '#27AE60', intro: 'เขียว มรกต อะโวคาโด — สีแห่งธรรมชาติ พิษ และเงินตรา', sort_order: 8 },
    { name: 'Brown', color: '#8B6914', intro: 'น้ำตาล กากี ซีเปีย — สีแห่งดิน ประวัติศาสตร์ และความอดทน', sort_order: 9 },
    { name: 'Black', color: '#1a1a1a', intro: 'ดำ เจ็ท ถ่าน — สีแห่งความมืด อำนาจ ความลึกลับ และความสง่างาม', sort_order: 10 },
  ];

  // INSERT data
  console.log('\nInserting data into Supabase...');

  // Colors - batch in groups of 10
  console.log(`\n[Colors] ${colors.length} rows...`);
  for (let i = 0; i < colors.length; i += 10) {
    const batch = colors.slice(i, i + 10);
    const ok = await supaInsert('colors', batch);
    process.stdout.write(ok ? '.' : 'X');
  }
  console.log(' done');

  // Chapters
  console.log(`[Chapters] ${chapters.length} rows...`);
  await supaInsert('chapters', chapters);
  console.log(' done');

  // Glossary - batch
  console.log(`[Glossary] ${glossaryItems.length} rows...`);
  for (let i = 0; i < glossaryItems.length; i += 20) {
    const batch = glossaryItems.slice(i, i + 20);
    const ok = await supaInsert('glossary', batch);
    process.stdout.write(ok ? '.' : 'X');
  }
  console.log(' done');

  // Quotes
  console.log(`[Quotes] ${quotes.length} rows...`);
  await supaInsert('quotes', quotes);
  console.log(' done');

  // Families
  console.log(`[Families] ${families.length} rows...`);
  await supaInsert('families', families);
  console.log(' done');

  // Verify
  console.log('\nVerifying...');
  for (const table of ['colors', 'chapters', 'glossary', 'quotes', 'families']) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=count`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact'
      }
    });
    const count = res.headers.get('content-range')?.split('/')[1] || '?';
    console.log(`  ${table}: ${count} rows`);
  }

  console.log('\nMigration complete!');
}

run().catch(console.error);
