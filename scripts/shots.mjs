// Section-by-section screenshots on phone and tablet for visual review.
// Usage: npm run build && node scripts/shots.mjs [baseURL]  → shots/<device>/<lang>-<section>.png
import { chromium, webkit, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://localhost:4322';
const DEVICES = [
  ['iphone-se', 'iPhone SE', webkit],
  ['pixel-7', 'Pixel 7', chromium],
  ['ipad-mini', 'iPad Mini', webkit],
  ['ipad-pro-landscape', 'iPad Pro 11 landscape', webkit],
];
const SECTIONS = ['signal', 'work', 'track-record', 'side-quests', 'personal', 'contact'];

for (const [slug, name, engine] of DEVICES) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ ...devices[name], locale: 'cs-CZ', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await mkdir(`shots/${slug}`, { recursive: true });
  for (const [lang, path] of [['cs', '/'], ['en', '/en/']]) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    for (const id of SECTIONS) {
      const el = page.locator(`#${id}`);
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: `shots/${slug}/${lang}-${id}.png` });
    }
    await page.locator('.slayer-cta').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `shots/${slug}/${lang}-poem-dialog.png` });
    await page.keyboard.press('Escape');
  }
  await browser.close();
  console.log('✓', slug);
}
