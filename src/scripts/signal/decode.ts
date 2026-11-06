/*
 * Text that resolves out of glyph noise. Every [data-decode] element under
 * root has its non-whitespace characters wrapped in spans; while scrambled,
 * the real character stays in the DOM (transparent, so layout and wrapping
 * never move) and a random glyph is painted over it via ::after. On entering
 * the viewport the characters resolve roughly left to right; afterwards a few
 * characters occasionally re-glitch. Whitespace and line breaks are untouched.
 * Elements with data-glitch="poem" | "name" keep flickering after decoding and
 * now and then fully melt down for a moment (all glyphs scrambled, RGB split,
 * torn slices). A window 'signal:failsafe' event melts every such element.
 */
import { prefersReduced } from './common';

const GLYPHS = Array.from('░▒▓▚▞▖▗▘│┤┐└┴┬├─┼┘┌╱╲0123456789');
const CLS = 'sd-c';
const CSS =
  `.${CLS}{position:relative}` +
  `.${CLS}[data-g]{color:transparent;-webkit-text-fill-color:transparent}` +
  `.${CLS}[data-g]::after{content:attr(data-g);content:attr(data-g)/"";position:absolute;left:0;top:0;` +
  `color:var(--c-signal,#FF7A2F);-webkit-text-fill-color:var(--c-signal,#FF7A2F);pointer-events:none}` +
  `.sd-melt{animation:sd-melt .22s steps(1,end) infinite}` +
  `.sd-melt .${CLS}[data-g]::after{color:var(--c-trace,#5CC8D6);-webkit-text-fill-color:var(--c-trace,#5CC8D6)}` +
  `.sd-melt .${CLS}:nth-child(3n)[data-g]::after{color:var(--c-ink,#E8EBEE);-webkit-text-fill-color:var(--c-ink,#E8EBEE)}` +
  `@keyframes sd-melt{` +
  `0%{transform:translate(-2px,0) skewX(-3deg);clip-path:inset(0 0 35% 0);text-shadow:2px 0 var(--c-trace),-2px 0 var(--c-signal)}` +
  `33%{transform:translate(3px,0) skewX(2deg);clip-path:inset(15% 0 5% 0);text-shadow:-2px 0 var(--c-trace),2px 0 var(--c-signal)}` +
  `66%{transform:translate(-1px,0);clip-path:inset(5% 0 20% 0);text-shadow:1px 0 var(--c-signal),-1px 0 var(--c-trace)}` +
  `100%{transform:none;clip-path:none;text-shadow:none}}`;

let styleEl: HTMLStyleElement | null = null;
let styleRefs = 0;

interface Item {
  el: HTMLElement;
  spans: HTMLSpanElement[];
  at: Float32Array; // resolve time (ms after start) per span
  start: number;
  state: 0 | 1 | 2; // scrambled, decoding, done
  visible: boolean;
  label: boolean; // we set aria-label
  mode: '' | 'poem' | 'name';
  nextFlick: number;
  nextMelt: number;
  meltUntil: number;
}

const FLICK: Record<'poem' | 'name', [number, number]> = { poem: [600, 1600], name: [1800, 4500] };
const MELT: Record<'poem' | 'name', [number, number]> = { poem: [8000, 15000], name: [14000, 26000] };
const rnd = (r: [number, number]): number => r[0] + Math.random() * (r[1] - r[0]);

const glyph = (): string => GLYPHS[(Math.random() * GLYPHS.length) | 0] ?? '░';

