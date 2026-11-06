/*
 * Radio callouts for the FAILSAFE easter egg, using the stock EdgeTX English
 * voice prompts (telemko / telemok, GPL-2.0, see public/sounds/NOTICE.txt).
 * Falls back to the Web Speech API if the audio cannot play.
 * Only ever called from a user click, so autoplay policies allow it.
 */
// One AudioContext for everything. iOS only lets audio start inside a user gesture, so the context
// is created/resumed on the first tap (see unlockAudio) and the voice prompts are decoded into
// buffers up front; the 'recovered' prompt then plays from a timer without being blocked.
let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const SOUNDS = ['/sounds/telemetry-lost.wav', '/sounds/telemetry-recovered.wav'];

function speak(text: string): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-GB';
  synth.cancel();
  synth.speak(u);
}

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    // A silent one-sample buffer played inside the gesture fully unlocks iOS.
    const b = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start(0);
    for (const url of SOUNDS) {
      if (buffers.has(url)) continue;
      buffers.set(url, ctx.createBuffer(1, 1, 22050)); // placeholder so we fetch once
      void fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx!.decodeAudioData(data))
        .then((buf) => buffers.set(url, buf))
        .catch(() => buffers.delete(url));
    }
  } catch {
    /* no audio */
  }
}

function play(url: string, fallback: string): void {
  const buf = buffers.get(url);
  if (ctx && buf && buf.length > 1) {
    if (ctx.state === 'suspended') void ctx.resume();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    src.buffer = buf;
    src.connect(gain).connect(ctx.destination);
    src.start();
    return;
  }
  // Not decoded yet: try a plain audio element, then speech.
  const a = new Audio(url);
  void a.play().catch(() => speak(fallback));
}

export const telemetryLost = (): void => play('/sounds/telemetry-lost.wav', 'Telemetry lost');
export const telemetryRecovered = (): void => play('/sounds/telemetry-recovered.wav', 'Telemetry recovered');

/*
 * Hit sound for each click into the scope: a short burst of static plus a falling
 * square "zap", synthesized with Web Audio. Gets harsher as signal integrity drops.
 */
let last = 0;

export function signalHit(damage: number): void {
  const now = performance.now();
  if (now - last < 60) return;
  last = now;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const d = Math.min(1, Math.max(0, damage));

    // Static burst.
    const len = Math.floor(ctx.sampleRate * (0.09 + d * 0.12));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 2400;
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.05 + d * 0.06;
    noise.connect(bp).connect(ng).connect(ctx.destination);
    noise.start(t);

    // Falling zap.
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(900 + Math.random() * 400 - d * 300, t);
    osc.frequency.exponentialRampToValueAtTime(70 + Math.random() * 40, t + 0.14 + d * 0.1);
    og.gain.setValueAtTime(0.035 + d * 0.03, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16 + d * 0.1);
    osc.connect(og).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  } catch {
    /* no audio */
  }
}
