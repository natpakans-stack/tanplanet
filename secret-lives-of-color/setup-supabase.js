const SUPABASE_URL = 'https://nveyjftyclwvvgudynqt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52ZXlqZnR5Y2x3dnZndWR5bnF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Nzg0MzksImV4cCI6MjA5MDE1NDQzOX0.wowQs2LlQZC-w6hkFCTqo23bKqOez4YiAdMdm-GoI-k';

async function run() {
  // Create tables via Supabase REST API (SQL)
  const sqlStatements = [
    // Colors table
    `CREATE TABLE IF NOT EXISTS colors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hex TEXT NOT NULL,
      rgb TEXT,
      hsl TEXT,
      family TEXT NOT NULL,
      family_color TEXT,
      summary TEXT,
      summary_th TEXT,
      desc_th TEXT,
      story TEXT,
      story_th TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    // Chapters table
    `CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_th TEXT,
      subtitle TEXT,
      story TEXT,
      story_th TEXT,
      sort_order INT DEFAULT 0
    )`,
    // Glossary table
    `CREATE TABLE IF NOT EXISTS glossary (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      desc_th TEXT,
      hex TEXT,
      sort_order INT DEFAULT 0
    )`,
    // Quotes table
    `CREATE TABLE IF NOT EXISTS quotes (
      id SERIAL PRIMARY KEY,
      family TEXT NOT NULL,
      quote_en TEXT NOT NULL,
      quote_th TEXT,
      author TEXT,
      bg_color TEXT,
      sort_order INT DEFAULT 0
    )`,
    // Enable RLS but allow public read
    `ALTER TABLE colors ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE chapters ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE glossary ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE quotes ENABLE ROW LEVEL SECURITY`,
    `CREATE POLICY IF NOT EXISTS "Public read colors" ON colors FOR SELECT USING (true)`,
    `CREATE POLICY IF NOT EXISTS "Public read chapters" ON chapters FOR SELECT USING (true)`,
    `CREATE POLICY IF NOT EXISTS "Public read glossary" ON glossary FOR SELECT USING (true)`,
    `CREATE POLICY IF NOT EXISTS "Public read quotes" ON quotes FOR SELECT USING (true)`,
  ];

  console.log('Creating tables...');
  for (const sql of sqlStatements) {
    const label = sql.substring(0, 60).replace(/\n/g, ' ');
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
      });
      // REST API can't run raw SQL directly, need to use the SQL editor approach
      // Let's check if tables exist first
    } catch(e) {}
  }
  
  // Use the management API instead - just test connectivity
  const testRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { 'apikey': SUPABASE_KEY }
  });
  console.log('Supabase connection:', testRes.status === 200 ? 'OK' : 'FAIL ' + testRes.status);
  
  if (testRes.ok) {
    const data = await testRes.json();
    console.log('Available endpoints:', JSON.stringify(data).substring(0, 200));
  }
}

run().catch(console.error);
