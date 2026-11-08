// Mounts all signal visuals on the page. Each module handles its own pausing and reduced-motion.

// Old Czech section anchors keep working after the switch to English ones.
const OLD_ANCHORS: Record<string, string> = { prace: 'work', cesta: 'track-record', dilna: 'side-quests', poezie: 'personal', kontakt: 'contact' };
const oldHash = location.hash.slice(1);
if (OLD_ANCHORS[oldHash]) {
  history.replaceState(null, '', `#${OLD_ANCHORS[oldHash]}`);
  document.getElementById(OLD_ANCHORS[oldHash]!)?.scrollIntoView();
}
import { mountScope, mountSpectrum, mountTrace, decodeText, mountCursorField, mountPortrait } from './signal';

const scope = document.getElementById('scope');
if (scope instanceof HTMLCanvasElement) mountScope(scope);

const portrait = document.querySelector<HTMLElement>('[data-portrait]');
if (portrait) mountPortrait(portrait);

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
