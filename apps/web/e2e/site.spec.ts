import { expect, test } from '@playwright/test';

test('game pages return to the catalog and anchor links land on their sections', async ({
  page,
}) => {
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('heading', { level: 1, name: '幻觉防线' })).toBeVisible();

  const discover = page.getByRole('link', { name: '发现游戏' });
  if (await discover.isVisible()) {
    await discover.click();
  } else {
    await page.getByRole('button', { name: '返回游戏列表' }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
  }
  await expect(page).toHaveURL(/#games$/);
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('#games').evaluate((node) => node.getBoundingClientRect().top))
    .toBeLessThan(100);

  const about = page.getByRole('link', { name: '关于', exact: true });
  if (await about.isVisible()) await about.click();
  else await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: '一点灵感，就能开始。' })).toBeVisible();
});

test('home catalogue renders all current games with display-sized art', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.catalog-card')).toHaveCount(8);
  const portraits = page.locator('.catalog-portrait');
  await expect(portraits).toHaveCount(8);
  await expect
    .poll(() =>
      portraits.evaluateAll((images) =>
        images.every(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0 &&
            (image.currentSrc.startsWith('data:image/svg+xml') ||
              /\.(?:webp|svg)(?:$|\?)/.test(image.currentSrc)),
        ),
      ),
    )
    .toBe(true);
});
