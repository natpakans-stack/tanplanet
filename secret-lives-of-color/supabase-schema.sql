-- ============================================
-- The Secret Lives of Color — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Colors (75 main colors)
CREATE TABLE IF NOT EXISTS colors (
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
);

-- 2. Chapters (7 introduction chapters)
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_th TEXT,
  subtitle TEXT,
  story TEXT,
  story_th TEXT,
  sort_order INT DEFAULT 0
);

-- 3. Glossary (130 additional colors)
CREATE TABLE IF NOT EXISTS glossary (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  desc_th TEXT,
  hex TEXT,
  sort_order INT DEFAULT 0
);

-- 4. Quotes (10 quote dividers)
CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  family TEXT NOT NULL UNIQUE,
  quote_en TEXT NOT NULL,
  quote_th TEXT,
  author TEXT,
  bg_color TEXT,
  sort_order INT DEFAULT 0
);

-- 5. Families (10 color families)
CREATE TABLE IF NOT EXISTS families (
  name TEXT PRIMARY KEY,
  color TEXT NOT NULL,
  intro TEXT,
  sort_order INT DEFAULT 0
);

-- Enable Row Level Security + Public Read
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE glossary ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read colors" ON colors FOR SELECT USING (true);
CREATE POLICY "Public read chapters" ON chapters FOR SELECT USING (true);
CREATE POLICY "Public read glossary" ON glossary FOR SELECT USING (true);
CREATE POLICY "Public read quotes" ON quotes FOR SELECT USING (true);
CREATE POLICY "Public read families" ON families FOR SELECT USING (true);

-- Done!
SELECT 'Schema created successfully!' AS status;
