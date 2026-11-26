// Captures light/dark screenshots of the public pages at phone and desktop
// widths. Run against a production build in demo mode:
//
//   npm run build && npm run start -- -p 3100
//   node scripts/capture-screenshots.mjs [baseUrl] [outDir]
//
// Set PLAYWRIGHT_CHANNEL=chrome to use an installed Chrome.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const outDir = process.argv[3] ?? "docs/screenshots/batch3";
mkdirSync(outDir, { recursive: true });

const pages = [
  { name: "home", path: "/" },
  { name: "spaces", path: "/spaces" },
  { name: "space-detail", path: "/spaces/space-1" },
  { name: "not-found", path: "/this-page-does-not-exist" },
  // Owner pages need a Supabase session; in demo mode this shows the login redirect.
  { name: "owner-edit", path: "/owner/spaces/space-1/edit" },
];
const widths = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 900 },
];

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}
);
try {
  for (const theme of ["light", "dark"]) {
    for (const vp of widths) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        colorScheme: theme,
      });
      await context.addInitScript((t) => {
        try {
          localStorage.setItem("spacego-theme", t);
        } catch {}
      }, theme);
      const page = await context.newPage();
      for (const p of pages) {
        await page.goto(base + p.path, { waitUntil: "networkidle" });
        await page.waitForTimeout(400);
        const file = path.join(outDir, `${p.name}-${vp.name}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: vp.width >= 1280 ? false : false });
        console.log("saved", file, "->", page.url().replace(base, ""));
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
