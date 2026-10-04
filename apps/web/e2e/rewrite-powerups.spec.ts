import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
  await page.getByRole('button', { name: '声音 开', exact: true }).click();
});
test('shoots open a cache, collects overclock, switches weapons and freezes its timer on pause', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  const loadout = page.locator('.rewrite-loadout-panel');
  if (!(await loadout.evaluate((element) => (element as HTMLDetailsElement).open)))
    await loadout.locator('summary').click();
  const world = page.locator('.rewrite-world');
  const cache = page.locator('[data-carrier-kind="cache"][data-carrier-drop="overclock"]').first();
  await expect(cache).toHaveAttribute('data-carrier-hp', '3');
  await page.keyboard.down('KeyJ');
  await page.clock.runFor(900);
  await expect(cache).toHaveAttribute('data-carrier-hp', '0');
  await expect(page.locator('[data-supply="overclock"]')).toBeVisible();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(820);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyJ');
  const timer = page.locator('[data-buff="overclock"][data-player="1"]');
  await expect(timer).toBeVisible();
  expect(Number(await world.getAttribute('data-overclock'))).toBeGreaterThan(10);
  await expect(world).toHaveAttribute('data-weapon', 'rapid');
  await page.getByRole('button', { name: 'P1 装备提示词步枪', exact: true }).click();
  await page.clock.runFor(50);
  await expect(world).toHaveAttribute('data-weapon', 'pulse');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const frozen = await timer.getAttribute('data-remaining');
  await page.clock.runFor(2000);
  await expect(timer).toHaveAttribute('data-remaining', frozen!);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(1000);
  expect(Number(frozen) - Number(await timer.getAttribute('data-remaining'))).toBeCloseTo(1, 1);
  const art = cache.locator('image');
  await expect(art).toHaveAttribute('href', /powerup-atlas-v1/);
  expect(
    await art.evaluate(async (el) => {
      const image = new Image();
      image.src = (el as SVGImageElement).href.baseVal;
      await image.decode();
      return image.naturalWidth;
    }),
  ).toBe(1536);
  await page.screenshot({ path: info.outputPath('cache-overclock.png'), fullPage: true });
});
test('down plus jump leaves an elevated ledge through real controls', async ({ page }, info) => {
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await page.keyboard.down('KeyJ');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(550);
  await page.keyboard.press('Space');
  await page.clock.runFor(750);
  await page.keyboard.up('KeyD');
  await expect(world).toHaveAttribute('data-y', '2.00');
  await page.keyboard.down('KeyS');
  await page.keyboard.press('Space');
  await page.clock.runFor(80);
  expect(Number(await world.getAttribute('data-y'))).toBeLessThan(2);
  expect(Number(await world.getAttribute('data-drop-through'))).toBeGreaterThan(0.2);
  await page.keyboard.up('KeyS');
  await page.clock.runFor(600);
  await page.keyboard.up('KeyJ');
  await expect(world).toHaveAttribute('data-y', '0.00');
  await page.screenshot({ path: info.outputPath('drop-through.png'), fullPage: true });
});
test('destroys a depth supply node and receives its independent buff in the foreground', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
  await page.getByLabel('演练目标', { exact: true }).selectOption('1');
  await page.getByLabel('演练起始位置', { exact: true }).selectOption('entry');
  await page.getByLabel('演练武器', { exact: true }).selectOption('pulse');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  await expect(page.locator('[data-depth-target="cache"]')).toBeVisible();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(800);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyJ');
  await page.clock.runFor(1200);
  await page.keyboard.up('KeyJ');
  await expect(page.locator('[data-depth-target="cache"]')).toHaveCount(0);
  await expect(page.locator('.rewrite-loadout-panel > summary')).toContainText(/超频\d+s/);
  expect(
    Number(await page.locator('[data-buff="overclock"]').getAttribute('data-remaining')),
  ).toBeGreaterThan(0);
  await expect(page.locator('.depth-battle')).toHaveAttribute('data-room', '1');
  await expect(page.locator('.depth-battle')).toHaveAttribute('data-cores', '3');
  await page.screenshot({ path: info.outputPath('depth-cache.png'), fullPage: true });
});
