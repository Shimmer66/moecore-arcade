import { expect, test, type Page } from '@playwright/test';

const firstSolution = ['ArrowRight', 'ArrowRight', 'ArrowRight'];

async function enterSokoban(page: Page) {
  await page.goto('/#/games/sokoban');
  await expect(page.locator('.sokoban-board')).toBeVisible();
  await expect(page.getByRole('heading', { name: '初次搬运', exact: true })).toBeVisible();
}

test('loads the Fatfish Sokoban game from the arcade registry', async ({ page }) => {
  await enterSokoban(page);
  await expect(page.getByText('大肥鱼 · 搬家日记', { exact: true })).toBeVisible();
  await expect(page.locator('.sokoban-cell')).toHaveCount(42);
  expect(
    await page
      .locator('img')
      .evaluateAll((images) => images.every((image) => image.naturalWidth > 0)),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('completes the first tutorial and unlocks the next room', async ({ page }) => {
  await enterSokoban(page);
  for (const key of firstSolution) await page.keyboard.press(key);
  await expect(page.locator('.sokoban-level-result')).toBeVisible();
  await expect(page.getByText('这一角，收拾好啦！', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续下一关 →', exact: true }).click();
  await expect(page.getByRole('heading', { name: '借位搬运', exact: true })).toBeVisible();
});
