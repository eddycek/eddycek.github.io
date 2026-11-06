/*
 * Hero oscilloscope. A sweeping beam writes four channels with phosphor
 * afterglow: setpoint + response of a simulated 2nd-order plant under a real
 * PID controller (orange), the controller output (cyan) and two faint noise
 * channels. Scrolling grid with OSD tick labels, occasional glitch bursts.
 * Pointer movement kicks the plant and ripples the noise at the pointer x;
 * click/tap injects a setpoint step. Noise fades as the page scrolls.
 */
import { clamp, createStage, mono, pad, type Stage } from './common';

const COLS = 512; // columns per sweep
const SWEEP = 2.8; // seconds per sweep
const STEP = SWEEP / COLS; // simulated seconds per column
const SUB = 4; // physics substeps per column
const BUCKETS = 8; // afterglow brightness buckets
const GAP = 22; // erase gap ahead of the beam (columns)
const BW = Math.ceil((COLS - GAP) / BUCKETS);

// Plant: x'' = W²(u + d) − 2ζW·x' − W²·x ; PID tuned for ~27 % overshoot.
const W = 14;
const Z = 0.3;
const KP = 3;
const KI = 10;
const KD = 0.02;
const AMP = 0.34; // response amplitude as a fraction of canvas height
const DEG = 1600 * AMP; // °/s per unit, so horizontal grid lines land on ±200 °/s

