import { test, expect, type Page } from '@playwright/test';

const PAGES = [
  { path: '/', name: 'cs' },
  { path: '/en/', name: 'en' },
];

/** Elements that stick out past the right edge and are not clipped by an ancestor. */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const clipped = (el: Element): boolean => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX !== 'visible' || cs.position === 'fixed') return true;
      }
      return false;
    };
    const out: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      if (getComputedStyle(el).position === 'fixed' || el.closest('dialog:not([open])')) continue;
      if (clipped(el)) continue;
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
      out.push(`${el.tagName.toLowerCase()}${id}${cls} [${Math.round(r.left)}..${Math.round(r.right)} > ${vw}]`);
    }
    return out.slice(0, 15);
  });
}

for (const pg of PAGES) {
  test.describe(`${pg.name} page`, () => {
    test('loads without errors, no horizontal overflow', async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(pg.path);
      await page.waitForLoadState('networkidle');
      expect(errors, 'console / page errors').toEqual([]);

      const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
      expect(sw, 'document wider than viewport').toBeLessThanOrEqual(vw + 1);
      expect(await overflowing(page), 'elements past the right edge').toEqual([]);

      await page.screenshot({ path: info.outputPath(`${pg.name}-full.png`), fullPage: true });
    });

    test('tap targets are at least 24px', async ({ page }) => {
      await page.goto(pg.path);
      const small = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('a, button, [role="button"]'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            if (!r.width || s.visibility === 'hidden' || s.display === 'none' || el.closest('dialog:not([open])')) return false;
            if (el.classList.contains('skip')) return false;
            // Inline text links inside prose are exempt (WCAG 2.5.8 inline exception).
            if (el.closest('.prose, p') && s.display === 'inline') return false;
            return r.height < 24 || r.width < 24;
          })
          .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
      );
      expect(small).toEqual([]);
    });

    test('poem dialog opens, fits and closes', async ({ page }, info) => {
      await page.goto(pg.path);
      const cta = page.locator('.slayer-cta');
      await cta.scrollIntoViewIfNeeded();
      await cta.click();
      const dlg = page.locator('#slayer');
      await expect(dlg).toBeVisible();
      const close = page.locator('[data-slayer-close]');
      await expect(close).toBeInViewport();
      expect(await overflowing(page), 'dialog content past the right edge').toEqual([]);
      await page.screenshot({ path: info.outputPath(`${pg.name}-poem.png`) });
      await close.click();
      await expect(dlg).toBeHidden();
    });
  });
}

test('non-Czech browser is sent to /en/', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'en-US', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForURL('**/en/');
  await ctx.close();
});
