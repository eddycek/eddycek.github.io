/*
 * Hero oscilloscope. A sweeping beam writes four channels with phosphor
 * afterglow: setpoint + response of a simulated 2nd-order plant under a real
 * PID controller (orange), the controller output (cyan) and two faint noise
 * channels. Scrolling grid with OSD tick labels, occasional glitch bursts.
 * Pointer movement kicks the plant and ripples the noise at the pointer x;
 * click/tap shatters the signal at that point: a shockwave, torn scanlines,
 * flying trace shards and a damaged stretch of every channel that stays until
 * the beam sweeps over it again. Every hit costs signal integrity; break it
 * completely and the quad drops into FAILSAFE: static, a line from the poem,
 * the name and verse melt (window 'signal:failsafe'), then it re-arms.
 * Noise fades as the page scrolls.
 */
import { clamp, createStage, mono, pad, type Stage } from './common';
import { signalHit, telemetryLost, telemetryRecovered } from './radio';

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

  interface Shock { x: number; y: number; age: number; seed: number }
  interface Shard { x: number; y: number; vx: number; vy: number; rot: number; vr: number; len: number; age: number; life: number; hue: 0 | 1 }
  const shocks: Shock[] = [];
  const shards: Shard[] = [];
  let tear = 0;
  let dmg = 0; // 0..1, lost signal integrity
  let failsafe = 0; // seconds left in FAILSAFE
  let failCount = 0;
  const FAIL_T = 6.5;
  const FAIL_LINES = [
    'cut the wires, no fucking choice.',
    'no escape, just broken glass.',
    'every second burns too fast.',
    'nothing left, just follow noise.',
  ];

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
    // Only clicks that land inside the hero section itself; never the sticky bar or the rest of the page.
    const target = e.target as Element | null;
    if (!target?.closest?.('#signal') || target.closest('a, button, input, textarea, header')) return;
    if (failsafe > 0) return;
    dmg = Math.min(1, dmg + 0.13 + Math.random() * 0.05);
    if (dmg < 1) signalHit(dmg);
    if (dmg >= 1) {
      dmg = 0;
      failsafe = FAIL_T;
      failCount++;
      canvas.parentElement?.classList.add('is-failsafe');
      window.dispatchEvent(new CustomEvent('signal:failsafe', { detail: 2400 }));
      telemetryLost();
    }
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    newSetpoint(true);
    nextStep = simT + 2 + Math.random();
    dist = clamp(dist + (Math.random() < 0.5 ? -1 : 1) * 1.6, -2.4, 2.4);
    glitch = Math.max(glitch, 0.35);
    tear = 0.45;
    ripple = 1.5;

    // Damage every channel around the hit column; it stays until the beam rewrites it.
    const c0 = Math.round((px / r.width) * (COLS - 1));
    const span = 70;
    const kick = (py / r.height - 0.5) * -2.2;
    for (let o = -span; o <= span; o++) {
      const c = (c0 + o + COLS) % COLS;
      const env = Math.exp(-Math.abs(o) / 22);
      const ring = Math.sin(o * 0.55) * env;
      const shatter = (Math.random() * 2 - 1) * env;
      ys[c] = (ys[c] ?? 0) + ring * 0.9 + shatter * 0.5 + kick * env;
      us[c] = (us[c] ?? 0) + shatter * 2.4;
      sp[c] = Math.abs(o) < 18 ? (sp[c] ?? 0) + (Math.random() * 2 - 1) * 0.6 : sp[c] ?? 0;
      n1[c] = (n1[c] ?? 0) + (Math.random() * 2 - 1) * 2.6 * env;
      n2[c] = (n2[c] ?? 0) + (Math.random() * 2 - 1) * 2.6 * env;
    }

    shocks.push({ x: px, y: py, age: 0, seed: Math.random() * 1000 });
    if (shocks.length > 4) shocks.shift();
    const count = r.width < 640 ? 26 : 44;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp0 = 180 + Math.random() * 620;
      shards.push({
        x: px, y: py,
        vx: Math.cos(a) * sp0, vy: Math.sin(a) * sp0 - 120,
        rot: a, vr: (Math.random() * 2 - 1) * 14,
        len: 4 + Math.random() * 22,
        age: 0, life: 0.6 + Math.random() * 0.8,
        hue: Math.random() < 0.7 ? 0 : 1,
      });
    }
    if (shards.length > 160) shards.splice(0, shards.length - 160);
    stage?.kick();
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
      const passes = glow && b < 2 && s.w >= 640 ? 2 : 1;
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
      tear = Math.max(0, tear - dt);
      if (failsafe > 0) {
        failsafe = Math.max(0, failsafe - dt);
        if (failsafe === 0) {
          telemetryRecovered();
          canvas.parentElement?.classList.remove('is-failsafe');
          glitch = 0.4;
          tear = 0.3;
        }
      } else dmg = Math.max(0, dmg - dt * 0.035);
      for (let k = shocks.length - 1; k >= 0; k--) {
        const sh = shocks[k];
        if (!sh) continue;
        sh.age += dt;
        if (sh.age > 1.2) shocks.splice(k, 1);
      }
      for (let k = shards.length - 1; k >= 0; k--) {
        const p = shards[k];
        if (!p) continue;
        p.age += dt;
        if (p.age > p.life) { shards.splice(k, 1); continue; }
        p.vx *= Math.exp(-dt * 2.2);
        p.vy = p.vy * Math.exp(-dt * 2.2) + 520 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    }
    ctx.clearRect(0, 0, w, h);
    if (failsafe > 0) {
      drawFailsafe(s, t);
      return;
    }
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
    // Fewer labels on narrow screens so they never collide with each other or the hero text.
    const every = w < 640 ? 3 : w < 1000 ? 2 : 1;
    for (let gx = -gridShift; gx <= w; gx += div) {
      if (gx > 8 && n % every === 0) ctx.fillText(`${pad(n * 50, 4)}ms`, gx + 4, h - 8);
      n++;
    }
    for (let k = 1; k < 8; k++) {
      if (k === 4 || w < 1100) continue;
      // Right edge, so the labels never sit under the hero text.
      ctx.textAlign = 'right';
      ctx.fillText(`${(4 - k) * 200 > 0 ? '+' : ''}${(4 - k) * 200}°/s`, w - 6, (h * k) / 8 - 4);
      ctx.textAlign = 'left';
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
    // Signal integrity meter, only once something got broken.
    if (dmg > 0.01) {
      const pct = Math.round((1 - dmg) * 100);
      const bw = Math.min(220, w * 0.3);
      const bx = (w - bw) / 2;
      const by = 22;
      const hot = dmg > 0.6;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = hot ? pal.signal.css : pal.ink.css;
      mono(s, 10);
      ctx.textAlign = 'center';
      ctx.fillText(`SIGNAL INTEGRITY ${pad(pct, 3)}%${hot && Math.sin(t * 18) > 0 ? '  ⚠ RSSI LOW' : ''}`, w / 2, by);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(bx, by + 6, bw, 3);
      ctx.globalAlpha = 0.95;
      ctx.fillRect(bx, by + 6, bw * (1 - dmg), 3);
      ctx.globalAlpha = 1;
    }

    // Impact: shockwave rings, shards, torn scanlines.
    for (const sh of shocks) {
      const k = sh.age / 1.2;
      const rad = 20 + sh.age * Math.max(w, h) * 0.9;
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.signal.css;
      ctx.globalAlpha = 0.7 * (1 - k) * (1 - k);
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = pal.trace.css;
      ctx.globalAlpha = 0.45 * (1 - k) * (1 - k);
      ctx.beginPath();
      ctx.arc(sh.x + 3, sh.y, rad * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      if (sh.age < 0.25) {
        // Crack lines radiating from the hit.
        const f = 1 - sh.age / 0.25;
        ctx.strokeStyle = pal.ink.css;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.55 * f;
        ctx.beginPath();
        for (let c = 0; c < 9; c++) {
          let a = sh.seed + c * 0.7;
          let cx = sh.x, cy = sh.y;
          ctx.moveTo(cx, cy);
          for (let seg = 0; seg < 5; seg++) {
            a += Math.sin(sh.seed * (seg + 1) + c) * 0.5;
            const l = 14 + ((sh.seed * (c + 3) * (seg + 7)) % 30);
            cx += Math.cos(a) * l;
            cy += Math.sin(a) * l;
            ctx.lineTo(cx, cy);
          }
        }
        ctx.stroke();
        ctx.fillStyle = pal.ink.css;
        ctx.globalAlpha = 0.25 * f;
        ctx.fillRect(0, 0, w, h);
      }
    }
    for (const p of shards) {
      const f = 1 - p.age / p.life;
      ctx.strokeStyle = p.hue === 0 ? pal.signal.css : pal.trace.css;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = f;
      const dx = Math.cos(p.rot) * p.len * 0.5;
      const dy = Math.sin(p.rot) * p.len * 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x - dx, p.y - dy);
      ctx.lineTo(p.x + dx, p.y + dy);
      ctx.stroke();
    }
    if (tear > 0) {
      // Horizontal tearing: shift random bands of the frame sideways.
      const cw = s.canvas.width;
      const chh = s.canvas.height;
      const bands = 7;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      for (let k = 0; k < bands; k++) {
        const bh = Math.max(2, Math.round((2 + Math.random() * 26) * s.dpr));
        const by = Math.round(Math.random() * (chh - bh));
        const off = Math.round((Math.random() * 2 - 1) * 60 * s.dpr * (tear / 0.45));
        ctx.drawImage(s.canvas, 0, by, cw, bh, off, by, cw, bh);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  };

  const drawFailsafe = (s: Stage, t: number): void => {
    const { ctx, w, h, pal } = s;
    const k = 1 - failsafe / FAIL_T; // 0 → 1
    // Opaque-ish cover: the canvas sits above the hero text during FAILSAFE.
    ctx.fillStyle = pal.bg.css;
    ctx.globalAlpha = k > 0.85 ? 0.9 * (1 - (k - 0.85) / 0.15) : 0.9;
    ctx.fillRect(0, 0, w, h);
    // Static.
    const cell = w < 640 ? 3 : 4;
    const n = Math.round((w * h) / (cell * cell * 9));
    for (let i = 0; i < n; i++) {
      const v = Math.random();
      ctx.fillStyle = v > 0.92 ? pal.signal.css : v > 0.5 ? pal.ink.css : pal.noise.css;
      ctx.globalAlpha = 0.08 + Math.random() * 0.22;
      ctx.fillRect(((Math.random() * w) / cell | 0) * cell, ((Math.random() * h) / cell | 0) * cell, cell, cell);
    }
    // Rolling bar.
    ctx.fillStyle = pal.ink.css;
    ctx.globalAlpha = 0.06;
    ctx.fillRect(0, ((t * 220) % (h + 80)) - 80, w, 80);
    // Text.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const big = Math.min(120, w / 6.5);
    // Centre on the part of the hero that is actually on screen (phones: hero is taller than the viewport).
    const r = s.canvas.getBoundingClientRect();
    const visTop = clamp(-r.top, 0, h);
    const visBot = clamp(window.innerHeight - r.top, 0, h);
    const cy = (visBot > visTop ? (visTop + visBot) / 2 : h * 0.44) - big * 0.25;
    if (Math.sin(t * 22) > -0.3) {
      ctx.font = `800 ${big}px ${getComputedStyle(document.documentElement).getPropertyValue('--f-display') || 'sans-serif'}`;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = pal.trace.css;
      ctx.fillText('FAILSAFE', w / 2 + 4, cy);
      ctx.fillStyle = pal.signal.css;
      ctx.fillText('FAILSAFE', w / 2 - 3, cy);
    }
    mono(s, Math.max(11, Math.min(16, w / 60)));
    ctx.fillStyle = pal.ink.css;
    ctx.globalAlpha = 0.9;
    const line = FAIL_LINES[(failCount - 1) % FAIL_LINES.length] ?? '';
    const shown = line.slice(0, Math.ceil(line.length * Math.min(1, k * 2.2)));
    ctx.fillText(`RX LOSS · ${shown}${Math.sin(t * 12) > 0 ? '_' : ' '}`, w / 2, cy + big * 0.62);
    ctx.globalAlpha = 0.55;
    ctx.fillText(
      k > 0.72 ? 'REARMING…' : `DISARMED · FAILSAFE #${pad(failCount, 2)} · YOU BROKE IT`,
      w / 2,
      cy + big * 0.62 + 26,
    );
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
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
