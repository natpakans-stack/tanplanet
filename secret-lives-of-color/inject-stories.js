#!/usr/bin/env node
/**
 * Inject extracted color stories from JSON into index.html
 * Updates the `story` field in COLOR_DATA for each color.
 *
 * Usage: node inject-stories.js
 */

const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, 'index.html');
const JSON_FILE = path.join(__dirname, 'color-stories.json');

// Read files
const html = fs.readFileSync(HTML_FILE, 'utf8');
const stories = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

console.log(`Loaded ${Object.keys(stories).length} stories from ${JSON_FILE}`);

let updated = html;
let count = 0;
let skipped = 0;

for (const [colorId, data] of Object.entries(stories)) {
  if (!data.story || data.word_count < 100) {
    console.log(`  SKIP ${data.name} (${data.word_count} words - too short)`);
    skipped++;
    continue;
  }

  // Escape the story text for JS template literal (backtick)
  const escaped = data.story
    .replace(/\\/g, '\\\\')       // backslashes
    .replace(/`/g, '\\`')         // backticks
    .replace(/\$/g, '\\$')        // dollar signs (template literal)
    .replace(/\n\n/g, '\\n\\n')   // paragraph breaks
    .replace(/\n/g, ' ');          // remaining single newlines

  // Find the color's story field in the HTML
  // Pattern: id: "colorId" ... story: `...`
  const idPattern = `id: "${colorId}"`;
  const idPos = updated.indexOf(idPattern);

  if (idPos === -1) {
    // Try alternative IDs (e.g., "dragons-blood" vs "dragon-s-blood")
    console.log(`  NOT FOUND: ${colorId} (${data.name})`);
    skipped++;
    continue;
  }

  // Find the story field after this id
  const storyStart = updated.indexOf('story: `', idPos);
  if (storyStart === -1 || storyStart > idPos + 5000) {
    console.log(`  NO STORY FIELD: ${colorId}`);
    skipped++;
    continue;
  }

  // Find the closing backtick of the story
  const contentStart = storyStart + 8; // after "story: `"
  let depth = 0;
  let storyEnd = -1;
  for (let i = contentStart; i < updated.length; i++) {
    if (updated[i] === '\\' && i + 1 < updated.length) {
      i++; // skip escaped char
      continue;
    }
    if (updated[i] === '`') {
      storyEnd = i;
      break;
    }
  }

  if (storyEnd === -1) {
    console.log(`  BROKEN STORY: ${colorId}`);
    skipped++;
    continue;
  }

  const oldStory = updated.substring(contentStart, storyEnd);
  const oldWords = oldStory.split(/\s+/).length;

  // Only update if new story is longer
  if (data.word_count <= oldWords) {
    console.log(`  KEEP ${data.name} (existing ${oldWords} >= new ${data.word_count})`);
    skipped++;
    continue;
  }

  // Replace
  updated = updated.substring(0, contentStart) + escaped + updated.substring(storyEnd);
  count++;
  console.log(`  ✓ ${data.name}: ${oldWords} → ${data.word_count} words`);
}

// Save
fs.writeFileSync(HTML_FILE, updated);

console.log(`\n${'='.repeat(50)}`);
console.log(`Updated: ${count} colors`);
console.log(`Skipped: ${skipped} colors`);
console.log(`Saved to: ${HTML_FILE}`);

// Validate JS
try {
  const match = updated.match(/<script>([\s\S]*?)<\/script>/);
  require('vm').createScript(match[1]);
  console.log('\nJS syntax: ✓ Valid');
} catch (e) {
  console.log(`\nJS syntax: ✗ ERROR - ${e.message}`);
  console.log('You may need to manually fix escaping issues.');
}
