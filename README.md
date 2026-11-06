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
