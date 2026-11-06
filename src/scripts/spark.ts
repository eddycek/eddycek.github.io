// Tiny live sparklines under the OSD readouts in #prace.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountSparks(): void {
  const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-spark]'));
  if (!canvases.length) return;
  const N = 64;
  const series = canvases.map((_, k) => {
    const a = new Float32Array(N);
    for (let i = 0; i < N; i++) a[i] = 0.5 + 0.3 * Math.sin(i * (0.2 + k * 0.07));
    return a;
  });
  let visible = false;
  let t = 0;
  let raf = 0;
  const io = new IntersectionObserver((e) => {
    visible = e.some((x) => x.isIntersecting);
    if (visible && !reduce && !raf) raf = requestAnimationFrame(frame);
  });
  canvases.forEach((c) => io.observe(c));

  function draw(): void {
    canvases.forEach((c, k) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cs = getComputedStyle(c);
      const col = k % 2 ? cs.getPropertyValue('--c-trace') : cs.getPropertyValue('--c-signal');
      const s = series[k];
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * w;
        const y = h - 4 - s[i] * (h - 8);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = col.trim() || '#FF7A2F';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function frame(): void {
    raf = 0;
    if (!visible || document.hidden) return;
    t++;
    if (t % 4 === 0) {
      series.forEach((s, k) => {
        s.copyWithin(0, 1);
        const prev = s[N - 2];
        const target = 0.5 + 0.32 * Math.sin(t * (0.03 + k * 0.011)) ;
        s[N - 1] = Math.min(1, Math.max(0, prev + (target - prev) * 0.35 + (Math.random() - 0.5) * 0.12));
      });
      draw();
    }
    raf = requestAnimationFrame(frame);
  }
  draw();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !reduce && !raf) raf = requestAnimationFrame(frame); });
}
