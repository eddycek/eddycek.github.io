/*
 * "Signál a šum" animation layer: public API. Each mount function returns a
 * disposer that removes its listeners, observers and animation frames.
 */
export { mountScope } from './scope';
export { mountSpectrum } from './spectrum';
export { mountTrace, type TracePoint } from './trace';
export { decodeText } from './decode';
export { mountCursorField } from './cursor';
export { mountPortrait } from './portrait';
