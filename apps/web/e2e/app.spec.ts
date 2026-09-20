import { expect, test } from '@playwright/test';

test('the scaffold loads without advertising an unimplemented game', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page).toHaveTitle('萌芯游乐园 · MoeCore Arcade');
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  await expect(page.getByText('暂时还没有开放的游戏。')).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.locator('a[href*="/games/"]')).toHaveCount(0);
  await expect(page.locator('img')).toHaveCount(2);

  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) =>
          images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
        ),
    )
    .toBe(true);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
});

test('the entry remains available after a refresh', async ({ page }) => {
  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: '下一局，敬请期待' })).toBeVisible();
});
