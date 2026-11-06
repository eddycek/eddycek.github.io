/*
 * Slot-machine easter egg on the hero name. Every 30–45 s (only while the hero is on screen) the
 * letters of "Vaclav" / "Eder" roll like reels, left to right, and land on a 6 + 4 letter claim,
 * while the nickname "eddycek" rolls to a redacted "xxxxxxx" of the same length. After a short hold everything rolls
 * back. Works on the per-letter spans created by decode.ts (.sd-c), so it must run after
 * decodeText(). Each letter box morphs its width from the old glyph to the new one, so the line
 * never jumps. Skipped under reduced motion.
 */
import { prefersReduced } from './common';

const CLAIMS: [string, string][] = [
  ['LockIn', 'Mode'], // once it grabs me, it does not let go
  ['BornTo', 'Ship'], // born for this work
  ['Lights', 'Out.'], // the Dark Factory: a lights-out factory
  ['Hacker', 'Soul'], // Flipper, IoT, security, building things
  ['Signal', 'Hunt'], // looking for the signal in the noise
  ['Desert', 'Mind'], // deserts, silence, nomad minimalism
];
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

interface Group {
  el: HTMLElement;
  spans: HTMLSpanElement[];
  original: string[];
  delay: number; // ms before the first letter of this group starts
}

export function mountSlot(h1: HTMLElement): () => void {
  if (prefersReduced()) return () => {};
  const lines = Array.from(h1.querySelectorAll<HTMLElement>('.hero__line'));
  const nick = document.querySelector<HTMLElement>('.hero__nick');
  const spansOf = (el: Element): HTMLSpanElement[] => Array.from(el.querySelectorAll<HTMLSpanElement>('.sd-c'));
  const groups: Group[] = lines.map((l, i) => ({ el: h1, spans: spansOf(l), original: [], delay: i * 170 }));
  if (nick) groups.push({ el: nick, spans: spansOf(nick), original: [], delay: 420 });
  if (groups.length < 2 || groups.some((g) => !g.spans.length)) return () => {};
  for (const g of groups) g.original = g.spans.map((s) => s.textContent ?? '');
  const [first, second] = groups;
  if (CLAIMS.some(([a, b]) => a.length !== first!.original.length || b.length !== second!.original.length)) return () => {};

  let visible = true;
  let busy = false;
  let dead = false;
  let timer = 0;
  let next = 0;
  const io = new IntersectionObserver((e) => { visible = e.some((x) => x.isIntersecting); });
  io.observe(h1);

  const flash = (ms: number): void => {
    h1.classList.add('reel-glitch');
    window.setTimeout(() => h1.classList.remove('reel-glitch'), ms);
  };

  /**
   * Roll every span of a group to its target letter like a real slot reel: the letter box becomes a
   * fixed window holding a vertical strip [current, random…, target]; the strip slides up in one
   * eased motion and stops on the target. The box width morphs from the old glyph to the new one.
   */
  const rollGroup = async (g: Group, target: string[]): Promise<void> => {
    const now = g.spans.map((s) => s.textContent ?? '');
    // Measure start and end widths in one batch.
    const w0 = g.spans.map((s) => (s.textContent ? s.getBoundingClientRect().width : 0));
    g.spans.forEach((s, i) => { s.textContent = target[i] || '\u200b'; });
    const w1 = g.spans.map((s, i) => (target[i] ? s.getBoundingClientRect().width : 0));
    g.spans.forEach((s, i) => { s.textContent = now[i] ?? ''; });

    await Promise.all(g.spans.map(async (span, i) => {
      const want = target[i] ?? '';
      const set = /[a-z]/.test(want || now[i] || 'a') ? LOWER : UPPER;
      const n = 9 + i * 2 + Math.floor(Math.random() * 3); // symbols passing the window
      const dur = 620 + i * 85 + Math.random() * 80;       // later reels stop later
      await sleep(g.delay + i * 45);
      if (dead) return;
      span.removeAttribute('data-g');
      span.classList.remove('reel-land');

      const strip = document.createElement('span');
      strip.className = 'reel-strip';
      const cells = [now[i] || '\u200b'];
      for (let k = 0; k < n; k++) cells.push(set[(Math.random() * set.length) | 0]!);
      cells.push(want || '\u200b');
      for (const [k, ch] of cells.entries()) {
        const c = document.createElement('span');
        c.className = k === 0 || k === cells.length - 1 ? 'reel-cell' : 'reel-cell reel-cell--blur';
        c.textContent = ch;
        strip.appendChild(c);
      }
      span.style.width = `${w0[i]}px`;
      span.textContent = '';
      span.appendChild(strip);
      span.classList.add('reel-box');
      void span.offsetWidth; // commit the start state
      span.style.transition = `width ${dur}ms cubic-bezier(0.2, 0.75, 0.2, 1)`;
      span.style.width = `${w1[i]}px`;
      strip.style.transition = `transform ${dur}ms cubic-bezier(0.18, 0.72, 0.18, 1)`;
      strip.style.transform = `translateY(calc(var(--win) * ${-(cells.length - 1)}))`;
      await sleep(dur);
      if (dead) return;
      span.textContent = want;
      span.classList.remove('reel-box');
      span.style.transition = '';
      span.style.width = want ? '' : '0px';
      if (want) {
        span.classList.add('reel-land');
        await sleep(320);
        span.classList.remove('reel-land');
      }
    }));
  };

  const rollAll = async (targets: string[][]): Promise<void> => {
    await Promise.all(groups.map((g, gi) => rollGroup(g, targets[gi]!)));
  };

  const run = async (): Promise<void> => {
    if (busy || dead || !visible || document.hidden) return;
    busy = true;
    for (const g of groups) g.el.dataset.reel = '1';
    const [a, b] = CLAIMS[next % CLAIMS.length]!;
    next++;
    const nickTarget = groups[2] ? groups[2].original.map(() => 'x') : [];
    flash(160);
    await rollAll([a.split(''), b.split(''), nickTarget]);
    flash(140);
    await sleep(3400);
    if (!dead) {
      flash(160);
      await rollAll(groups.map((g) => g.original));
      flash(120);
    }
    for (const g of groups) delete g.el.dataset.reel;
    busy = false;
  };

  const schedule = (firstRun = false): void => {
    timer = window.setTimeout(() => {
      void run().finally(() => { if (!dead) schedule(); });
    }, firstRun ? rnd(9000, 14000) : rnd(30000, 45000));
  };
  next = (Math.random() * CLAIMS.length) | 0;
  schedule(true);

  return () => {
    dead = true;
    clearTimeout(timer);
    io.disconnect();
  };
}
