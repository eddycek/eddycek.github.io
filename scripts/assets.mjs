// Generates favicons, PWA icons and Open Graph cards into public/.
// Usage: node scripts/assets.mjs   (needs `npx playwright install chromium` once)
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const C = { bg: '#0B0E12', surface: '#12161C', grid: '#1A2029', ink: '#E8EBEE', muted: '#8E98A5', signal: '#FF7A2F', trace: '#5CC8D6' };
const PORTRAIT = pathToFileURL(resolve('public/portrait/eddy-960.webp')).href;
const font = (p) => pathToFileURL(resolve('node_modules', p)).href;
const FONTS = `
@font-face{font-family:B;src:url(${font('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2')});font-weight:200 800}
@font-face{font-family:B;src:url(${font('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-ext-opsz-normal.woff2')});font-weight:200 800;unicode-range:U+0100-024F}
@font-face{font-family:M;src:url(${font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2')});font-weight:500}
@font-face{font-family:M;src:url(${font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-500-normal.woff2')});font-weight:500;unicode-range:U+0100-024F}`;

/** The mark: a PID step response (overshoot, ringing, settle) on a dark tile, beam head in cyan. */
const mark = ({ pad = 0, radius = 14 } = {}) => {
  const s = 64 - pad * 2;
  const t = (x, y) => `${(pad + (x / 64) * s).toFixed(2)} ${(pad + (y / 64) * s).toFixed(2)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="${C.bg}"/>
  <g stroke="${C.grid}" stroke-width="1">
    <path d="M${t(8, 44)} H${t(56, 44).split(' ')[0]}"/>
  </g>
  <path d="M${t(8, 44)} L${t(18, 44)} C${t(21, 44)} ${t(22, 12)} ${t(27, 14)} S${t(32, 30)} ${t(36, 25)} S${t(41, 20)} ${t(44, 23)} S${t(50, 22)} ${t(56, 22)}"
    fill="none" stroke="${C.signal}" stroke-width="${(5 * s) / 64}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${t(56, 22).split(' ')[0]}" cy="${t(56, 22).split(' ')[1]}" r="${(4 * s) / 64}" fill="${C.trace}"/>
</svg>`;
};

