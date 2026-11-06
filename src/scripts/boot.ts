// Mounts all signal visuals on the page. Each module handles its own pausing and reduced-motion.
import { mountScope, mountSpectrum, mountTrace, decodeText, mountCursorField, mountSlot } from './signal';

const scope = document.getElementById('scope');
if (scope instanceof HTMLCanvasElement) mountScope(scope);

const spectrum = document.getElementById('spectrum');
if (spectrum instanceof HTMLCanvasElement) mountSpectrum(spectrum);

const trace = document.getElementById('trace');
if (trace instanceof HTMLCanvasElement) {
  try {
    mountTrace(trace, JSON.parse(trace.dataset.points ?? '[]'));
  } catch {
    /* malformed data-points: leave the box empty */
  }
}

decodeText(document.body);
const heroName = document.getElementById('hero-name');
if (heroName) mountSlot(heroName);
mountCursorField();

import { mountSparks } from './spark';
mountSparks();

// External links (other hosts) open in a new tab, safely.
document.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
  if (a.host === location.host) return;
  a.target = '_blank';
  const rel = new Set((a.rel || '').split(/\s+/).filter(Boolean));
  rel.add('noopener');
  rel.add('noreferrer');
  a.rel = Array.from(rel).join(' ');
});
