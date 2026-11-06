/*
 * FPVPIDlab spectrogram. A synthetic gyro signal (motor fundamental + harmonics
 * sweeping with simulated throttle, a frame resonance, broadband noise) is run
 * through a real 256-point radix-2 FFT (Hann window). Top panel: live spectrum
 * (raw orange, notch-filtered cyan) with a tracking notch marker. Below: a
 * scrolling waterfall with a heat colormap built from the accent tokens, and
 * the notch centre trail. Hover shows a frequency / dB readout.
 */
import { clamp, createStage, mono, type Palette, type Stage } from './common';

const N = 256;
const BINS = N / 2;
const FS = 2000; // Hz
const NYQ = FS / 2;
const HOP = 40; // samples per waterfall row -> 50 rows/s
const ROW_DT = HOP / FS;
const ROWS = 160;
const DB_FLOOR = -66;

export function mountSpectrum(canvas: HTMLCanvasElement): () => void {
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const ring = new Float32Array(N);
  const win = new Float32Array(N);
  const cosT = new Float32Array(N / 2);
  const sinT = new Float32Array(N / 2);
  const rev = new Uint16Array(N);
  const level = new Float32Array(BINS); // 0..1 raw
  const live = new Float32Array(BINS); // smoothed for the line
  const notchHist = new Float32Array(ROWS);
  const lut = new Uint8ClampedArray(256 * 3);
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  for (let k = 0; k < N / 2; k++) {
    cosT[k] = Math.cos((2 * Math.PI * k) / N);
    sinT[k] = Math.sin((2 * Math.PI * k) / N);
  }

  const off = document.createElement('canvas');
  off.width = BINS;
  off.height = ROWS;
  const octx = off.getContext('2d');
  const img = octx ? octx.createImageData(BINS, ROWS) : null;

  // Signal state.
  let tau = 0, ph = 0, ringPos = 0, f0 = 200, notch = 200, thr = 0.4, punch = 0, punchT = 0, nextPunch = 2;
  let bq1 = 0, bq2 = 0, rowAcc = 0, hoverX = -1;
  // Frame resonance: 2-pole band-pass around 165 Hz.
  const FR = 165, Q = 9;
  const w0 = (2 * Math.PI * FR) / FS;
  const alpha = Math.sin(w0) / (2 * Q);
  const a0 = 1 + alpha;
  const B0 = alpha / a0, A1 = (-2 * Math.cos(w0)) / a0, A2 = (1 - alpha) / a0;

  const fft = (): void => {
    for (let i = 0; i < N; i++) {
      const j = rev[i] ?? 0;
      if (j > i) {
        const tr = re[i] ?? 0;
        re[i] = re[j] ?? 0;
        re[j] = tr;
        const ti = im[i] ?? 0;
        im[i] = im[j] ?? 0;
        im[j] = ti;
      }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1;
      const step = N / size;
      for (let i = 0; i < N; i += size) {
        for (let k = 0; k < half; k++) {
          const c = cosT[k * step] ?? 1;
          const s = sinT[k * step] ?? 0;
          const a = i + k;
          const b = a + half;
          const rb = re[b] ?? 0, ib = im[b] ?? 0;
          const tr = rb * c + ib * s;
          const ti = ib * c - rb * s;
          const ra = re[a] ?? 0, ia = im[a] ?? 0;
          re[b] = ra - tr;
          im[b] = ia - ti;
          re[a] = ra + tr;
          im[a] = ia + ti;
        }
      }
    }
  };

  const row = (): void => {
    // Throttle: slow wander + occasional punch-outs.
    nextPunch -= ROW_DT;
    if (nextPunch <= 0) {
      punchT = 0.35 + Math.random() * 0.25;
      nextPunch = 2.5 + Math.random() * 4;
    }
    punchT *= Math.exp(-ROW_DT * 1.6);
    punch += (punchT - punch) * (1 - Math.exp(-ROW_DT * 9));
    thr = clamp(0.32 + 0.16 * Math.sin(tau * 0.7) + 0.08 * Math.sin(tau * 2.3 + 1) + punch, 0.05, 1);
    f0 = 70 + thr * 300;
    const inc = (2 * Math.PI * f0) / FS;
    for (let k = 0; k < HOP; k++) {
      tau += 1 / FS;
      ph += inc;
      if (ph > 2 * Math.PI * 64) ph -= 2 * Math.PI * 64;
      const wn = Math.random() * 2 - 1;
      const bp = B0 * wn - A1 * bq1 - A2 * bq2;
      bq2 = bq1;
      bq1 = bp;
      const sample =
        0.5 * Math.sin(ph) +
        0.2 * Math.sin(2 * ph + 0.4) +
        0.07 * Math.sin(3 * ph + 1.1) +
        bp * (1.2 + thr * 2.2) +
        wn * (0.012 + thr * 0.02) +
        0.4 * Math.sin(tau * 2 * Math.PI * 3);
      ring[ringPos] = sample;
      ringPos = (ringPos + 1) % N;
    }
    for (let i = 0; i < N; i++) {
      re[i] = (ring[(ringPos + i) % N] ?? 0) * (win[i] ?? 0);
      im[i] = 0;
    }
    fft();
    notch += (f0 - notch) * 0.22; // dynamic notch tracks with lag
    for (let k = 0; k < BINS; k++) {
      const r = re[k] ?? 0, i = im[k] ?? 0;
      const mag = (Math.sqrt(r * r + i * i) * 4) / N;
      const db = 20 * Math.log10(mag + 1e-6);
      const lv = clamp((db - DB_FLOOR) / -DB_FLOOR, 0, 1);
      level[k] = lv;
      const l = live[k] ?? 0;
      live[k] = lv > l ? lv : l + (lv - l) * 0.25;
    }
    notchHist.copyWithin(1, 0, ROWS - 1);
    notchHist[0] = notch;
    if (img) {
      const d = img.data;
      d.copyWithin(BINS * 4, 0, (ROWS - 1) * BINS * 4);
      for (let k = 0; k < BINS; k++) {
        const v = Math.pow(level[k] ?? 0, 1.35);
        const li = Math.round(v * 255) * 3;
        const o = k * 4;
        d[o] = lut[li] ?? 0;
        d[o + 1] = lut[li + 1] ?? 0;
        d[o + 2] = lut[li + 2] ?? 0;
        d[o + 3] = 255;
      }
    }
  };

  const buildLut = (p: Palette): void => {
    const stops = [p.bg, p.noise, p.trace, p.signal, p.ink];
    const pos = [0, 0.3, 0.58, 0.82, 1];
    for (let i = 0; i < 256; i++) {
      const v = i / 255;
      let k = 0;
      while (k < pos.length - 2 && v > (pos[k + 1] ?? 1)) k++;
      const lo = stops[k] ?? p.bg, hi = stops[k + 1] ?? p.ink;
      const f = (v - (pos[k] ?? 0)) / ((pos[k + 1] ?? 1) - (pos[k] ?? 0));
      lut[i * 3] = lo.r + (hi.r - lo.r) * f;
      lut[i * 3 + 1] = lo.g + (hi.g - lo.g) * f;
      lut[i * 3 + 2] = lo.b + (hi.b - lo.b) * f;
    }
  };

  const notchAtt = (hz: number): number => {
    const dd = (hz - notch) / 22;
    return 0.45 * Math.exp(-dd * dd);
  };

  const draw = (s: Stage, _t: number, dt: number): void => {
    const { ctx, w, h, pal } = s;
    if (!s.reduced && dt > 0) {
      rowAcc += dt / ROW_DT;
      let n = 0;
      while (rowAcc >= 1 && n < 4) {
        row();
        rowAcc -= 1;
        n++;
      }
      if (rowAcc > 1) rowAcc = 0;
    }
    ctx.clearRect(0, 0, w, h);
    const specH = Math.round(h * 0.36);
    const wfTop = specH + 14;
    const wfH = h - wfTop;
    const bx = w / (BINS - 1);
    const hz2x = (hz: number): number => (hz / NYQ) * w;

    // Waterfall.
    if (img && octx) {
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, BINS, ROWS, 0, wfTop, w, wfH);
    }
    // Notch trail.
    ctx.strokeStyle = pal.ink.css;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let r = 0; r < ROWS; r += 2) {
      const X = hz2x(notchHist[r] ?? 0);
      const Y = wfTop + (r / (ROWS - 1)) * wfH;
      if (r === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Spectrum panel grid + frequency ticks.
    ctx.strokeStyle = pal.grid.css;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let k = 1; k < 4; k++) {
      const y = Math.round((specH * k) / 4) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    for (let hz = 100; hz < NYQ; hz += 100) {
      const X = Math.round(hz2x(hz)) + 0.5;
      ctx.moveTo(X, 0);
      ctx.lineTo(X, specH);
    }
    ctx.stroke();
    mono(s, 10);
    ctx.fillStyle = pal.ink.css;
    ctx.globalAlpha = 0.45;
    const stepHz = w < 480 ? 200 : 100;
    for (let hz = stepHz; hz < NYQ; hz += stepHz) ctx.fillText(String(hz), hz2x(hz) + 3, specH + 11);
    for (let k = 1; k < 4; k++) ctx.fillText(`${Math.round((DB_FLOOR * k) / 4)}dB`, 4, (specH * k) / 4 - 3);

    // Notch band.
    const nx = hz2x(notch);
    ctx.fillStyle = pal.trace.css;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(nx - hz2x(22), 0, hz2x(44), specH);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(nx - 5, 0);
    ctx.lineTo(nx + 5, 0);
    ctx.lineTo(nx, 7);
    ctx.fill();

    // Raw spectrum (filled) + filtered spectrum.
    const yOf = (v: number): number => specH - v * (specH - 6);
    ctx.beginPath();
    ctx.moveTo(0, specH);
    for (let k = 0; k < BINS; k++) ctx.lineTo(k * bx, yOf(live[k] ?? 0));
    ctx.lineTo(w, specH);
    ctx.closePath();
    ctx.fillStyle = pal.signal.css;
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.strokeStyle = pal.signal.css;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let k = 0; k < BINS; k++) {
      const Y = yOf(live[k] ?? 0);
      if (k === 0) ctx.moveTo(0, Y);
      else ctx.lineTo(k * bx, Y);
    }
    ctx.stroke();
    ctx.strokeStyle = pal.trace.css;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    const k0 = Math.max(0, Math.floor(((notch - 70) / NYQ) * (BINS - 1)));
    const k1 = Math.min(BINS - 1, Math.ceil(((notch + 70) / NYQ) * (BINS - 1)));
    for (let k = k0; k <= k1; k++) {
      const Y = yOf(Math.max(0, (live[k] ?? 0) - notchAtt((k * NYQ) / (BINS - 1))));
      if (k === k0) ctx.moveTo(k * bx, Y);
      else ctx.lineTo(k * bx, Y);
    }
    ctx.stroke();

    // OSD readout.
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = pal.ink.css;
    ctx.textAlign = 'right';
    ctx.fillText(`THR ${Math.round(thr * 100)}%  M1 ${Math.round(f0)}Hz  NOTCH ${Math.round(notch)}Hz`, w - 6, 14);
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.trace.css;
    ctx.fillText('NOTCH', nx + 7, 14);

    // Hover readout.
    if (hoverX >= 0) {
      const hz = (hoverX / w) * NYQ;
      const k = Math.round((hz / NYQ) * (BINS - 1));
      const db = DB_FLOOR + (live[k] ?? 0) * -DB_FLOOR;
      ctx.strokeStyle = pal.ink.css;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(hoverX) + 0.5, 0);
      ctx.lineTo(Math.round(hoverX) + 0.5, h);
      ctx.stroke();
      const label = `${Math.round(hz)} Hz  ${db.toFixed(0)} dB`;
      mono(s, 11, 600);
      const tw = ctx.measureText(label).width + 12;
      const lx = hoverX + tw + 8 > w ? hoverX - tw - 6 : hoverX + 6;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = pal.bg.css;
      ctx.fillRect(lx, specH * 0.5 - 12, tw, 20);
      ctx.fillStyle = pal.signal.css;
      ctx.globalAlpha = 1;
      ctx.fillText(label, lx + 6, specH * 0.5 + 2);
    }
    ctx.globalAlpha = 1;
  };

  const stage = createStage(canvas, { draw, theme: (s) => {
    buildLut(s.pal);
    if (img) img.data.fill(0);
    // Re-render waterfall history with the new colormap: simplest is a fresh warm-up.
    for (let r = 0; r < ROWS; r++) row();
  } });
  if (!stage) return () => {};

  const onMove = (e: PointerEvent): void => {
    const r = canvas.getBoundingClientRect();
    hoverX = clamp(e.clientX - r.left, 0, r.width);
    stage.kick();
  };
  const onLeave = (): void => {
    hoverX = -1;
    stage.kick();
  };
  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerleave', onLeave, { passive: true });
  return () => {
    stage.dispose();
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
  };
}
