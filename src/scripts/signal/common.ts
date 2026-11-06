/*
 * Shared plumbing for the "Signál a šum" canvases: palette resolved from CSS
 * custom properties, DPR-aware sizing (capped at 2), and a RAF loop that pauses
 * off-screen / in hidden tabs, redraws on theme change and renders a single
 * static frame under prefers-reduced-motion. Draws nothing by itself.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
  css: string;
}

export interface Palette {
  signal: Rgb;
  trace: Rgb;
  noise: Rgb;
  grid: Rgb;
  ink: Rgb;
  bg: Rgb;
  mono: string;
}

const TOKENS: ReadonlyArray<readonly [keyof Omit<Palette, 'mono'>, string, string]> = [
  ['signal', '--c-signal', '#FF7A2F'],
  ['trace', '--c-trace', '#5CC8D6'],
  ['noise', '--c-noise', '#3A4350'],
  ['grid', '--c-grid', '#1C232C'],
  ['ink', '--c-ink', '#E8EBEE'],
  ['bg', '--c-bg', '#0B0E12'],
];

let px: CanvasRenderingContext2D | null = null;

/** Normalise any CSS color (oklch, color-mix, light-dark…) to sRGB by painting one pixel. */
function toRgb(color: string): Rgb {
  if (!px) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    px = c.getContext('2d', { willReadFrequently: true });
  }
  if (!px) return { r: 0, g: 0, b: 0, css: color };
  px.clearRect(0, 0, 1, 1);
  px.fillStyle = '#000';
  px.fillStyle = color;
  px.fillRect(0, 0, 1, 1);
  const d = px.getImageData(0, 0, 1, 1).data;
  const r = d[0] ?? 0;
  const g = d[1] ?? 0;
  const b = d[2] ?? 0;
  const a = (d[3] ?? 255) / 255;
  return { r, g, b, css: a < 1 ? `rgba(${r},${g},${b},${a.toFixed(3)})` : `rgb(${r},${g},${b})` };
}

export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const host = el.parentElement ?? document.body;
  const probe = document.createElement('span');
  probe.style.display = 'none';
  host.appendChild(probe);
  const out: Partial<Palette> = {};
  for (const [key, name, fb] of TOKENS) {
    const raw = cs.getPropertyValue(name).trim();
    probe.style.color = fb;
    if (raw) probe.style.color = raw;
    out[key] = toRgb(getComputedStyle(probe).color);
  }
  probe.remove();
  out.mono = cs.getPropertyValue('--f-mono').trim() || 'ui-monospace, SFMono-Regular, Menlo, monospace';
  return out as Palette;
}

export const prefersReduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Calls cb on OS color-scheme change and on <html data-theme> change. */
export function watchTheme(cb: () => void): () => void {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    mq.removeEventListener('change', cb);
    mo.disconnect();
  };
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export interface Stage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** CSS pixel size; the context is pre-scaled by dpr. */
  w: number;
  h: number;
  dpr: number;
  pal: Palette;
  reduced: boolean;
}

export interface StageHooks {
  resize?(s: Stage): void;
  theme?(s: Stage): void;
  /** t in seconds; dt = 0 for one-off redraws (resize, theme, reduced motion). */
  draw(s: Stage, t: number, dt: number): void;
}

export interface StageHandle {
  s: Stage;
  /** Request a redraw (one frame in reduced/paused mode). */
  kick(): void;
  dispose(): void;
}

export function createStage(canvas: HTMLCanvasElement, hooks: StageHooks): StageHandle | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const s: Stage = { canvas, ctx, w: 0, h: 0, dpr: 1, pal: readPalette(canvas), reduced: prefersReduced() };
  let raf = 0;
  let oneOff = 0;
  let last = 0;
  let inView = false;
  let dead = false;

  const live = (): boolean => !dead && !s.reduced && inView && !document.hidden && s.w > 0;

  const frame = (now: number): void => {
    raf = 0;
    if (!live()) return;
    const t = now / 1000;
    const dt = last ? Math.min(0.05, t - last) : 0;
    last = t;
    hooks.draw(s, t, dt);
    raf = requestAnimationFrame(frame);
  };

  const sync = (): void => {
    if (live()) {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const redraw = (): void => {
    if (dead || s.w === 0) return;
    hooks.draw(s, performance.now() / 1000, 0);
  };

  const kick = (): void => {
    if (live()) return sync();
    if (oneOff) return;
    oneOff = requestAnimationFrame(() => {
      oneOff = 0;
      redraw();
    });
  };

  const ro = new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    s.w = r.width;
    s.h = r.height;
    s.dpr = dpr;
    const bw = Math.max(1, Math.round(r.width * dpr));
    const bh = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hooks.resize?.(s);
    redraw();
    sync();
  });
  ro.observe(canvas);

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) inView = e.isIntersecting;
    sync();
  });
  io.observe(canvas);

  const onVis = (): void => sync();
  document.addEventListener('visibilitychange', onVis);

  const unTheme = watchTheme(() => {
    s.pal = readPalette(canvas);
    hooks.theme?.(s);
    redraw();
  });
  hooks.theme?.(s);

  void document.fonts?.ready.then(() => {
    if (dead || s.w === 0) return;
    hooks.resize?.(s);
    if (!live()) redraw();
  });

  return {
    s,
    kick,
    dispose(): void {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      if (oneOff) cancelAnimationFrame(oneOff);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      unTheme();
    },
  };
}

/** Set ctx.font to the mono stack at a given CSS px size. */
export function mono(s: Stage, size: number, weight = 500): void {
  s.ctx.font = `${weight} ${size}px ${s.pal.mono}`;
}

export const pad = (n: number, len: number): string => {
  const v = String(Math.abs(Math.round(n)));
  return (n < 0 ? '-' : '') + (v.length >= len ? v : '0'.repeat(len - v.length) + v);
};
