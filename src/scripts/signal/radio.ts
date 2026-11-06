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
