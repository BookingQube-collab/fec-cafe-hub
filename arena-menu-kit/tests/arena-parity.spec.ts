// Arena menu parity + safety checks.
// Run against the PRODUCTION build (CSP is only active in production):
//   npm run build && npm start      (in another terminal)
//   ARENA_URL=http://127.0.0.1:<port>/menu/<cafe-id> \
//   SECOND_URL=http://127.0.0.1:<port>/menu/<another-cafe-id> \
//   npx playwright test arena-menu-kit/tests/arena-parity.spec.ts
// Optional: CLASSIC_URL for a café with menu_designs.enabled=false (classic fallback).
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const ARENA_URL = process.env.ARENA_URL!;
const SECOND_URL = process.env.SECOND_URL || process.env.CLASSIC_URL!;
const CLASSIC_URL = process.env.CLASSIC_URL;
const REFERENCE = 'file://' + path.resolve('arena-menu-kit/design/approved-design.html');

type Cfg = {
  groups: { key: string }[];
  categories: { group: string; items: unknown[] }[];
  stats: { enabled: boolean }[];
  product3d: { enabled: boolean };
  marquee: { enabled: boolean };
};

async function open(page: Page, url: string) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(t)) problems.push(`console ${m.type()}: ${t}`);
  });
  await page.goto(url);
  await page.waitForSelector('.arena-root[data-arena-ready="1"]', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const raw = await page.locator('.arena-root #menu-config').textContent();
  return { cfg: JSON.parse(raw!) as Cfg, problems };
}

test.describe('Public menus use the Arena design', () => {
  test.skip(!ARENA_URL || !SECOND_URL, 'Set ARENA_URL and SECOND_URL (or CLASSIC_URL)');

  test('every section present, no errors, no CSP violations', async ({ page }) => {
    const { cfg, problems } = await open(page, ARENA_URL);
    const items = cfg.categories.reduce((n, c) => n + c.items.length, 0);

    await expect(page.locator('.arena-root header.header .logo-img')).toHaveCount(1);
    await expect(page.locator('.arena-root .main-title .title-line')).toHaveCount(2);
    await expect(page.locator('.arena-root .side-title .title-line')).toHaveCount(2);
    await expect(page.locator('.arena-root .primary-btn')).toBeVisible();
    await expect(page.locator('.arena-root .card')).toHaveCount(2);
    await expect(page.locator('.arena-root .berry')).toHaveCount(9);
    await expect(page.locator('.arena-root .leaf')).toHaveCount(4);
    if (cfg.product3d.enabled) {
      expect(await page.evaluate(() => !!customElements.get('model-viewer'))).toBe(true);
      // the 3D model must actually load (fails if CSP blocks the .glb or blob: textures)
      await expect.poll(() => page.evaluate(() => !!(document.querySelector('#product-model') as any)?.loaded), { timeout: 20000 }).toBe(true);
    }
    if (cfg.marquee.enabled) await expect(page.locator('.arena-root .marquee-track span').first()).toBeVisible();
    await expect(page.locator('.arena-root .stat')).toHaveCount(cfg.stats.filter((s) => s.enabled).length);
    await expect(page.locator('.arena-root .seg-btn')).toHaveCount(1 + cfg.groups.length);
    await expect(page.locator('.arena-root .chip')).toHaveCount(cfg.categories.length);
    await expect(page.locator('.arena-root .panel')).toHaveCount(cfg.categories.length);
    await expect(page.locator('.arena-root .item')).toHaveCount(items);
    await expect(page.locator('.arena-root footer.footer .logo-img')).toHaveCount(1);
    expect(problems).toEqual([]);
  });

  test('interactions match the approved design', async ({ page }) => {
    const { cfg } = await open(page, ARENA_URL);
    const g1 = cfg.categories.filter((c) => c.group === cfg.groups[1].key).length;
    const before = await page.locator('.arena-root .berry.b1').getAttribute('src');
    await page.locator('.arena-root .card').nth(1).click();
    await page.waitForTimeout(3300);
    await expect(page.locator('.arena-root .panel:not(.hidden)')).toHaveCount(g1);
    expect(await page.locator('.arena-root .berry.b1').getAttribute('src')).not.toBe(before);
    await page.locator('.arena-root .seg-btn[data-filter="all"]').click();
    await page.waitForTimeout(1300);
    await expect(page.locator('.arena-root .panel:not(.hidden)')).toHaveCount(cfg.categories.length);
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.arena-root .menu-grid')!.getBoundingClientRect().top + scrollY));
    await page.waitForTimeout(700);
    await expect(page.locator('.arena-root .filter-bar')).toHaveClass(/stuck/);
  });

  test('another café also gets Arena; SPA cleanup leaves no leftovers', async ({ page }) => {
    await page.goto(SECOND_URL);
    await page.waitForSelector('.arena-root[data-arena-ready="1"]', { timeout: 15000 });
    await expect(page.locator('.arena-root')).toHaveCount(1);
    // navigating away from the arena page inside the SPA must clean up (no bubbles/listeners left behind)
    await page.goto(ARENA_URL);
    await page.waitForSelector('.arena-root[data-arena-ready="1"]');
    await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForTimeout(1500);
    await expect(page.locator('.arena-root')).toHaveCount(0);
    await expect(page.locator('.bubble-img')).toHaveCount(0);
  });

  test('explicitly disabled café keeps classic page', async ({ page }) => {
    test.skip(!CLASSIC_URL || CLASSIC_URL === SECOND_URL, 'Set CLASSIC_URL to a café with Arena off');
    await page.goto(CLASSIC_URL!);
    await page.waitForTimeout(2500);
    await expect(page.locator('.arena-root')).toHaveCount(0);
  });

  test('side-by-side screenshots for human review', async ({ browser }) => {
    for (const [name, url] of [['live', ARENA_URL], ['reference', REFERENCE]] as const) {
      for (const [w, h] of [[1440, 900], [390, 844]] as const) {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto(url);
        await page.waitForTimeout(4000);
        await page.mouse.move(-10, -10);
        await page.screenshot({ path: `test-results/arena/${w}-${name}-hero.png` });
        await page.evaluate(() => document.querySelector('.stats')!.scrollIntoView());
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `test-results/arena/${w}-${name}-menu.png` });
        await page.close();
      }
    }
  });
});
