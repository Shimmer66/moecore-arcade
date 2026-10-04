import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-10-01T09:00:00Z'));
  await page.getByRole('button', { name: '声音 开', exact: true }).click();
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
  await page.getByLabel('演练目标', { exact: true }).selectOption('7');
});
test('boss practice keeps three real heart cores and prevents early boss damage', async ({
  page,
}, info) => {
  await page.getByLabel('演练武器', { exact: true }).selectOption('pulse');
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(550);
  await page.keyboard.up('KeyD');
  const boss = page.locator('[data-enemy="boss"]');
  const hearts = page.locator('[data-enemy="heart"]');
  await expect(hearts).toHaveCount(3);
  const bossHp = await boss.getAttribute('data-target-hp');
  const heartHp = await hearts.evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('data-target-hp'))),
  );
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyA');
  await page.keyboard.down('KeyJ');
  await page.clock.runFor(900);
  await page.keyboard.up('KeyJ');
  await page.keyboard.up('KeyA');
  await page.keyboard.up('ShiftLeft');
  await expect(boss).toHaveAttribute('data-target-hp', bossHp!);
  const after = await hearts.evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('data-target-hp'))),
  );
  expect(after.some((hp, index) => hp < heartHp[index]!)).toBe(true);
  await expect(page.getByText(/心核保护 · 剩余/)).toBeVisible();
  const image = hearts.first().locator('image');
  await expect(image).toHaveAttribute('href', /neural-nest-atlas-v1/);
  expect(
    await image.evaluate(async (el) => {
      const art = new Image();
      art.src = (el as SVGImageElement).href.baseVal;
      await art.decode();
      return art.naturalWidth;
    }),
  ).toBe(1254);
  await page.screenshot({ path: info.outputPath('heart-protected-boss.png'), fullPage: true });
});
test('entry route activates a pod, spawns a bounded larva and accepts real laser damage', async ({
  page,
}, info) => {
  await page.getByLabel('演练起始位置', { exact: true }).selectOption('entry');
  await page.getByLabel('演练武器', { exact: true }).selectOption('laser');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const pods = page.locator('[data-enemy="pod"]');
  await page.keyboard.down('KeyD');
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Space');
    await page.clock.runFor(650);
  }
  await page.keyboard.up('KeyD');
  await expect(pods.first()).toBeVisible();
  await page.clock.runFor(800);
  const larva = page.locator('[data-enemy="larva"]').first();
  await expect(larva).toBeVisible();
  await expect(larva.locator('image')).toHaveAttribute('href', /neural-nest-atlas-v1/);
  const pod = pods.first();
  const podId = await pod.getAttribute('data-target-id');
  const hp = Number(await pod.getAttribute('data-target-hp'));
  await page.keyboard.down('KeyJ');
  await page.clock.runFor(700);
  await page.keyboard.up('KeyJ');
  await expect
    .poll(async () => {
      const target = page.locator(`[data-target-id="${podId}"]`);
      return (await target.count()) ? Number(await target.getAttribute('data-target-hp')) : 0;
    })
    .toBeLessThan(hp);
  await page.screenshot({ path: info.outputPath('nest-pod-larva.png'), fullPage: true });
});
