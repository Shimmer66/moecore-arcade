import { expect, test } from '@playwright/test';
import { games } from '../src/games/registry';

test('game pages return to the catalog and the dock reaches About', async ({ page }) => {
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('heading', { level: 1, name: 'AI 娘闯关' })).toBeVisible();

  await page.getByRole('button', { name: '返回游戏列表' }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page).toHaveURL(/#games$/);
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('#games').evaluate((node) => node.getBoundingClientRect().top))
    .toBeLessThan(100);

  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '加入共创' })
    .click();
  await expect(page).toHaveURL(/#about$/);
  await expect(page.getByRole('heading', { name: '一点灵感，就能开始。' })).toBeVisible();
});

test('all games appear and catalogue art uses display-sized images', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.catalog-card')).toHaveCount(games.length);
  const portrait = page.getByRole('button', { name: /AI 娘消消乐/ }).locator('img');
  await portrait.scrollIntoViewIfNeeded();
  await expect(portrait).toHaveAttribute('src', /gpt-portrait.*\.webp/);
  await expect
    .poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
});

test('the game toolbar uses the same title as its catalogue card', async ({ page }) => {
  await page.goto('/#/games/sokoban');
  await expect(page.getByRole('heading', { level: 1, name: '大肥鱼 · 搬家日记' })).toBeVisible();
});

test('skip link focuses game content without leaving the current game', async ({ page }) => {
  await page.goto('/#/games/duel');
  await page.getByRole('link', { name: '跳到主要内容' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/games\/duel$/);
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(
    page.getByRole('heading', { level: 1, name: 'DeepSeek 娘：推演对决' }),
  ).toBeVisible();
});
