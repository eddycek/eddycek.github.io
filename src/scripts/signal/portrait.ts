/*
 * Hero portrait as a received video feed. The cutout is redrawn as horizontal
 * bands so it can be displaced like an analog signal:
 *  - acquire: a scan beam sweeps down; above it the picture locks in with
 *    decaying jitter, below it the silhouette is pure static;
 *  - pointer: an interference band follows the cursor, strength = speed;
 *  - glitch bursts every few seconds and on every click into the hero;
 *  - FAILSAFE (window 'signal:failsafe'): the feed dissolves to static, then
 *    re-acquires.
 * Idle frames are skipped, so a locked, untouched portrait costs nothing.
 */
import { createStage, clamp, type Stage } from './common';

const ACQUIRE_T = 1.7;
/** Face box in image-normalised coordinates (forehead to beard). */
const FACE = { x0: 0.2, y0: 0.08, x1: 0.73, y1: 0.64 };

interface Band { y: number; h: number; dx: number }

export function mountPortrait(root: HTMLElement): () => void {
  const img = root.querySelector('img');
  const canvas = root.querySelector('canvas');
  const lockEl = root.querySelector<HTMLElement>('[data-lock]');
  const hero = root.closest<HTMLElement>('.hero');
  if (!img || !(canvas instanceof HTMLCanvasElement)) return () => {};

  // Device-pixel copy of the picture, laid out like object-fit: contain anchored top right.
  const src = document.createElement('canvas');
  const sctx = src.getContext('2d');
  // Static tiles reused for the "no signal" fill.
  const noise: HTMLCanvasElement[] = [];
  let rect = { x: 0, y: 0, w: 0, h: 0 }; // image rect in CSS px
  let ready = false;

  let acquire = 0; // seconds into the acquire sweep, -1 when locked
  let lost = 0; // seconds of static left (FAILSAFE)
  let energy = 0; // pointer interference 0..1
  let py = -1; // pointer y in canvas CSS px
  let lastPy = -1;
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
    let h = s.h;
    let w = h * ar;
    if (w > s.w) { w = s.w; h = w / ar; }
    rect = { x: s.w - w, y: 0, w, h };
    src.width = Math.round(s.w * s.dpr);
    src.height = Math.round(s.h * s.dpr);
    sctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    sctx.clearRect(0, 0, s.w, s.h);
    sctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    // Pin the CAM caption to the drawn picture, not to the figure box.
    const top = canvas.offsetTop;
    root.style.setProperty('--cam-x', `${Math.round(rect.x + rect.w * FACE.x0)}px`);
    root.style.setProperty('--cam-y', `${Math.round(top + rect.y + rect.h * FACE.y0 - 30)}px`);
    ready = true;
    idleDrawn = false;
  };

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
    root.dataset.glitch = '1';
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
  const drawBands = (s: Stage, offset: (y: number) => number, y0 = 0, y1 = s.h): void => {
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
    theme: () => { idleDrawn = false; },
    draw: (s, t, dt) => {
      if (!ready) return;
      const { ctx } = s;
      // Reduced motion or a one-off redraw: a clean, locked frame.
      if (s.reduced) {
        ctx.clearRect(0, 0, s.w, s.h);
        ctx.drawImage(src, 0, 0, s.w, s.h);
        setLock('LOCKED');
        root.classList.add('is-live');
        return;
      }
      if (!seen) return;
      root.classList.add('is-live');

      // Timers run on wall-clock time: the stage caps dt at 50 ms, which would slow the sweep on low-fps devices.
      const real = dt > 0 && prevT > 0 ? Math.min(0.25, t - prevT) : 0;
      prevT = dt > 0 ? t : 0;
      if (acquire >= 0) acquire += real;
      if (lost > 0) {
        lost = Math.max(0, lost - real);
        if (lost === 0) acquire = 0;
      }
      energy = Math.max(0, energy - dt * 1.6);
      if (burst > 0) {
        burst -= real;
        if (burst <= 0) { bands = []; delete root.dataset.glitch; }
      } else if (acquire < 0 && lost === 0) {
        nextBurst -= real;
        if (nextBurst <= 0) { startBurst(0.7); nextBurst = 5 + Math.random() * 6; }
      }

      const acquiring = acquire >= 0 && acquire < ACQUIRE_T;
      if (acquire >= ACQUIRE_T) acquire = -1;
      const locked = acquire < 0 && lost === 0;
      lockShown += ((locked ? 1 : 0) - lockShown) * Math.min(1, dt * 3);
      // Brackets hold for a few seconds after lock, then settle to a faint ghost.
      const busy = acquiring || lost > 0 || burst > 0 || energy > 0.01 || Math.abs(lockShown - (locked ? 1 : 0)) > 0.01;
      if (!busy && idleDrawn && dt > 0) return;

      ctx.clearRect(0, 0, s.w, s.h);

      if (lost > 0) {
        // Dissolve: rows tear apart, then everything is static.
        const k = clamp(1 - lost / 2.4, 0, 1);
        drawBands(s, (y) => Math.sin(y * 0.09 + t * 40) * 40 * (1 - k) + (Math.random() - 0.5) * 30);
        fillStatic(s, t, 0.55 + 0.45 * Math.min(1, k * 3), 0, s.h);
        setLock('NO SIGNAL');
        idleDrawn = false;
        return;
      }

      const interference = (y: number): number => {
        let dx = 0;
        if (energy > 0 && py >= 0) {
          const d = (y - py) / 46;
          dx += energy * 26 * Math.exp(-d * d) * Math.sin(y * 0.21 + t * 34);
        }
        for (const b of bands) if (y >= b.y && y < b.y + b.h) dx += b.dx;
        return dx;
      };

      if (acquiring) {
        const k = acquire / ACQUIRE_T; // 0 → 1
        const beam = rect.y + rect.h * Math.min(1, k * 1.15);
        const jitter = (1 - k) * (1 - k);
        drawBands(s, (y) => interference(y) + (Math.random() - 0.5) * 70 * jitter + Math.sin(y * 0.05 + t * 20) * 18 * jitter, 0, beam);
        // Below the beam: faint silhouette made of static.
        ctx.save();
        ctx.globalAlpha = 0.35;
        drawBands(s, (y) => (Math.random() - 0.5) * 12, beam, s.h);
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

      drawBands(s, interference);
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
    stage.kick();
  };
  if (img.complete && img.naturalWidth) begin();
  else img.addEventListener('load', begin, { once: true });

  // Start the acquire sweep the first time the portrait is actually on screen.
  const io = new IntersectionObserver((entries) => {
    if (seen || !entries.some((e) => e.isIntersecting)) return;
    seen = true;
    acquire = 0;
    stage.kick();
    io.disconnect();
  }, { threshold: 0.35 });
  io.observe(root);

  const onMove = (e: PointerEvent): void => {
    const r = canvas.getBoundingClientRect();
    py = e.clientY - r.top;
    if (lastPy >= 0) energy = clamp(energy + Math.abs(py - lastPy) / 120, 0, 1);
    lastPy = py;
    if (energy > 0.02) stage.kick();
  };
  const onLeave = (): void => { lastPy = -1; };
  const onHit = (e: MouseEvent): void => {
    const r = canvas.getBoundingClientRect();
    py = e.clientY - r.top;
    energy = 1;
    if (lost === 0 && acquire < 0) startBurst(1.4);
    stage.kick();
  };
  const onFail = (): void => {
    lost = 2.4;
    acquire = -1;
    bands = [];
    stage.kick();
  };
  hero?.addEventListener('pointermove', onMove, { passive: true });
  hero?.addEventListener('pointerleave', onLeave, { passive: true });
  hero?.addEventListener('click', onHit, { passive: true });
  window.addEventListener('signal:failsafe', onFail);

  return () => {
    stage.dispose();
    io.disconnect();
    hero?.removeEventListener('pointermove', onMove);
    hero?.removeEventListener('pointerleave', onLeave);
    hero?.removeEventListener('click', onHit);
    window.removeEventListener('signal:failsafe', onFail);
  };
}
