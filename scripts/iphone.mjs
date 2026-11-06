// iPhone (WebKit) timeline screenshots of the hero with animations ON, for Safari-specific debugging.
// Usage: node scripts/iphone.mjs [baseURL] [outDir]
import { webkit, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://localhost:4322';
const out = process.argv[3] ?? 'shots/iphone-timeline';
await mkdir(out, { recursive: true });
const b = await webkit.launch();
for (const dev of ['iPhone 15 Pro', 'iPhone SE']) {
  const ctx = await b.newContext({ ...devices[dev], locale: 'cs-CZ' });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  const slug = dev.toLowerCase().replace(/\s+/g, '-');
  for (const t of [300, 2500, 8000]) {
    await p.waitForTimeout(t === 300 ? 300 : t - (t === 2500 ? 300 : 2500));
    await p.screenshot({ path: `${out}/${slug}-${t}ms.png` });
  }
  await ctx.close();
}
await b.close();
console.log('done');
