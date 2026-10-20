# Brief: add illustrative images to portfolio case-study pages

Site: /Users/natpakansirirat/Documents/Projects/tanplanet (static, GitHub Pages, PUBLIC repo, live at https://projects.tanplanet.work/<folder>/). Owner (แทน) feedback: pages have no images and are "อ่านยาก ดูยาก" (hard to read). Goal per page: add AT LEAST ONE image to EVERY section (owner rule: every section must have an illustration, like a Medium article) that help the reader understand the story (real screenshots of the product > real photos > clean HTML/CSS mockup > Unsplash mood photo as last resort).

## Rules
- Edit ONLY the page folders assigned to you. Do NOT edit index.html, sitemap.xml, llms.txt, common/, or other pages. Do NOT git add/commit/push (the coordinator will).
- Read each page fully first; place each image next to the section it explains (hero area, Empathize/problem, Prototype/how it works, result). Every section-intro block (each eyebrow section) needs at least one figure; more is fine where it helps.
- Sources, in order of preference:
  1. Real screenshots of the product: find the project's source folder (search /Users/natpakansirirat/Documents/Projects/tanplanet and /Users/natpakansirirat/Documents/Projects for the project; check README, the page's own "ดูของจริง"/demo links, live URLs). Capture with Playwright (module /Users/natpakansirirat/.claude/skills/playwright-skill/node_modules/playwright/index.mjs — import by absolute path) from a live public URL or a local static build/dev server you start yourself (stop it after). Desktop 1440×900 and/or mobile 393×852.
  2. Existing image assets inside the project folder (screens, icons, photos) that are clearly the product.
  3. An HTML/CSS mockup built in the page (e.g. a phone frame showing a LINE chat bubble, a terminal block, a dashboard card) using the page's own tokens — only depicting what the product really does.
  4. Unsplash photo (Unsplash License only, download to the folder, never hotlink) for context/mood, with a small credit "ภาพ: <name> / Unsplash".
- PRIVACY (public repo): never show real personal data — emails, phone numbers, names of real people/family, bank/PromptPay numbers, money balances/portfolio values, addresses, tokens/keys/IPs, Jira ticket contents from work, employer name "Real Factory", client names (unless the page already names them). Blur or replace with sample data before saving. For company/client internal tools, prefer mockups with sample data or the page's existing public info. Check every image visually before using it.
- Files: save to <folder>/img/ as JPG/WebP (width ≤ 1600, target < 200 KB; use ffmpeg or sips to compress). Markup: `<figure class="shot"><img src="img/…" width=".." height=".." loading="lazy" alt="Thai alt"><figcaption>short Thai caption</figcaption></figure>`. Add once per page in its <style>: `.shot{margin:8px 0 32px}.shot img{display:block;width:100%;height:auto;border-radius:var(--radius,12px);box-shadow:0 0 0 1px var(--border,#e7e5e4),0 12px 32px rgba(0,0,0,.08)}.shot figcaption{margin-top:10px;font-size:.82rem;color:var(--text-secondary,#57534e);text-align:center}` and a `.shot-pair` 2-column variant (stack < 640px) for desktop+mobile or before/after. Phone screenshots: max-width ~360px centered or paired.
- While on each page, also fix if present: hack-card h3 must contain the svg icon then `<span>` (not svg outside h3); emoji used as icons → lucide-style inline svg; links to projects.tanplanet.info → https://projects.tanplanet.work/.
- Verify each page with Playwright at 1280 and 393: no horizontal overflow (scrollWidth==clientWidth), all <img> load (naturalWidth>0), no console errors. Look at a screenshot of each figure.

## Report (concise)
Per page: images added (file, KB, section, source type), anything skipped and why, any privacy redaction done.

## OWNER UPDATE (overrides above where different)
- Real UI of the actual platform FIRST, always. Mockups only if a real screen truly cannot be obtained; Unsplash only as the very last resort.
- Client / employer work: use the REAL UI screenshots, and blur (ffmpeg boxblur on the region, or a solid patch) the client/employer logos and brand names instead of switching to mockups.
- Personal projects: no need to blur logos or product names.
- Still blur/replace genuinely sensitive data in any screenshot: money balances/portfolio values, bank/PromptPay numbers, family/real people's names, emails/phones, tokens/IPs.
