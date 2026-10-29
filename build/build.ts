// Render parts/*.md (joined in file-name order) to ../HANDOFF-FOR-HUMANS.pdf.
// Run: bun build.ts   (needs Bun and a local Chrome or Chromium)
// Packages (marked, puppeteer-core) install on first run via Bun auto-install.
// Text before the first "# " heading becomes the cover page.
import { marked } from "marked";
import puppeteer from "puppeteer-core";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const here = import.meta.dir;
const partsDir = join(here, "parts");
const partFiles = readdirSync(partsDir).filter((f) => f.endsWith(".md")).sort();
if (partFiles.length === 0) throw new Error(`No .md files in ${partsDir}`);
const src = (await Promise.all(partFiles.map((f) => Bun.file(join(partsDir, f)).text()))).join("\n\n");
const css = await Bun.file(join(here, "style.css")).text();
const out = join(here, "..", "HANDOFF-FOR-HUMANS.pdf");

// Newest Playwright-managed Chromium, if any (~/Library/Caches/ms-playwright or ~/.cache/ms-playwright).
const playwrightChromes = [join(homedir(), "Library/Caches/ms-playwright"), join(homedir(), ".cache/ms-playwright")]
  .filter((dir) => existsSync(dir))
  .flatMap((dir) =>
    readdirSync(dir)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
      .flatMap((d) => [
        join(dir, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
        join(dir, d, "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
        join(dir, d, "chrome-linux/chrome"),
        join(dir, d, "chrome-linux64/chrome"),
      ]),
  );

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  ...playwrightChromes,
].filter(Boolean) as string[];
const chrome = chromeCandidates.find((p) => existsSync(p));
if (!chrome) throw new Error("No Chrome or Chromium found. Set CHROME_PATH.");

// Slug + table of contents from H1/H2 headings.
const slugCount = new Map<string, number>();
const slug = (t: string) => {
  const base = t.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const n = slugCount.get(base) ?? 0;
  slugCount.set(base, n + 1);
  return n ? `${base}-${n}` : base;
};
const toc: { level: number; text: string; id: string }[] = [];
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slug(text);
      if (depth <= 2) toc.push({ level: depth, text, id });
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
  },
});

// Optional title block: everything before the first "\n# " is the cover.
const firstH1 = src.search(/^# /m);
const cover = firstH1 > 0 ? src.slice(0, firstH1) : "";
const body = firstH1 > 0 ? src.slice(firstH1) : src;
const bodyHtml = await marked.parse(body);
const coverHtml = cover ? `<section class="cover">${await marked.parse(cover)}</section>` : "";
const tocHtml =
  `<nav class="toc"><h1 class="toc-title">Contents</h1><ol>` +
  toc
    .map((t) => `<li class="toc-l${t.level}"><a href="#${t.id}">${t.text}</a></li>`)
    .join("") +
  `</ol></nav>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>${coverHtml}${tocHtml}<main>${bodyHtml}</main></body></html>`;
await Bun.write(join(here, "handbook.html"), html);

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.goto(`file://${join(here, "handbook.html")}`, { waitUntil: "load" });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  displayHeaderFooter: true,
  headerTemplate: `<div></div>`,
  footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#888;">
    <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  outline: true,
});
await browser.close();
console.log(`Wrote ${out}`);
