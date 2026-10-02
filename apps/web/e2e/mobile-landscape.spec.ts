import { expect, test, type Page } from '@playwright/test';

async function expectOneScreen(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth + 1 &&
        document.documentElement.scrollHeight <= innerHeight + 10,
    ),
  ).toBe(true);
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Landscape touch layout runs on mobile.');
  await page.setViewportSize({ width: 844, height: 390 });
});

test('landscape duel keeps the fight and core controls side by side', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/games/duel');
  const quickStart = page.locator('.duel-mobile-quick');
  await expect(quickStart).toBeVisible();
  await quickStart.click();
  for (let step = 0; step < 40; step += 1) {
    if ((await page.locator('.duel').getAttribute('data-phase')) === 'fight') break;
    await page.clock.runFor(100);
  }
  await expect(page.locator('.duel')).toHaveAttribute('data-phase', 'fight');
  const arena = (await page.locator('.duel-arena').boundingBox())!;
  const joystick = (await page.locator('.duel-directions').boundingBox())!;
  const actions = (await page.locator('.duel-action-pad').boundingBox())!;
  expect(joystick.x).toBeLessThan(arena.x + arena.width / 2);
  expect(actions.x).toBeGreaterThan(arena.x + arena.width / 2);
  await expect(page.locator('.duel-coach')).toBeHidden();
  await expectOneScreen(page);
});

test('landscape arena exposes the stage, joystick and jump together', async ({ page }) => {
  await page.goto('/#/games/arena');
  const stage = (await page.locator('.playfield').boundingBox())!;
  const joystick = (await page.locator('.arena-stick').first().boundingBox())!;
  const jump = (await page.getByRole('button', { name: '跳跃', exact: true }).boundingBox())!;
  expect(joystick.x).toBeLessThan(stage.x + stage.width / 2);
  expect(jump.x).toBeGreaterThan(stage.x + stage.width / 2);
  await expect(page.locator('.arena-stick')).toHaveCSS('border-radius', '50%');
  await expect(page.getByRole('button', { name: '跳跃', exact: true })).toBeVisible();
  await expectOneScreen(page);
});

test('landscape run and gun removes keyboard copy and keeps touch controls beside play', async ({
  page,
}) => {
  await page.goto('/#/games/rewrite');
  await page.getByRole('button', { name: '单人出击', exact: true }).click();
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  const stage = (await page.locator('.rewrite-stage').boundingBox())!;
  const joystick = (await page.locator('.rewrite-joystick').boundingBox())!;
  const actions = (await page.locator('.rewrite-action-buttons').boundingBox())!;
  expect(joystick.x).toBeLessThan(stage.x + stage.width / 2);
  expect(actions.x).toBeGreaterThan(stage.x + stage.width / 2);
  await expect(page.locator('.rewrite-key-help')).toBeHidden();
  await expect(page.locator('.rewrite-joystick')).toHaveCSS('border-radius', '50%');
  await expectOneScreen(page);
});

test('landscape parkour keeps its primary start action in the first screen', async ({ page }) => {
  await page.goto('/#/games/parkour');
  await expect(page.getByRole('button', { name: '开始冒险', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});
