# vaclaveder.cz

Personal site of Václav "eddycek" Eder. Astro (static), vanilla Canvas animations, no runtime deps.

## Content
- All copy lives in `src/content/cs.ts` and `src/content/en.ts` (same shape, `types.ts`). Keep both in sync.
- `src/content/slayer.ts` holds the full poem (verbatim, never edit wording).
- Contact details and social links: `src/content/contact.ts`.
- Style rules for copy: no em dash; use semicolons instead of colons in prose; "Dark Factory" capitalised; "kontent" instead of "obsah"; "independent" for artists; "MacBook" not "notebook".

## Workflow for every change
1. `npm run dev` for live work (http://localhost:4321).
2. `npm run test:responsive`: builds, then runs Playwright on iPhone SE, iPhone 15 Pro, Pixel 7, iPad Mini,
   iPad Pro 11 landscape and Galaxy Tab S4. Checks: no console errors, no horizontal overflow, tap targets ≥ 24px,
   poem dialog opens/fits/closes, non-Czech browsers redirect to /en/.
3. `npm run shots`: section-by-section screenshots per device into `shots/` (gitignored); look at them after layout changes.
   Needs a running preview on :4322 (`npx astro preview --port 4322`) or pass a base URL.
4. CI (`.github/workflows/ci.yml`) runs build, link check and the responsive suite on every PR; deploy runs on push to `master`.

First-time setup: `npm ci && npx playwright install chromium webkit`.
