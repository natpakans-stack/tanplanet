/**
 * ============================================================
 *  🎨 ImageGen.gs — OpenAI via CF Worker + Diverse Themes
 * ============================================================
 *  v9: ใช้ pickRandomTheme() ที่ห้ามซ้ำ 3 วัน + prompt ชัดเจน
 */

const WORKER_URL = 'https://openai-proxy.tan-natpakan.workers.dev';

const OPENAI_CONFIG = {
  PRIMARY_MODEL:  'gpt-image-2',
  FALLBACK_MODEL: 'gpt-image-1',
  SIZE:           '1024x1536',
  QUALITY:        'high',
  MAX_RETRIES:    2,
  BACKOFF_SECS:   [10, 30],
};

function generateImageWithGemini(dayInfo) {
  const url = `${WORKER_URL}/v1/images/generations`;

  // 🎲 Random theme (anti-repetition logic อยู่ใน pickRandomTheme)
  const theme = pickRandomTheme();
  const decoration = theme.decoration.replace('{color}', dayInfo.primaryColor);

  const blessingText = dayInfo.blessing.join('\n');
  const prompt = `
A beautiful Thai-style greeting card image in vertical portrait orientation (2:3 aspect ratio).

MAIN SUBJECT:
${theme.subject}

DECORATION & COLOR:
${decoration}
Beautiful blurred bokeh background with soft natural light.
Sacred, calming, photorealistic, cinematic lighting, high quality.

THAI TEXT TO RENDER ON IMAGE (this is CRITICAL — render exactly as written):
- Top of text area: "${dayInfo.greeting}"
- Below the greeting, on separate lines: "${blessingText}"

TEXT STYLING:
- Use elegant traditional Thai font style (similar to Charm or Athiti font)
- Text color: bright white (#FFFFFF) with bold black outline/stroke
- Heading "${dayInfo.greeting}" should be LARGER and BOLD
- Blessing lines below should be smaller but still clearly readable
- All text centered horizontally
- Position text in the bottom 35-40% area of the image
- Add subtle drop shadow behind text for depth

IMPORTANT:
- Render the Thai text characters EXACTLY as provided above
- The text must be perfectly readable
- Follow the MAIN SUBJECT description strictly — do NOT add elements that are excluded
  `.trim();

  const models = [OPENAI_CONFIG.PRIMARY_MODEL, OPENAI_CONFIG.FALLBACK_MODEL];

  for (const model of models) {
    Logger.log(`📡 ลองใช้ model: ${model}`);

    for (let attempt = 0; attempt <= OPENAI_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const payload = {
          model:   model,
          prompt:  prompt,
          size:    OPENAI_CONFIG.SIZE,
          quality: OPENAI_CONFIG.QUALITY,
          n:       1,
        };

        const response = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });

        const code = response.getResponseCode();
        const body = response.getContentText();

        if (code === 200) {
          const json = JSON.parse(body);
          const b64 = json.data?.[0]?.b64_json;
          if (!b64) throw new Error('ไม่พบ image data');
          Logger.log(`✅ สำเร็จ — Theme: ${theme.name}`);
          const bytes = Utilities.base64Decode(b64);
          return Utilities.newBlob(bytes, 'image/png', `greeting-${dayInfo.nameTh}.png`);
        }

        if (code === 429) {
          if (attempt < OPENAI_CONFIG.MAX_RETRIES) {
            const wait = OPENAI_CONFIG.BACKOFF_SECS[attempt];
            Logger.log(`⏳ Rate limit — รอ ${wait}s`);
            Utilities.sleep(wait * 1000);
            continue;
          } else break;
        }

        throw new Error(`OpenAI API error ${code}: ${body.slice(0, 300)}`);

      } catch (err) {
        if (attempt < OPENAI_CONFIG.MAX_RETRIES) {
          Utilities.sleep(OPENAI_CONFIG.BACKOFF_SECS[attempt] * 1000);
          continue;
        }
        throw err;
      }
    }
  }

  throw new Error('❌ ทุก model + retry fail');
}

function uploadToDriveAndGetUrl(blob, dayNameTh) {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const dateStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd');
  const file = folder.createFile(blob).setName(`greeting-${dayNameTh}-${dateStr}.png`);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const id = file.getId();
  return `https://lh3.googleusercontent.com/d/${id}=w1024`;
}