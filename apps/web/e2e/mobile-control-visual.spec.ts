import { expect, test, type Locator, type Page } from '@playwright/test';

function colorAlpha(color: string): number {
  const values = color.match(/[\d.]+/g)?.map(Number) ?? [];
  return color.startsWith('rgba') ? (values[3] ?? 1) : 1;
}

async function expectTranslucent(locator: Locator) {
  await expect(locator).toBeVisible();
  const color = await locator.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(colorAlpha(color)).toBeLessThanOrEqual(0.25);
}

async function advanceDuelToFight(page: Page) {
  await page.clock.install();
  await page.goto('/#/games/duel');
  await page.locator('.duel-mobile-quick').click();
  for (let step = 0; step < 40; step += 1) {
    if ((await page.locator('.duel').getAttribute('data-phase')) === 'fight') return;
    await page.clock.runFor(100);
  }
  await expect(page.locator('.duel')).toHaveAttribute('data-phase', 'fight');
}

test.beforeEach(async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Touch visuals run on mobile.');
  await page.setViewportSize({ width: 390, height: 844 });
});

test('touch joysticks stay translucent while primary actions remain visible', async ({ page }) => {
  await advanceDuelToFight(page);
  await expectTranslucent(page.locator('.duel-directions'));
  await expect(page.getByRole('button', { name: '轻击', exact: true })).toBeVisible();

  await page.goto('/#/games/arena');
  await expectTranslucent(page.locator('.arena-stick'));
  await expect(page.getByRole('button', { name: '跳跃', exact: true })).toBeVisible();

  await page.goto('/#/games/rewrite');
  await page.getByRole('button', { name: '单人出击', exact: true }).click();
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  await expectTranslucent(page.locator('.rewrite-joystick'));
  await expect(page.getByRole('button', { name: '射击', exact: true })).toBeVisible();
});
