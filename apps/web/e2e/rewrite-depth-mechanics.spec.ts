import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-30T09:00:00Z'));
  await page.getByRole('button', { name: '声音 开', exact: true }).click();
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
});
test('up moves toward the live energy field instead of jumping and cannot skip its cores', async ({
  page,
}, info) => {
  await page.getByLabel('演练目标', { exact: true }).selectOption('1');
  await page.getByLabel('演练起始位置', { exact: true }).selectOption('entry');
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  const world = page.locator('.rewrite-world'),
    base = page.locator('.depth-battle');
  await page.keyboard.down('KeyW');
  await page.clock.runFor(1800);
  await page.keyboard.up('KeyW');
  await expect(world).toHaveAttribute('data-depth-z', '2.40');
  await expect(world).toHaveAttribute('data-y', '0.00');
  expect(Number(await world.getAttribute('data-health'))).toBeLessThan(3);
  await expect(base).toHaveAttribute('data-room', '1');
  await expect(base).toHaveAttribute('data-cores', '3');
  await expect(page.getByTestId('depth-energy-field')).toHaveAttribute('data-powered', 'true');
  await page.keyboard.press('KeyK');
  await page.clock.runFor(200);
  expect(Number(await world.getAttribute('data-y'))).toBeGreaterThan(1);
  await page.screenshot({ path: info.outputPath('powered-field.png'), fullPage: true });
});
test('aligned nodes expose honest windows while the main boss remains protected', async ({
  page,
}, info) => {
  await page.getByLabel('演练目标', { exact: true }).selectOption('5');
  await page.getByLabel('演练武器', { exact: true }).selectOption('laser');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const base = page.locator('.depth-battle');
  const boss = page.locator('[data-depth-target="boss"]');
  const nodes = page.locator('[data-depth-target="head"]');
  await expect(nodes).toHaveCount(4);
  const hp = await boss.getAttribute('data-target-hp');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(1200);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyJ');
  await page.clock.runFor(900);
  await page.keyboard.up('KeyJ');
  await expect(boss).toHaveAttribute('data-target-hp', hp!);
  await expect(base).toHaveAttribute('data-guards', '4');
  const head = nodes.filter({ has: page.locator('image') }).first();
  const states = new Set<string>();
  for (let i = 0; i < 15; i++) {
    states.add((await head.getAttribute('data-open'))!);
    await page.clock.runFor(200);
  }
  expect(states.has('true') && states.has('false')).toBe(true);
  const image = head.locator('image');
  await expect(image).toHaveAttribute('href', /depth-node-atlas/);
  expect(
    await image.evaluate(async (el) => {
      const art = new Image();
      art.src = (el as SVGImageElement).href.baseVal;
      await art.decode();
      return art.naturalWidth;
    }),
  ).toBe(1254);
  await page.screenshot({ path: info.outputPath('aligned-node-boss.png'), fullPage: true });
});
