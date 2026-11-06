/*
 * Radio callouts for the FAILSAFE easter egg, using the stock EdgeTX English
 * voice prompts (telemko / telemok, GPL-2.0, see public/sounds/NOTICE.txt).
 * Falls back to the Web Speech API if the audio cannot play.
 * Only ever called from a user click, so autoplay policies allow it.
 */
const cache = new Map<string, HTMLAudioElement>();

function speak(text: string): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-GB';
  synth.cancel();
  synth.speak(u);
}

function play(src: string, fallback: string): void {
  try {
    let a = cache.get(src);
    if (!a) {
      a = new Audio(src);
      a.preload = 'auto';
      cache.set(src, a);
    }
    a.currentTime = 0;
    a.volume = 0.9;
    void a.play().catch(() => speak(fallback));
  } catch {
    speak(fallback);
  }
}

export const telemetryLost = (): void => play('/sounds/telemetry-lost.wav', 'Telemetry lost');
export const telemetryRecovered = (): void => play('/sounds/telemetry-recovered.wav', 'Telemetry recovered');

/*
 * Hit sound for each click into the scope: a short burst of static plus a falling
 * square "zap", synthesized with Web Audio. Gets harsher as signal integrity drops.
 */
let ctx: AudioContext | null = null;
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
