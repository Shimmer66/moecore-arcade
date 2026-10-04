import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-10-01T09:00:00Z'));
  await page.getByRole('button', { name: '声音 开', exact: true }).click();
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
  await page.getByLabel('演练起始位置', { exact: true }).selectOption('entry');
  await page.getByLabel('演练武器', { exact: true }).selectOption('flame');
});
test('fireball has a curved physical path, pauses exactly and retains its path with reduced motion', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(100);
  const first = page.locator('[data-shot="flame"]').first();
  const id = await first.getAttribute('data-shot-id');
  const shot = page.locator(`[data-shot-id="${id}"]`);
  const startY = Number(await shot.getAttribute('data-shot-y'));
  const startX = Number(await shot.getAttribute('data-shot-x'));
  await page.clock.runFor(150);
  expect(Math.abs(Number(await shot.getAttribute('data-shot-y')) - startY)).toBeGreaterThan(0.2);
  expect(Number(await shot.getAttribute('data-shot-x'))).toBeGreaterThan(startX + 1);
  const art = shot.locator('[data-projectile="fireball"]');
  expect(Number(await art.getAttribute('data-spin'))).toBeGreaterThan(0);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const frozen = await shot.getAttribute('transform');
  const spin = await art.getAttribute('data-spin');
  await page.clock.runFor(1000);
  await expect(shot).toHaveAttribute('transform', frozen!);
  await expect(art).toHaveAttribute('data-spin', spin!);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.getByRole('checkbox', { name: '减少动态效果' }).check();
  await page.clock.runFor(100);
  await expect(art).toHaveAttribute('data-spin', '0');
  expect(await shot.getAttribute('transform')).not.toBe(frozen);
  await page.screenshot({ path: info.outputPath('fireball-side.png'), fullPage: true });
});
test('depth fireballs orbit across the firing lane while travelling into the room', async ({
  page,
}, info) => {
  await page.getByLabel('演练目标', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(100);
  const id = await page.locator('[data-shot="flame"]').first().getAttribute('data-shot-id');
  const shot = page.locator(`[data-shot-id="${id}"]`);
  const x = Number(await shot.getAttribute('data-shot-x'));
  const y = Number(await shot.getAttribute('data-shot-y'));
  const z = Number(await shot.getAttribute('data-shot-z'));
  await page.clock.runFor(150);
  expect(Math.abs(Number(await shot.getAttribute('data-shot-x')) - x)).toBeGreaterThan(0.1);
  expect(Math.abs(Number(await shot.getAttribute('data-shot-y')) - y)).toBeGreaterThan(0.2);
  expect(Number(await shot.getAttribute('data-shot-z'))).toBeGreaterThan(z + 3);
  await expect(shot.locator('[data-projectile="fireball"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath('fireball-depth.png'), fullPage: true });
});
