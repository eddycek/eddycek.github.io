/*
 * Career "flight log". x = years, y = level; a smooth, slightly noisy trace
 * through the given points is drawn progressively as the canvas scrolls
 * through the viewport, led by a glowing cursor head with a crosshair readout.
 * Markers light up (milestones flash) when the head passes them. The future
 * route is a faint dashed ghost; once drawn the line keeps breathing.
 */
import { clamp, createStage, mono, type Stage } from './common';

export interface TracePoint {
  year: number;
  level: number;
  label: string;
  milestone?: boolean;
}

const S = 480; // samples along the path

export function mountTrace(canvas: HTMLCanvasElement, points: TracePoint[]): () => void {
  const pts = points.slice().sort((a, b) => a.year - b.year);
  if (pts.length < 2) return () => {};
  const base = new Float32Array(S);
  const grain = new Float32Array(S);
  const px = new Float32Array(S);
  const py = new Float32Array(S);
  const mIdx = new Float32Array(pts.length);
  const reachedAt = new Float64Array(pts.length).fill(-1);
  const labelUp = new Uint8Array(pts.length);
  const labelShow = new Uint8Array(pts.length);

  const y0 = pts[0]?.year ?? 0;
  const y1 = Math.max(y0 + 1, pts[pts.length - 1]?.year ?? 1);
  let lMin = Infinity, lMax = -Infinity;
  for (const p of pts) {
    lMin = Math.min(lMin, p.level);
    lMax = Math.max(lMax, p.level);
  }
  if (lMax - lMin < 1e-6) lMax = lMin + 1;

  // Smootherstep between consecutive levels: plateaus with smooth climbs.
  let seg = 0;
  for (let i = 0; i < S; i++) {
    const yr = y0 + (i / (S - 1)) * (y1 - y0);
    while (seg < pts.length - 2 && yr > (pts[seg + 1]?.year ?? 0)) seg++;
    const a = pts[seg], b = pts[seg + 1];
    if (!a || !b) continue;
    const f = clamp((yr - a.year) / Math.max(1e-6, b.year - a.year), 0, 1);
    const e = f * f * f * (f * (f * 6 - 15) + 10);
    base[i] = (a.level + (b.level - a.level) * e - lMin) / (lMax - lMin);
    grain[i] = 0.012 * Math.sin(i * 0.9 + 2) + 0.007 * Math.sin(i * 2.7 + 1.3) + (Math.random() - 0.5) * 0.008;
  }
  pts.forEach((p, k) => {
    mIdx[k] = ((p.year - y0) / (y1 - y0)) * (S - 1);
  });

  let prog = 0;
  let L = 0, T = 0, PW = 0, PH = 0;

  const layout = (s: Stage): void => {
    L = 18;
    T = 34;
    PW = s.w - 36;
    PH = s.h - 34 - 40;
    for (let i = 0; i < S; i++) {
      px[i] = L + (i / (S - 1)) * PW;
      py[i] = T + (1 - (base[i] ?? 0)) * PH;
    }
    // Label placement: alternate above/below, drop labels that would collide.
    mono(s, 11);
    const lastEnd = [-Infinity, -Infinity];
    pts.forEach((p, k) => {
      const x = L + ((mIdx[k] ?? 0) / (S - 1)) * PW;
      const tw = s.ctx.measureText(p.label).width;
      let side = k % 2;
      const lx = clamp(x - tw / 2, 2, s.w - tw - 2);
      if (lx < (lastEnd[side] ?? 0) + 8) side ^= 1;
      const ok = lx >= (lastEnd[side] ?? 0) + 8 || !!p.milestone;
      labelUp[k] = side;
      labelShow[k] = ok ? 1 : 0;
      if (ok) lastEnd[side] = lx + tw;
    });
  };

  const draw = (s: Stage, t: number, dt: number): void => {
    const { ctx, w, h, pal } = s;
    if (s.reduced) prog = 1;
    else {
      const r = s.view();
      const vh = window.innerHeight;
      const target = clamp((vh * 0.9 - r.top) / (r.height * 0.9 + vh * 0.1), 0, 1);
      prog += (target - prog) * (dt > 0 ? 1 - Math.exp(-dt * 5) : 1);
    }
    const head = prog * (S - 1);
    const hi = Math.floor(head);
    const jit = s.reduced ? 0 : prog > 0.995 ? 1.6 : 0.9;
    ctx.clearRect(0, 0, w, h);

    // Grid + year axis.
    ctx.strokeStyle = pal.grid.css;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) {
      const y = Math.round(T + (PH * k) / 4) + 0.5;
      ctx.moveTo(L, y);
      ctx.lineTo(L + PW, y);
    }
    const years = y1 - y0;
    const pxPerYear = PW / years;
    const every = Math.max(1, Math.ceil(44 / pxPerYear));
    for (let yr = Math.ceil(y0); yr <= y1; yr++) {
      const x = Math.round(L + ((yr - y0) / years) * PW) + 0.5;
      ctx.moveTo(x, T + PH);
      ctx.lineTo(x, T + PH + ((yr - Math.ceil(y0)) % every === 0 ? 8 : 4));
    }
    ctx.stroke();
    mono(s, 10);
    ctx.fillStyle = pal.ink.css;
    ctx.globalAlpha = 0.45;
    ctx.textAlign = 'center';
    for (let yr = Math.ceil(y0); yr <= y1; yr += every) ctx.fillText(String(yr), L + ((yr - y0) / years) * PW, T + PH + 20);
    ctx.globalAlpha = 1;

    // Ghost route.
    ctx.strokeStyle = pal.noise.css;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    for (let i = hi; i < S; i += 2) {
      const Y = py[i] ?? 0;
      if (i === hi) ctx.moveTo(px[i] ?? 0, Y);
      else ctx.lineTo(px[i] ?? 0, Y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Drawn trace (glow pass + core).
    const yAt = (i: number): number =>
      (py[i] ?? 0) + ((grain[i] ?? 0) * PH * 0.6) + jit * Math.sin(i * 0.21 + t * 3.1) * Math.sin(i * 0.047 - t * 0.9);
    if (hi > 0) {
      for (let p = 0; p < 2; p++) {
        ctx.strokeStyle = pal.signal.css;
        ctx.globalAlpha = p === 0 ? 0.16 : 1;
        ctx.lineWidth = p === 0 ? 8 : 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(px[0] ?? 0, yAt(0));
        for (let i = 1; i <= hi; i++) ctx.lineTo(px[i] ?? 0, yAt(i));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Markers + labels.
    mono(s, 11);
    ctx.textAlign = 'left';
    pts.forEach((p, k) => {
      const mi = mIdx[k] ?? 0;
      const i = Math.round(mi);
      const x = px[i] ?? 0;
      const y = yAt(i);
      const on = head >= mi - 0.5;
      if (on && (reachedAt[k] ?? -1) < 0) reachedAt[k] = t;
      if (!on) reachedAt[k] = -1;
      const r = p.milestone ? 5 : 3;
      ctx.globalAlpha = on ? 1 : 0.5;
      ctx.fillStyle = on ? pal.signal.css : pal.bg.css;
      ctx.strokeStyle = on ? pal.signal.css : pal.noise.css;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (p.milestone) {
        ctx.moveTo(x, y - r - 1);
        ctx.lineTo(x + r + 1, y);
        ctx.lineTo(x, y + r + 1);
        ctx.lineTo(x - r - 1, y);
        ctx.closePath();
      } else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const age = t - (reachedAt[k] ?? t);
      if (on && p.milestone && !s.reduced && age < 0.9) {
        ctx.globalAlpha = 1 - age / 0.9;
        ctx.beginPath();
        ctx.arc(x, y, 6 + age * 30, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (labelShow[k]) {
        const tw = ctx.measureText(p.label).width;
        const lx = clamp(x - tw / 2, 2, w - tw - 2);
        const ly = labelUp[k] ? Math.max(12, y - 14) : Math.min(T + PH - 4, y + 22);
        ctx.globalAlpha = on ? 0.95 : 0.3;
        ctx.fillStyle = on && p.milestone ? pal.signal.css : pal.ink.css;
        ctx.fillText(p.label, lx, ly);
      }
    });

    // Cursor head.
    if (prog > 0.002) {
      const f = head - hi;
      const hx = (px[hi] ?? 0) + ((px[Math.min(S - 1, hi + 1)] ?? 0) - (px[hi] ?? 0)) * f;
      const hy = yAt(hi) + (yAt(Math.min(S - 1, hi + 1)) - yAt(hi)) * f;
      ctx.strokeStyle = pal.ink.css;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, T);
      ctx.lineTo(hx, T + PH);
      ctx.moveTo(L, hy);
      ctx.lineTo(L + PW, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.signal.css;
      const pulse = s.reduced ? 0 : Math.sin(t * 5) * 2;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(hx, hy, 14 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      const yr = y0 + prog * (y1 - y0);
      const lvl = lMin + (base[hi] ?? 0) * (lMax - lMin);
      mono(s, 10, 600);
      const txt = `T ${yr.toFixed(1)}  ALT ${lvl.toFixed(1)}`;
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = pal.ink.css;
      ctx.globalAlpha = 0.85;
      ctx.fillText(txt, hx + tw + 14 > w ? hx - tw - 10 : hx + 10, Math.max(12, T - 12));
    }
    ctx.globalAlpha = 1;
  };

  const stage = createStage(canvas, { draw, resize: layout, theme: (s) => s.w > 0 && layout(s) });
  return stage ? () => stage.dispose() : () => {};
}
