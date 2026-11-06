# vaclaveder.cz

Personal site of Václav Eder. Concept "Signál a šum": a live telemetry aesthetic built with Astro and Canvas 2D.

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # astro check + static build into dist/
```

- Content: `src/content/cs.ts`, `src/content/en.ts` (schema in `types.ts`), contact details in `contact.ts`.
- Visuals: `src/scripts/signal/` (oscilloscope, spectrogram, flight-log trace, text decode).
- Deploy: push to `master` → GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`).
- Plan: `docs/plans/2026-11-06-redesign-v2.md`.

## Testing on phones and tablets

```bash
npx playwright install chromium webkit   # once
npm run test:responsive                  # build + Playwright on 6 phone/tablet profiles
npm run shots                            # per-section screenshots into shots/ (needs preview on :4322)
```

The same suite runs in CI on every pull request.

## Third-party assets

`public/sounds/telemetry-*.wav` are the stock EdgeTX voice prompts (`telemko.wav`, `telemok.wav`) from
[EdgeTX/edgetx-sdcard-sounds](https://github.com/EdgeTX/edgetx-sdcard-sounds) v2.12.3, licensed GPL-2.0, redistributed unmodified.
See `public/sounds/NOTICE.txt`.
