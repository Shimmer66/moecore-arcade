import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
  await page.getByLabel('演练起始位置', { exact: true }).selectOption('entry');
  await page.getByLabel('演练武器', { exact: true }).selectOption('homing');
});
test('boards a real elevator by jumping and rides its collision surface while firing', async ({
  page,
}, info) => {
  await page.getByLabel('演练目标', { exact: true }).selectOption('6');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await page.keyboard.down('KeyJ');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(2150);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Space');
  await page.clock.runFor(900);
  const lift = page.locator('[data-platform="moving"]').first();
  const y = Number(await world.getAttribute('data-y'));
  expect(y).toBeGreaterThan(0.2);
  expect(Math.abs(y - Number(await lift.getAttribute('data-top')))).toBeLessThan(0.04);
  await page.clock.runFor(700);
  const nextY = Number(await world.getAttribute('data-y'));
  expect(Math.abs(nextY - y)).toBeGreaterThan(0.25);
  expect(Math.abs(nextY - Number(await lift.getAttribute('data-top')))).toBeLessThan(0.04);
  await page.keyboard.up('KeyJ');
  await page.screenshot({ path: info.outputPath('riding-elevator.png'), fullPage: true });
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const before = await lift.getAttribute('data-top');
  await page.clock.runFor(1000);
  await expect(lift).toHaveAttribute('data-top', before!);
  await expect(world).toHaveAttribute('data-y', nextY.toFixed(2));
});
test('conveyor transports a stationary player and can be escaped with a jump', async ({
  page,
}, info) => {
  await page.getByLabel('演练目标', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await page.keyboard.down('KeyJ');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(3000);
  await page.keyboard.up('KeyD');
  const start = Number(await world.getAttribute('data-x'));
  expect(start).toBeGreaterThan(21);
  await page.clock.runFor(400);
  const moved = Number(await world.getAttribute('data-x'));
  expect(start - moved).toBeCloseTo(0.96, 1);
  await page.keyboard.press('Space');
  await page.clock.runFor(50);
  const airborne = Number(await world.getAttribute('data-x'));
  await page.clock.runFor(250);
  expect(Number(await world.getAttribute('data-x'))).toBeCloseTo(airborne, 1);
  expect(Number(await world.getAttribute('data-y'))).toBeGreaterThan(1);
  await page.keyboard.up('KeyJ');
  await expect(page.locator('[data-platform="conveyor"]').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('conveyor-jump.png'), fullPage: true });
});
