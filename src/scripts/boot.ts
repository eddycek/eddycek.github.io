// Mounts all signal visuals on the page. Each module handles its own pausing and reduced-motion.
import { mountScope, mountSpectrum, mountTrace, decodeText, mountCursorField } from './signal';

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
mountCursorField();

import { mountSparks } from './spark';
mountSparks();
