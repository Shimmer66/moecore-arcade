import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-10-01T09:00:00Z'));
});

test('grenade impact shakes and flashes the stage but reduced motion disables both', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await page.keyboard.press('KeyL');
  await page.clock.runFor(820);
  const shake = Math.hypot(
    Number(await world.getAttribute('data-shake-x')),
    Number(await world.getAttribute('data-shake-y')),
  );
  expect(shake).toBeGreaterThan(0.1);
  expect(Number(await world.getAttribute('data-impact-flash'))).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('grenade-impact.png'), fullPage: true });
  await page.getByRole('checkbox', { name: '减少动态效果' }).check();
  await page.keyboard.press('KeyL');
  await page.clock.runFor(820);
  await expect(world).toHaveAttribute('data-shake-x', '0.00');
  await expect(world).toHaveAttribute('data-shake-y', '0.00');
  await expect(world).toHaveAttribute('data-impact-flash', '0.000');
});

test('rendered projectile and effect nodes stay bounded by simulation counts', async ({ page }) => {
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await page.keyboard.down('KeyJ');
  await page.keyboard.down('KeyD');
  for (let i = 0; i < 20; i++) {
    await page.clock.runFor(100);
    const simulated = Number(await world.getAttribute('data-sim-projectiles'));
    const rendered = Number(await world.getAttribute('data-render-projectiles'));
    expect(rendered).toBeLessThanOrEqual(simulated);
    expect(Number(await world.getAttribute('data-render-effects'))).toBeLessThanOrEqual(
      Number(await world.getAttribute('data-sim-effects')),
    );
  }
  await page.keyboard.up('KeyJ');
  await page.keyboard.up('KeyD');
  expect(await page.locator('[data-shot]').count()).toBeLessThanOrEqual(
    Number(await world.getAttribute('data-render-projectiles')),
  );
});
