import { expect, test } from '@playwright/test';

test('two players can move, fight, guard, pause, and restart', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.goto('/#/games/uncle');
  const game = page.locator('.uncle-game');
  await expect(game).toBeVisible();
  await expect(game).toHaveAttribute('data-phase', 'countdown');
  await page.clock.runFor(3200);
  await expect(game).toHaveAttribute('data-phase', 'fight');

  const p1 = page.getByTestId('uncle-fighter-0');
  const p2 = page.getByTestId('uncle-fighter-1');
  const p1Start = Number(await p1.getAttribute('data-x'));
  const p2Start = Number(await p2.getAttribute('data-x'));
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowLeft');
  await page.clock.runFor(900);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ArrowLeft');
  expect(Number(await p1.getAttribute('data-x'))).toBeGreaterThan(p1Start);
  expect(Number(await p2.getAttribute('data-x'))).toBeLessThan(p2Start);

  await page.keyboard.down('ArrowDown');
  await page.keyboard.press('KeyF');
  await page.clock.runFor(400);
  await page.keyboard.up('ArrowDown');
  expect(Number(await p2.getAttribute('data-hp'))).toBeLessThan(100);
  expect(Number(await p2.getAttribute('data-hp'))).toBeGreaterThanOrEqual(90);

  await page.keyboard.press('KeyG');
  await page.clock.runFor(700);
  expect(Number(await p2.getAttribute('data-hp'))).toBeLessThan(90);

  const timer = await game.getAttribute('data-timer');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.clock.runFor(3000);
  await expect(game).toHaveAttribute('data-timer', timer!);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();

  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByTestId('uncle-fighter-0')).toHaveAttribute('data-hp', '100');
  await page.screenshot({ path: testInfo.outputPath('uncle-battle.png'), fullPage: true });
});

test('narrow viewport keeps both fighters and controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/#/games/uncle');
  await expect(page.locator('.uncle-game')).toBeVisible();
  await expect(page.getByText('P1 锅铲舅', { exact: true })).toBeVisible();
  await expect(page.getByText('P2 保温杯舅', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
