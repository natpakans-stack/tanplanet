// Mirror CDN assets (Framer / Webflow) into <dir>/_ext/<host>/... and rewrite URLs to relative paths,
// so the clone survives after the paid plans end.
// usage: bun run mirror-ext.ts <dir>
import { readdirSync, statSync, existsSync } from "fs";
import { join, dirname, relative, extname } from "path";

const DIR = process.argv[2];
const HOSTS = ["framerusercontent.com", "cdn.prod.website-files.com", "d3e54v103j8qbb.cloudfront.net", "i.imgur.com"];
const URL_RE = new RegExp(`https://(?:${HOSTS.map((h) => h.replace(/\./g, "\\.")).join("|")})/[^\\s"'<>\\\\,\`]+`, "g");
// URLs may contain "(1)" — drop a trailing ")" only when it closes a CSS url(...)
const balance = (u: string) => {
  while ((u.match(/\)/g) ?? []).length > (u.match(/\(/g) ?? []).length) u = u.slice(0, u.lastIndexOf(")"));
  return u;
};
const TEXT = new Set([".html", ".css", ".js", ".mjs", ".json"]);

// ponytail: query string becomes part of the filename (Framer serves ?scale-down-to= variants of the same path)
function localFor(u: string): string {
  const x = new URL(u.replace(/&amp;/g, "&"));
  let p = decodeURIComponent(x.pathname);
  if (x.search) {
    const ext = extname(p);
    const tag = x.search.slice(1).replace(/[^A-Za-z0-9=-]/g, "_");
    p = (ext ? p.slice(0, -ext.length) : p) + "__" + tag + ext;
  }
  return join(DIR, "_ext", x.host, p);
}

const queue: string[] = [];
const seen = new Set<string>();
const walk = (d: string) =>
  readdirSync(d).forEach((f) => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (TEXT.has(extname(p))) queue.push(p);
  });
walk(DIR);

let fetched = 0, failed = 0;
async function download(u: string, to: string): Promise<boolean> {
  if (existsSync(to)) return true;
  const r = await fetch(u.replace(/&amp;/g, "&"));
  if (!r.ok) { console.warn(`  ! ${r.status} ${u}`); failed++; return false; }
  await Bun.write(to, await r.arrayBuffer());
  fetched++;
  return true;
}

while (queue.length) {
  const file = queue.shift()!;
  if (seen.has(file)) continue;
  seen.add(file);
  let text = await Bun.file(file).text();
  const urls = [...new Set((text.match(URL_RE) ?? []).map(balance))];
  // Framer modules import siblings relatively ("./chunk.mjs") — pull those too
  const origin = file.includes("/_ext/") ? "https://" + relative(join(DIR, "_ext"), file) : null;
  if (origin && /\.m?js$/.test(file)) {
    for (const m of text.matchAll(/["'](\.\.?\/[^"']+\.m?js)["']/g)) {
      const abs = new URL(m[1], origin).href;
      const to = localFor(abs);
      if (await download(abs, to)) queue.push(to);
    }
  }
  for (const u of urls) {
    const to = localFor(u);
    if (!(await download(u, to))) continue;
    if (TEXT.has(extname(to))) queue.push(to);
    // encode each segment: on-disk names keep spaces/"=" but URLs must not
    let rel = relative(dirname(file), to).split(/[\\/]/).map(encodeURIComponent).join("/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    text = text.split(u).join(rel);
  }
  // we rewrite assets, so their SRI hashes no longer match
  if (file.endsWith(".html")) text = text.replace(/\s(integrity|crossorigin)="[^"]*"/g, "");
  await Bun.write(file, text);
}
console.log(`✓ ${fetched} files mirrored, ${failed} failed`);