export function mountScope(canvas: HTMLCanvasElement): () => void {
  const sp = new Float32Array(COLS);
  const ys = new Float32Array(COLS);
  const us = new Float32Array(COLS);
  const n1 = new Float32Array(COLS);
  const n2 = new Float32Array(COLS);

  let x = 0, v = 0, integ = 0, prevMeas = 0, dTerm = 0, dist = 0, setp = 0.35, u = 0;
  let nextStep = 1.2, simT = 0, written = 0, acc = 0;
  let lp1 = 0, lp2 = 0, noiseGain = 1;
  let glitch = 0, nextGlitch = 3 + Math.random() * 4;
  let ptrX = -1, ptrY = -1, ptrAge = 9, ripple = 0;
  let err = 0;

  const gauss = (): number => Math.random() + Math.random() + Math.random() - 1.5;

  const newSetpoint = (big: boolean): void => {
    let nv = (Math.random() * 2 - 1) * 0.75;
    if (big) nv = -Math.sign(setp || 1) * (0.55 + Math.random() * 0.3);
    else if (Math.abs(nv - setp) < 0.3) nv = clamp(setp + Math.sign(nv - setp || 1) * 0.45, -0.8, 0.8);
    setp = nv;
  };

  const column = (): void => {
    simT += STEP;
    if (simT >= nextStep) {
      newSetpoint(false);
      nextStep = simT + 1.3 + Math.random() * 1.9;
    }
    const h = STEP / SUB;
    const nz = noiseGain * 0.025 * gauss();
    let meas = x;
    for (let k = 0; k < SUB; k++) {
      meas = x + nz;
      const e = setp - meas;
      integ = clamp(integ + e * h, -1.5, 1.5);
      dTerm += (-(meas - prevMeas) / h - dTerm) * 0.12; // D-term lowpass
      prevMeas = meas;
      u = clamp(KP * e + KI * integ + KD * dTerm, -4, 4);
      const a = W * W * (u + dist) - 2 * Z * W * v - W * W * x;
      v += a * h;
      x += v * h;
    }
    dist *= Math.exp(-STEP * 5);
    err = setp - x;
    lp1 += (gauss() - lp1) * 0.35;
    lp2 += (gauss() - lp2) * 0.08;
    const i = written % COLS;
    const g = noiseGain;
    sp[i] = setp;
    ys[i] = meas;
    us[i] = u;
    n1[i] = g * (lp1 * 0.5 + 0.18 * Math.sin(simT * 47));
    n2[i] = g * (lp2 * 1.6 + 0.12 * Math.sin(simT * 13 + 1));
    written++;
  };

  // Warm start: the screen is full on the very first frame.
  for (let i = 0; i < COLS; i++) column();

  const onMove = (e: PointerEvent): void => {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    if (px < 0 || py < 0 || px > r.width || py > r.height) return;
    if (ptrX >= 0 && ptrAge < 0.25) {
      const dy = (py - ptrY) / r.height;
      const dx = (px - ptrX) / r.width;
      dist = clamp(dist + dy * 9, -1.6, 1.6);
      ripple = Math.min(1.5, ripple + Math.hypot(dx, dy) * 6);
      const c0 = Math.round((px / r.width) * (COLS - 1));
      const amp = clamp(dy * 14, -0.6, 0.6);
      for (let o = -36; o <= 36; o++) {
        const c = (c0 + o + COLS) % COLS;
        const gk = Math.exp(-(o * o) / 160);
        n1[c] = (n1[c] ?? 0) + amp * gk;
        n2[c] = (n2[c] ?? 0) - amp * gk * 0.7;
      }
    }
    ptrX = px;
    ptrY = py;
    ptrAge = 0;
    stage?.kick();
  };
  const onDown = (e: PointerEvent): void => {
    const r = canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    newSetpoint(true);
    nextStep = simT + 2 + Math.random();
    glitch = Math.max(glitch, 0.08);
  };

  const drawCh = (s: Stage, arr: Float32Array, mid: number, scale: number, color: string, lw: number, alpha: number, glow: boolean, xoff: number): void => {
    const ctx = s.ctx;
    const sx = s.w / (COLS - 1);
    const head = (written - 1) % COLS;
    ctx.strokeStyle = color;
    for (let b = BUCKETS - 1; b >= 0; b--) {
      const a0 = b * BW;
      const a1 = Math.min(COLS - GAP, a0 + BW + 1);
      const fade = 1 - b / BUCKETS;
      const al = alpha * fade * fade;
      const passes = glow && b < 2 ? 2 : 1;
      for (let p = 0; p < passes; p++) {
        ctx.globalAlpha = p === 1 ? al * 0.18 : al;
        ctx.lineWidth = p === 1 ? lw * 5 : lw;
        ctx.beginPath();
        let prev = -1;
        for (let a = a0; a <= a1; a++) {
          const i = (head - a + COLS) % COLS;
          const X = i * sx + xoff;
          const Y = mid - (arr[i] ?? 0) * scale;
          if (prev < 0 || i > prev) ctx.moveTo(X, Y);
          else ctx.lineTo(X, Y);
          prev = i;
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };

  let gridShift = 0;
  let ticks = 0;

  const draw = (s: Stage, t: number, dt: number): void => {
    const { ctx, w, h, pal } = s;
    if (!s.reduced && dt > 0) {
      const target = 1 - 0.92 * clamp(window.scrollY / Math.max(1, h), 0, 1);
      noiseGain += (target - noiseGain) * Math.min(1, dt * 4);
      acc += dt / STEP;
      while (acc >= 1) {
        column();
        acc -= 1;
      }
      ptrAge += dt;
      ripple *= Math.exp(-dt * 3);
      gridShift += dt * 26;
      const div = w / 10;
      while (gridShift >= div) {
        gridShift -= div;
        ticks++;
      }
      nextGlitch -= dt;
      if (nextGlitch <= 0) {
        glitch = 0.1 + Math.random() * 0.16;
        nextGlitch = 3.5 + Math.random() * 6;
      }
      glitch = Math.max(0, glitch - dt);
    }
    ctx.clearRect(0, 0, w, h);
    const mid = h * 0.5;
    const amp = h * AMP;

    // Grid: scrolling vertical divisions, fixed horizontal ones, ticked centre axis.
    const div = w / 10;
    ctx.strokeStyle = pal.grid.css;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let gx = -gridShift; gx <= w + 1; gx += div) {
      ctx.moveTo(Math.round(gx) + 0.5, 0);
      ctx.lineTo(Math.round(gx) + 0.5, h);
    }
    for (let k = 1; k < 8; k++) {
      const gy = Math.round((h * k) / 8) + 0.5;
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
    }
    for (let gx = -gridShift; gx <= w; gx += div / 5) {
      ctx.moveTo(gx, mid - 4);
      ctx.lineTo(gx, mid + 4);
    }
    ctx.stroke();

    // OSD labels.
    mono(s, 10);
    ctx.fillStyle = pal.ink.css;
    ctx.globalAlpha = 0.38;
    ctx.textBaseline = 'alphabetic';
    let n = ticks;
    for (let gx = -gridShift; gx <= w; gx += div) {
      if (gx > 8) ctx.fillText(`${pad(n * 50, 4)}ms`, gx + 4, h - 8);
      n++;
    }
    for (let k = 1; k < 8; k++) {
      if (k === 4) continue;
      ctx.fillText(`${(4 - k) * 200 > 0 ? '+' : ''}${(4 - k) * 200}°/s`, 6, (h * k) / 8 - 4);
    }
    ctx.globalAlpha = 0.55;
    if (w > 760) ctx.fillText('CH1 SP/GYRO  CH2 PID  CH3·4 NOISE', 6, 16);
    const right = `P${KP.toFixed(1)} I${KI.toFixed(1)} D${KD.toFixed(2)}  ERR ${err >= 0 ? '+' : ''}${err.toFixed(3)}  σ ${(20 * Math.log10(noiseGain * 0.025 + 1e-4)).toFixed(0)}dB`;
    ctx.textAlign = 'right';
    ctx.fillText(right, w - 6, 16);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;

    // Traces, back to front.
    const lw = w < 640 ? 1.6 : 2.2;
    const rip = 1 + ripple;
    drawCh(s, n2, h * 0.8, amp * 0.22 * rip, pal.noise.css, 1, 0.9, false, 0);
    drawCh(s, n1, h * 0.2, amp * 0.22 * rip, pal.noise.css, 1, 0.9, false, 0);
    drawCh(s, us, mid, amp * 0.5, pal.trace.css, 1.2, 0.75, true, 0);
    drawCh(s, sp, mid, amp, pal.ink.css, 1, 0.35, false, 0);
    if (glitch > 0) {
      const off = (Math.random() * 2 - 1) * 9;
      drawCh(s, ys, mid, amp, pal.trace.css, lw, 0.5, false, off);
      drawCh(s, ys, mid, amp, pal.signal.css, lw, 0.5, false, -off);
    }
    drawCh(s, ys, mid, amp, pal.signal.css, lw, 1, true, 0);

    // Beam head.
    const head = (written - 1) % COLS;
    const hx = (head * w) / (COLS - 1);
    const hy = mid - (ys[head] ?? 0) * amp;
    const lightBg = pal.bg.r + pal.bg.g + pal.bg.b > 384;
    ctx.fillStyle = pal.signal.css;
    ctx.globalAlpha = lightBg ? 0.02 : 0.07;
    ctx.fillRect(hx - 18, 0, 18, h);
    ctx.globalAlpha = lightBg ? 0.08 : 0.14;
    ctx.fillRect(hx - (lightBg ? 1 : 3), 0, lightBg ? 1 : 3, h);
    for (let r = 3; r >= 1; r--) {
      ctx.globalAlpha = r === 1 ? 1 : 0.12 + 0.05 / r;
      ctx.beginPath();
      ctx.arc(hx, hy, r === 1 ? 3 : r * 6 + 2 * Math.sin(t * 6), 0, Math.PI * 2);
      ctx.fill();
    }

    // Pointer probe.
    if (ptrX >= 0 && ptrAge < 2.5 && !s.reduced) {
      const c = Math.round((ptrX / w) * (COLS - 1));
      const fade = 1 - ptrAge / 2.5;
      ctx.strokeStyle = pal.ink.css;
      ctx.globalAlpha = 0.35 * fade;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(ptrX, 0);
      ctx.lineTo(ptrX, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8 * fade;
      ctx.fillStyle = pal.ink.css;
      const val = ys[c] ?? 0;
      ctx.fillText(`T+${pad((c * STEP) * 1000, 4)}ms  ${val >= 0 ? '+' : ''}${(val * DEG).toFixed(0)}°/s`, ptrX + 8, 32);
    }

    // Glitch bars.
    if (glitch > 0) {
      ctx.fillStyle = pal.signal.css;
      for (let k = 0; k < 4; k++) {
        ctx.globalAlpha = 0.04 + Math.random() * 0.1;
        ctx.fillRect(0, Math.random() * h, w, 1 + Math.random() * 10);
      }
      ctx.fillStyle = pal.trace.css;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(Math.random() * w * 0.6, Math.random() * h, w * 0.4, 2);
    }
    ctx.globalAlpha = 1;
  };

  const stage = createStage(canvas, { draw });
  if (!stage) return () => {};
  if (stage.s.reduced) return () => stage.dispose();

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  return () => {
    stage.dispose();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
  };
}