const ogHtml = (claim, lang) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>${FONTS}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:radial-gradient(70% 90% at 80% 30%,rgba(255,122,47,.16),transparent 60%),${C.bg};color:${C.ink};font-family:B;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background:linear-gradient(to right,${C.grid} 1px,transparent 1px) 0 0/60px 60px,linear-gradient(to bottom,${C.grid} 1px,transparent 1px) 0 0/60px 60px;opacity:.9}
svg.trace{position:absolute;inset:0}
.scan{position:absolute;inset:0;background:repeating-linear-gradient(to bottom,transparent 0 2px,rgba(11,14,18,.35) 2px 3px)}
.osd{font-family:M;font-size:20px;letter-spacing:.18em;text-transform:uppercase}
.tl{position:absolute;left:64px;top:52px;color:${C.signal};display:flex;gap:18px;align-items:center}
.tl i{width:14px;height:14px;border-radius:50%;background:${C.signal};box-shadow:0 0 14px ${C.signal}}
.tr{position:absolute;right:64px;top:52px;color:${C.muted}}
.name{position:absolute;left:58px;top:118px;font-weight:800;font-size:170px;line-height:.86;letter-spacing:-.05em;font-variation-settings:'opsz' 96}
.name span{display:block}
.name .e{padding-left:110px}
.name .v{color:transparent;background:repeating-linear-gradient(to bottom,${C.ink} 0 5px,rgba(232,235,238,.62) 5px 8px);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(-3px 0 0 rgba(92,200,214,.7)) drop-shadow(3px 0 0 rgba(255,122,47,.7))}
.aka{position:absolute;left:172px;top:432px;font-family:M;font-size:30px;color:${C.signal}}
.aka b{color:${C.muted};font-weight:500;font-size:20px;letter-spacing:.2em;margin-right:16px}
.claim{position:absolute;left:64px;bottom:60px;font-weight:600;font-size:44px;color:${C.signal};text-shadow:0 0 30px rgba(255,122,47,.45)}
.url{position:absolute;right:64px;bottom:66px;color:${C.ink};z-index:3}
.pic{position:absolute;right:26px;top:34px;width:450px;height:600px;z-index:1;
  -webkit-mask-image:linear-gradient(to bottom,#000 62%,transparent 97%),linear-gradient(to right,transparent 0,#000 22%);-webkit-mask-composite:source-in;mask-composite:intersect}
.pic img{width:100%;height:100%;object-fit:contain;object-position:top;display:block;
  filter:drop-shadow(-3px 0 0 rgba(92,200,214,.55)) drop-shadow(3px 0 0 rgba(255,122,47,.55)) drop-shadow(0 0 26px rgba(255,122,47,.28)) contrast(1.04)}
.pic::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(to bottom,transparent 0 2px,rgba(11,14,18,.28) 2px 3px)}
.cam{position:absolute;z-index:2;left:800px;top:100px;width:322px;height:330px;
  background:linear-gradient(${C.signal},${C.signal}) 0 0/22px 2px,linear-gradient(${C.signal},${C.signal}) 0 0/2px 22px,
  linear-gradient(${C.signal},${C.signal}) 100% 0/22px 2px,linear-gradient(${C.signal},${C.signal}) 100% 0/2px 22px,
  linear-gradient(${C.signal},${C.signal}) 0 100%/22px 2px,linear-gradient(${C.signal},${C.signal}) 0 100%/2px 22px,
  linear-gradient(${C.signal},${C.signal}) 100% 100%/22px 2px,linear-gradient(${C.signal},${C.signal}) 100% 100%/2px 22px;background-repeat:no-repeat;opacity:.85}
.cam span{position:absolute;left:0;top:-30px;font-family:M;font-size:15px;letter-spacing:.18em;color:${C.signal}}
.name,.aka,.claim,.tl,.tr{z-index:3}
</style></head><body>
<div class="grid"></div>
<svg class="trace" viewBox="0 0 1200 630" preserveAspectRatio="none">
  <path d="M560 360 L660 360 C690 360 700 120 760 140 S820 290 860 250 S910 190 950 220 S1010 215 1060 212 S1120 212 1200 212" fill="none" stroke="${C.signal}" stroke-width="5" stroke-linecap="round" opacity=".9"/>
  <path d="M560 360 L660 360 C690 360 700 120 760 140 S820 290 860 250 S910 190 950 220 S1010 215 1060 212 S1120 212 1200 212" fill="none" stroke="${C.signal}" stroke-width="22" stroke-linecap="round" opacity=".12"/>
  <path d="M560 470 C640 440 700 520 780 470 S900 420 980 470 S1100 500 1200 460" fill="none" stroke="${C.trace}" stroke-width="3" opacity=".55"/>
  <circle cx="1060" cy="212" r="10" fill="${C.trace}"/>
</svg>
<div class="pic"><img src="${PORTRAIT}" alt=""></div>
<div class="cam"><span>● LOCK</span></div>
<div class="scan"></div>
<div class="osd tl"><i></i>CTO · KEBOOLA · PRAGUE</div>
<div class="osd tr">CH1 · SIGNAL</div>
<h1 class="name"><span class="v">Vaclav</span><span class="e">Eder</span></h1>
<p class="aka"><b>A.K.A.</b>eddycek_</p>
<p class="claim">${claim}</p>
<p class="osd url">vaclaveder.cz</p>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();

async function png(html, w, h, out) {
  await page.setViewportSize({ width: w, height: h });
  // Load from a real file so file:// font URLs are allowed.
  const tmp = resolve(tmpdir(), `assets-${w}x${h}.html`);
  await writeFile(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, omitBackground: false });
  console.log('✓', out);
}
const svgPage = (svg, size) => `<!doctype html><style>*{margin:0}body{width:${size}px;height:${size}px;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`;

await writeFile('public/favicon.svg', mark());
await png(svgPage(mark(), 32), 32, 32, 'public/favicon-32.png');
await png(svgPage(mark({ radius: 0 }), 180), 180, 180, 'public/apple-touch-icon.png');
await png(svgPage(mark(), 192), 192, 192, 'public/icon-192.png');
await png(svgPage(mark(), 512), 512, 512, 'public/icon-512.png');
await png(svgPage(mark({ pad: 10, radius: 0 }), 512), 512, 512, 'public/icon-maskable-512.png');
await png(ogHtml('Hledám signál v šumu.', 'cs'), 1200, 630, 'public/og.png');
await png(ogHtml('I look for the signal in the noise.', 'en'), 1200, 630, 'public/og-en.png');
await browser.close();
