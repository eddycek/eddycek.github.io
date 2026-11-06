/*
 * Slot-machine easter egg on the hero name. Every 30–45 s (only while the hero is on screen) the
 * letters of "Vaclav" / "Eder" spin like reels, left to right, and land on a 6 + 4 letter claim,
 * hold for a few seconds, then spin back to the name. Works on the per-letter spans created by
 * decode.ts (.sd-c), so it must run after decodeText(). Skipped under reduced motion.
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
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789#$%&';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export function mountSlot(h1: HTMLElement): () => void {
  if (prefersReduced()) return () => {};
  const lines = Array.from(h1.querySelectorAll<HTMLElement>('.hero__line'));
  const reels = lines.map((l) => Array.from(l.querySelectorAll<HTMLSpanElement>('.sd-c')));
  if (reels.length < 2 || reels.some((r) => !r.length)) return () => {};
  const original = reels.map((r) => r.map((s) => s.textContent ?? ''));
  if (CLAIMS.some(([a, b]) => a.length !== original[0]!.length || b.length !== original[1]!.length)) return () => {};

  let visible = true;
  let busy = false;
  let dead = false;
  let timer = 0;
  let next = 0;
  const io = new IntersectionObserver((e) => { visible = e.some((x) => x.isIntersecting); });
  io.observe(h1);

  const spinTo = async (target: string[][]): Promise<void> => {
    const jobs: Promise<void>[] = [];
    reels.forEach((reel, li) => {
      reel.forEach((span, i) => {
        const want = target[li]![i]!;
        const set = /[a-z]/.test(want) ? LOWER : UPPER;
        jobs.push((async () => {
          await sleep(li * 160 + i * 75);
          span.removeAttribute('data-g');
          span.classList.remove('reel-land');
          span.classList.add('reel-spin');
          const spins = 7 + Math.floor(Math.random() * 4) + i;
          for (let k = 0; k < spins && !dead; k++) {
            span.textContent = set[(Math.random() * set.length) | 0]!;
            await sleep(42 + k * 4);
          }
          span.textContent = want;
          span.classList.remove('reel-spin');
          span.classList.add('reel-land');
          await sleep(320);
          span.classList.remove('reel-land');
        })());
      });
    });
    await Promise.all(jobs);
  };

  const melt = (ms: number): void => {
    h1.classList.add('sd-melt');
    window.setTimeout(() => h1.classList.remove('sd-melt'), ms);
  };

  const run = async (): Promise<void> => {
    if (busy || dead || !visible || document.hidden) return;
    busy = true;
    h1.dataset.reel = '1';
    melt(220);
    const [a, b] = CLAIMS[next % CLAIMS.length]!;
    next++;
    await spinTo([a.split(''), b.split('')]);
    melt(180);
    await sleep(3200);
    melt(200);
    if (!dead) await spinTo(original);
    melt(160);
    delete h1.dataset.reel;
    busy = false;
  };

  const schedule = (first = false): void => {
    timer = window.setTimeout(() => {
      void run().finally(() => { if (!dead) schedule(); });
    }, first ? rnd(9000, 14000) : rnd(30000, 45000));
  };
  next = (Math.random() * CLAIMS.length) | 0;
  schedule(true);

  return () => {
    dead = true;
    clearTimeout(timer);
    io.disconnect();
  };
}
