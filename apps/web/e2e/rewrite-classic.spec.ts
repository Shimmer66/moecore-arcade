import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-10-01T09:00:00Z'));
});

test('classic mode starts every persona from the same neutral one-hit loadout', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: /经典/ }).click();
  await expect(page.getByText(/经典试炼 · 一击倒地/)).toBeVisible();
  await expect(page.locator('.rewrite-hud,.rewrite-team-hud')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('classic-deployment.png'), fullPage: true });
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await expect(world).toHaveAttribute('data-difficulty', 'classic');
  await expect(world).toHaveAttribute('data-health', '1');
  await expect(world).toHaveAttribute('data-continues', '3');
  await expect(world).toHaveAttribute('data-grenades', '0');
  await expect(world).toHaveAttribute('data-weapon', 'pulse');
  await expect(page.getByTestId('rewrite-player')).toHaveAttribute('data-weapon', 'pulse');
  await expect(page.locator('.buff-rack').first()).toContainText('护盾 0/2');
  await expect(page.locator('.rewrite-hud')).toContainText('经典');
  await page.screenshot({ path: info.outputPath('classic-neutral-loadout.png'), fullPage: true });
  await page.getByText('战地手册 · 武器与生存技巧', { exact: true }).click();
  await expect(page.locator('.rewrite-guide')).toContainText('共享得分与 3 次续关');
});

test('classic selection survives a host restart without restoring combat progress', async ({
  page,
}) => {
  await page.getByRole('button', { name: /经典/ }).click();
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(300);
  await page.keyboard.up('KeyD');
  expect(Number(await world.getAttribute('data-x'))).toBeGreaterThan(2);
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(world).toHaveAttribute('data-difficulty', 'classic');
  await expect(world).toHaveAttribute('data-x', '2.00');
  await expect(world).toHaveAttribute('data-tick', '0');
  await expect(world).toHaveAttribute('data-continues', '3');
});
