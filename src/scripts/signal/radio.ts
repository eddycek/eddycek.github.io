/*
 * Radio-style audio callouts for the FAILSAFE easter egg: a few synthesized
 * warning beeps (Web Audio) followed by a spoken callout (Web Speech API).
 * Everything is generated in the browser; no recorded samples are used.
 * Only ever called from a user click, so autoplay policies allow it.
 */
let ctx: AudioContext | null = null;

function beeps(pattern: { f: number; t: number; d: number }[]): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime + 0.02;
    for (const b of pattern) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = b.f;
      gain.gain.setValueAtTime(0, now + b.t);
      gain.gain.linearRampToValueAtTime(0.06, now + b.t + 0.01);
      gain.gain.setValueAtTime(0.06, now + b.t + b.d - 0.02);
      gain.gain.linearRampToValueAtTime(0, now + b.t + b.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + b.t);
      osc.stop(now + b.t + b.d + 0.02);
    }
  } catch {
    /* no audio available */
  }
}

function say(text: string, delayMs: number): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  window.setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    u.voice = voices.find((v) => /en[-_](US|GB)/i.test(v.lang) && /female|samantha|karen|serena|google/i.test(v.name))
      ?? voices.find((v) => /^en/i.test(v.lang)) ?? null;
    u.lang = u.voice?.lang ?? 'en-US';
    u.rate = 1.02;
    u.pitch = 1;
    u.volume = 0.9;
    synth.cancel();
    synth.speak(u);
  }, delayMs);
}

export function telemetryLost(): void {
  beeps([
    { f: 880, t: 0, d: 0.12 },
    { f: 660, t: 0.16, d: 0.12 },
    { f: 440, t: 0.32, d: 0.22 },
  ]);
  say('Telemetry lost', 600);
}

export function telemetryRecovered(): void {
  beeps([
    { f: 440, t: 0, d: 0.1 },
    { f: 880, t: 0.13, d: 0.14 },
  ]);
  say('Telemetry recovered', 350);
}