export function decodeText(root: HTMLElement): () => void {
  if (prefersReduced()) return () => {};
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-decode]'));
  if (!els.length) return () => {};

  if (!styleRefs++) {
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
  }

  const items: Item[] = els.map((el) => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const label = !el.hasAttribute('aria-label');
    if (label) el.setAttribute('aria-label', text);
    const spans: HTMLSpanElement[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const s = node.data.normalize('NFC');
      if (!/\S/.test(s)) continue;
      const frag = document.createDocumentFragment();
      let ws = '';
      for (const ch of s) {
        if (/\s/.test(ch)) {
          ws += ch;
          continue;
        }
        if (ws) {
          frag.append(ws);
          ws = '';
        }
        const sp = document.createElement('span');
        sp.className = CLS;
        sp.textContent = ch;
        sp.setAttribute('data-g', glyph());
        frag.append(sp);
        spans.push(sp);
      }
      if (ws) frag.append(ws);
      node.replaceWith(frag);
    }
    const n = spans.length;
    const dur = Math.min(700, 220 + n * 8);
    const at = new Float32Array(n);
    for (let i = 0; i < n; i++) at[i] = 60 + (i / Math.max(1, n)) * dur + Math.random() * 140;
    const g = el.dataset.glitch;
    const mode = g === 'poem' || g === 'name' ? g : '';
    return { el, spans, at, start: 0, state: 0, visible: false, label, mode, nextFlick: 0, nextMelt: 0, meltUntil: 0 };
  });

  // Re-glitch pool (fixed size, no per-frame allocation).
  const G = 32;
  const gSpan: (HTMLSpanElement | null)[] = new Array<HTMLSpanElement | null>(G).fill(null);
  const gUntil = new Float64Array(G);
  let nextGlitch = performance.now() + 2500;
  let raf = 0;
  let lastWrite = 0;

  const anyVisible = (): boolean => items.some((it) => it.visible);

  const tick = (now: number): void => {
    raf = 0;
    if (document.hidden || !anyVisible()) return;
    if (now - lastWrite >= 45) {
      lastWrite = now;
      for (const it of items) {
        if (it.state !== 1) continue;
        const el = now - it.start;
        let left = 0;
        for (let i = 0; i < it.spans.length; i++) {
          const sp = it.spans[i];
          if (!sp || !sp.hasAttribute('data-g')) continue;
          if (el >= (it.at[i] ?? 0)) sp.removeAttribute('data-g');
          else {
            left++;
            if (Math.random() < 0.55) sp.setAttribute('data-g', glyph());
          }
        }
        if (!left) it.state = 2;
      }
      for (let k = 0; k < G; k++) {
        const sp = gSpan[k];
        if (!sp) continue;
        if (now >= (gUntil[k] ?? 0)) {
          sp.removeAttribute('data-g');
          gSpan[k] = null;
        } else sp.setAttribute('data-g', glyph());
      }
      for (const it of items) {
        if (!it.mode || it.state !== 2 || !it.visible || !it.spans.length || it.el.dataset.reel) continue;
        if (!it.nextMelt) {
          it.nextMelt = now + rnd(MELT[it.mode]);
          it.nextFlick = now + rnd(FLICK[it.mode]);
        }
        if (it.meltUntil) {
          if (now >= it.meltUntil) {
            it.meltUntil = 0;
            it.el.classList.remove('sd-melt');
            for (const sp of it.spans) if (!gSpan.includes(sp)) sp.removeAttribute('data-g');
            it.nextMelt = now + rnd(MELT[it.mode]);
          } else {
            for (const sp of it.spans) {
              if (Math.random() < 0.45) sp.setAttribute('data-g', glyph());
              else sp.removeAttribute('data-g');
            }
          }
          continue;
        }
        if (now >= it.nextMelt) {
          it.meltUntil = now + 180 + Math.random() * (it.mode === 'poem' ? 240 : 140);
          it.el.classList.add('sd-melt');
          continue;
        }
        if (now >= it.nextFlick) {
          it.nextFlick = now + rnd(FLICK[it.mode]);
          const burst = 1 + ((Math.random() * (it.mode === 'poem' ? 3 : 1)) | 0);
          for (let b = 0; b < burst; b++) {
            const k = gSpan.indexOf(null);
            const sp = it.spans[(Math.random() * it.spans.length) | 0];
            if (k < 0 || !sp) break;
            gSpan[k] = sp;
            gUntil[k] = now + 90 + Math.random() * 180;
            sp.setAttribute('data-g', glyph());
          }
        }
      }
      if (now >= nextGlitch) {
        nextGlitch = now + 1800 + Math.random() * 3600;
        const pool = items.filter((it) => it.visible && it.state === 2 && it.spans.length && !it.el.dataset.reel);
        const it = pool[(Math.random() * pool.length) | 0];
        if (it) {
          const burst = 1 + ((Math.random() * 4) | 0);
          const base = (Math.random() * it.spans.length) | 0;
          for (let b = 0; b < burst; b++) {
            const k = gSpan.indexOf(null);
            const sp = it.spans[(base + b) % it.spans.length];
            if (k < 0 || !sp) break;
            gSpan[k] = sp;
            gUntil[k] = now + 90 + Math.random() * 220;
            sp.setAttribute('data-g', glyph());
          }
        }
      }
    }
    raf = requestAnimationFrame(tick);
  };

  const sync = (): void => {
    if (!raf && !document.hidden && anyVisible()) raf = requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries) => {
      const now = performance.now();
      for (const e of entries) {
        const it = items.find((x) => x.el === e.target);
        if (!it) continue;
        it.visible = e.isIntersecting;
        if (it.visible && it.state === 0) {
          it.state = 1;
          it.start = now;
        }
      }
      sync();
    },
    { threshold: 0.15 },
  );
  for (const it of items) io.observe(it.el);
  document.addEventListener('visibilitychange', sync);
  const onFailsafe = (e: Event): void => {
    const ms = (e as CustomEvent<number>).detail ?? 1200;
    const now = performance.now();
    for (const it of items) {
      if (!it.mode || it.state !== 2) continue;
      it.meltUntil = now + ms;
      it.el.classList.add('sd-melt');
    }
    sync();
  };
  window.addEventListener('signal:failsafe', onFailsafe);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    io.disconnect();
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('signal:failsafe', onFailsafe);
    for (const it of items) {
      it.el.classList.remove('sd-melt');
      for (const sp of it.spans) sp.replaceWith(document.createTextNode(sp.textContent ?? ''));
      it.el.normalize();
      if (it.label) it.el.removeAttribute('aria-label');
    }
    if (!--styleRefs && styleEl) {
      styleEl.remove();
      styleEl = null;
    }
  };
}
