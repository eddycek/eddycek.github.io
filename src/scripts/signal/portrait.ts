/*
 * Hero portrait as a received video feed. The cutout is redrawn as horizontal
 * bands so it can be displaced like an analog signal:
 *  - acquire: a scan beam sweeps down; above it the picture locks in with
 *    decaying jitter, below it the silhouette is pure static;
 *  - glitch bursts every few seconds and on every click into the hero;
 *  - FAILSAFE (window 'signal:failsafe'): the feed dissolves to static, then
 *    re-acquires.
 * Idle frames are skipped, so a locked, untouched portrait costs nothing.
 *
 * The RGB split and the orange halo are baked into three pre-rendered copies
 * of the picture (busy / locked / glitch) instead of CSS drop-shadow filters
 * on the canvas: a filter re-blurs the whole canvas on every changed frame,
 * which is what made phones stutter while the feed was moving.
 */
import { createStage, clamp, type Stage } from './common';

const ACQUIRE_T = 1.7;
/** Wait for the hero name to finish decoding before the sweep starts, so the two don't fight for frames. */
const ACQUIRE_DELAY = 600;
/** Face box in image-normalised coordinates (forehead to beard). */
const FACE = { x0: 0.2, y0: 0.08, x1: 0.73, y1: 0.64 };

interface Band { y: number; h: number; dx: number }

