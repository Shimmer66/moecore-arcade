import { expect, test } from '@playwright/test';

test('game pages return to the catalog and anchor links land on their sections', async ({
  page,
}) => {
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('heading', { level: 1, name: 'AI 娘闯关' })).toBeVisible();

  const discover = page.getByRole('link', { name: '发现游戏' });
  if (await discover.isVisible()) {
    await discover.click();
  } else {
    await page.getByRole('button', { name: '返回游戏列表' }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await page.getByRole('link', { name: '发现小游戏' }).click();
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

test('home cover art uses display-sized images', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero-character-front');
  await expect(hero).toHaveJSProperty('complete', true);
  await expect(hero).toHaveAttribute('src', /gpt-portrait.*\.webp/);
  await expect(page.locator('.catalog-card.tone-lav img').first()).toHaveAttribute(
    'src',
    /gpt-portrait.*\.webp/,
  );
});