export function mountPortrait(root: HTMLElement): () => void {
  const img = root.querySelector('img');
  const canvas = root.querySelector('canvas');
  const lockEl = root.querySelector<HTMLElement>('[data-lock]');
  const hero = root.closest<HTMLElement>('.hero');
  if (!img || !(canvas instanceof HTMLCanvasElement)) return () => {};

  // Device-pixel copies of the picture, laid out like object-fit: contain anchored top right.
  const base = document.createElement('canvas'); // the bare picture (scratch, used to build the others)
  const tint = document.createElement('canvas'); // scratch: silhouette in one colour
  const vBusy = document.createElement('canvas'); // split, no halo (acquire, NO SIGNAL)
  const vLock = document.createElement('canvas'); // split + halo (locked)
  const vGlitch = document.createElement('canvas'); // wide split + halo (glitch burst)
  const sctx = base.getContext('2d');
  // Static tiles reused for the "no signal" fill.
  const noise: HTMLCanvasElement[] = [];
  let rect = { x: 0, y: 0, w: 0, h: 0 }; // image rect in CSS px
  let ready = false;

  let acquire = 0; // seconds into the acquire sweep, -1 when locked
  let lost = 0; // seconds of static left (FAILSAFE)
  let bands: Band[] = [];
  let burst = 0; // seconds left in a glitch burst
  let nextBurst = 4 + Math.random() * 4;
  let lockShown = 0; // face bracket intensity
  let idleDrawn = false;
  let seen = false;
  let prevT = 0;

  const makeNoise = (): void => {
    noise.length = 0;
    for (let k = 0; k < 4; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const x = c.getContext('2d');
      if (!x) continue;
      const d = x.createImageData(96, 96);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = Math.random() * 255;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      noise.push(c);
    }
  };

  const layout = (s: Stage): void => {
    if (!sctx || !img.naturalWidth || s.w === 0) return;
    const ar = img.naturalWidth / img.naturalHeight;
    // 4% headroom on top so the baked halo around the head isn't cut by the canvas edge.
    const pad = Math.round(s.h * 0.04);
    let h = s.h - pad;
    let w = h * ar;
    if (w > s.w) { w = s.w; h = w / ar; }
    rect = { x: s.w - w, y: pad, w, h };
    base.width = Math.round(s.w * s.dpr);
    base.height = Math.round(s.h * s.dpr);
    sctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    sctx.clearRect(0, 0, s.w, s.h);
    sctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    bake(s);
    // Pin the CAM caption to the drawn picture, not to the figure box.
    const top = canvas.offsetTop;
    root.style.setProperty('--cam-x', `${Math.round(rect.x + rect.w * FACE.x0)}px`);
    root.style.setProperty('--cam-y', `${Math.round(top + rect.y + rect.h * FACE.y0 - 30)}px`);
    ready = true;
    idleDrawn = false;
  };

  /** Same look the CSS filters used to give: cyan copy left, orange copy right, orange halo under it all. */
  const bake = (s: Stage): void => {
    const W = base.width;
    const H = base.height;
    const light = document.documentElement.dataset.theme === 'light';
    const glow = `rgba(${s.pal.signal.r},${s.pal.signal.g},${s.pal.signal.b},`;
    const tinted = (color: string): HTMLCanvasElement => {
      tint.width = W;
      tint.height = H;
      const t = tint.getContext('2d');
      if (t) {
        t.drawImage(base, 0, 0);
        t.globalCompositeOperation = 'source-in';
        t.fillStyle = color;
        t.fillRect(0, 0, W, H);
      }
      return tint;
    };
    const build = (out: HTMLCanvasElement, split: number, alpha: number, halo: boolean): void => {
      out.width = W;
      out.height = H;
      const o = out.getContext('2d');
      if (!o) return;
      const d = Math.round(split * s.dpr);
      if (halo && !light) {
        // drop-shadow(0 0 22px glow@60%): canvas blur is in device px, sigma = blur / 2 like CSS.
        o.shadowColor = `${glow}${(0.35 * 0.6).toFixed(3)})`;
        o.shadowBlur = 22 * s.dpr;
        o.drawImage(base, 0, 0);
        o.shadowColor = 'transparent';
        o.shadowBlur = 0;
      }
      const tr = s.pal.trace;
      const sg = s.pal.signal;
      o.drawImage(tinted(`rgba(${sg.r},${sg.g},${sg.b},${alpha})`), d, 0);
      o.drawImage(tinted(`rgba(${tr.r},${tr.g},${tr.b},${alpha})`), -d, 0);
      o.drawImage(base, 0, 0);
    };
    const split = light ? 1 : 2;
    // The sweep only needs the halo-less copy; the other two are built when the main thread is idle,
    // well before the picture locks (ACQUIRE_DELAY + ACQUIRE_T), so they never land on an intro frame.
    build(vBusy, split, 0.45, false);
    baked = false;
    const gen = ++bakeGen;
    const rest = (): void => {
      if (gen !== bakeGen) return;
      build(vLock, split, 0.45, true);
      build(vGlitch, light ? 1 : 8, 0.8, true);
      tint.width = tint.height = 0;
      baked = true;
      idleDrawn = false;
      stage?.kick();
    };
    // Safari has no requestIdleCallback.
    const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(rest, { timeout: 1200 });
    else setTimeout(rest, 200);
  };
  let baked = false;
  let bakeGen = 0;

  const setLock = (text: string): void => {
    if (lockEl && lockEl.textContent !== text) lockEl.textContent = text;
    const state = text === 'SIGNAL LOCKED' || text === 'LOCKED' ? 'locked' : 'busy';
    if (root.dataset.state !== state) root.dataset.state = state;
  };

  const startBurst = (power = 1): void => {
    bands = [];
    const n = 2 + Math.floor(Math.random() * 4 * power);
    for (let i = 0; i < n; i++) {
      bands.push({
        y: rect.y + Math.random() * rect.h,
        h: 3 + Math.random() * 28 * power,
        dx: (Math.random() - 0.5) * 60 * power,
      });
    }
    burst = 0.12 + Math.random() * 0.12 * power;
  };

  const fillStatic = (s: Stage, t: number, alpha: number, y0: number, y1: number): void => {
    const tile = noise[Math.floor(t * 30) % noise.length];
    if (!tile || y1 <= y0) return;
    const { ctx } = s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, s.w, y1 - y0);
    ctx.clip();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = alpha;
    const pat = ctx.createPattern(tile, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.translate((t * 977) % 96, (t * 613) % 96);
      ctx.fillRect(-96, y0 - 96, s.w + 192, y1 - y0 + 192);
    }
    ctx.restore();
  };

  /** Bands of the picture, each shifted by offset(y). */
  const drawBands = (s: Stage, src: HTMLCanvasElement, offset: (y: number) => number, y0 = 0, y1 = s.h): void => {
    const { ctx, dpr } = s;
    const step = 3;
    for (let y = Math.max(0, Math.floor(y0)); y < y1; y += step) {
      const hh = Math.min(step, y1 - y);
      const dx = offset(y);
      ctx.drawImage(src, 0, y * dpr, src.width, hh * dpr, dx, y, s.w, hh);
    }
  };

  const drawFaceLock = (s: Stage, k: number, t: number): void => {
    if (k <= 0.01) return;
    const { ctx } = s;
    const x0 = rect.x + FACE.x0 * rect.w;
    const y0 = rect.y + FACE.y0 * rect.h;
    const x1 = rect.x + FACE.x1 * rect.w;
    const y1 = rect.y + FACE.y1 * rect.h;
    const L = Math.min(x1 - x0, y1 - y0) * 0.12;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = k * 0.9;
    ctx.strokeStyle = s.pal.trace.css;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Narrow cover layout: the name and status line sit over the beard, so only the top pair is drawn.
    const corners = [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const;
    for (const [cx, cy, sx, sy] of matchMedia('(max-width: 900px)').matches ? corners.slice(0, 2) : corners) {
      ctx.moveTo(cx, cy + sy * L);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * L, cy);
    }
    ctx.stroke();
    ctx.restore();
  };

  const stage = createStage(canvas, {
    resize: (s) => layout(s),
    theme: (s) => {
      if (ready) bake(s);
      idleDrawn = false;
    },
    draw: (s, t, dt) => {
      if (!ready) return;
      const { ctx } = s;
      // Reduced motion or a one-off redraw: a clean, locked frame.
      if (s.reduced) {
        ctx.clearRect(0, 0, s.w, s.h);
        ctx.drawImage(baked ? vLock : vBusy, 0, 0, s.w, s.h);
        setLock('LOCKED');
        root.classList.add('is-live');
        return;
      }
      if (!seen) return;

      // Timers run on wall-clock time: the stage caps dt at 50 ms, which would slow the sweep on low-fps devices.
      const real = dt > 0 && prevT > 0 ? Math.min(0.25, t - prevT) : 0;
      prevT = dt > 0 ? t : 0;
      if (acquire >= 0) acquire += real;
      if (lost > 0) {
        lost = Math.max(0, lost - real);
        if (lost === 0) acquire = 0;
      }
      if (burst > 0) {
        burst -= real;
        if (burst <= 0) bands = [];
      } else if (acquire < 0 && lost === 0) {
        nextBurst -= real;
        if (nextBurst <= 0) { startBurst(0.7); nextBurst = 5 + Math.random() * 6; }
      }

      const acquiring = acquire >= 0 && acquire < ACQUIRE_T;
      if (acquire >= ACQUIRE_T) acquire = -1;
      const locked = acquire < 0 && lost === 0;
      lockShown += ((locked ? 1 : 0) - lockShown) * Math.min(1, dt * 3);
      // Brackets hold for a few seconds after lock, then settle to a faint ghost.
      const busy = acquiring || lost > 0 || burst > 0 || Math.abs(lockShown - (locked ? 1 : 0)) > 0.01;
      if (!busy && idleDrawn && dt > 0) return;

      ctx.clearRect(0, 0, s.w, s.h);

      if (lost > 0) {
        // Dissolve: rows tear apart, then everything is static.
        const k = clamp(1 - lost / 2.4, 0, 1);
        drawBands(s, vBusy, (y) => Math.sin(y * 0.09 + t * 40) * 40 * (1 - k) + (Math.random() - 0.5) * 30);
        fillStatic(s, t, 0.55 + 0.45 * Math.min(1, k * 3), 0, s.h);
        setLock('NO SIGNAL');
        idleDrawn = false;
        return;
      }

      const interference = (y: number): number => {
        let dx = 0;
        for (const b of bands) if (y >= b.y && y < b.y + b.h) dx += b.dx;
        return dx;
      };

      if (acquiring) {
        const k = acquire / ACQUIRE_T; // 0 → 1
        const beam = rect.y + rect.h * Math.min(1, k * 1.15);
        const jitter = (1 - k) * (1 - k);
        drawBands(s, vBusy, (y) => interference(y) + (Math.random() - 0.5) * 70 * jitter + Math.sin(y * 0.05 + t * 20) * 18 * jitter, 0, beam);
        // Below the beam: faint silhouette made of static.
        ctx.save();
        ctx.globalAlpha = 0.35;
        drawBands(s, vBusy, (y) => (Math.random() - 0.5) * 12, beam, s.h);
        ctx.restore();
        fillStatic(s, t, 1, beam, s.h);
        fillStatic(s, t, 0.4 * jitter, 0, beam);
        // The beam itself.
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        const g = ctx.createLinearGradient(0, beam - 18, 0, beam + 2);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, s.pal.signal.css);
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(0, beam - 18, s.w, 20);
        ctx.restore();
        setLock(`LOCKING ${String(Math.round(k * 100)).padStart(2, '0')}%`);
        idleDrawn = false;
        return;
      }

      const pic = baked ? (burst > 0 ? vGlitch : vLock) : vBusy;
      if (bands.length) drawBands(s, pic, interference);
      else ctx.drawImage(pic, 0, 0, s.w, s.h); // nothing displaced: one blit instead of ~150 bands
      if (burst > 0) fillStatic(s, t, 0.12, 0, s.h);
      drawFaceLock(s, lockShown * (burst > 0 ? 0.4 : 1), t);
      setLock('SIGNAL LOCKED');
      idleDrawn = !busy;
    },
  });
  if (!stage) return () => {};

  const begin = (): void => {
    makeNoise();
    layout(stage.s);
    // The canvas takes over from the <img> right away (blank until the sweep: no signal yet).
    if (!stage.s.reduced) root.classList.add('is-live');
    stage.kick();
  };
  if (img.complete && img.naturalWidth) begin();
  else img.addEventListener('load', begin, { once: true });

  // Start the acquire sweep the first time the portrait is actually on screen.
  const io = new IntersectionObserver((entries) => {
    if (seen || !entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    window.setTimeout(() => {
      seen = true;
      acquire = 0;
      stage.kick();
    }, ACQUIRE_DELAY);
  }, { threshold: 0.35 });
  io.observe(root);

  const onHit = (): void => {
    if (lost === 0 && acquire < 0) startBurst(1.4);
    stage.kick();
  };
  const onFail = (): void => {
    lost = 2.4;
    acquire = -1;
    bands = [];
    stage.kick();
  };
  hero?.addEventListener('click', onHit, { passive: true });
  window.addEventListener('signal:failsafe', onFail);

  return () => {
    stage.dispose();
    io.disconnect();
    hero?.removeEventListener('click', onHit);
    window.removeEventListener('signal:failsafe', onFail);
  };
}
