import { expect, test, type Page } from '@playwright/test';
async function open(page: Page, name: string, foe: string) {
  await page.goto('/#/games/duel');
  await page.getByRole('button', { name: '选择' + name }).click();
  await page.getByRole('button', { name: /练招房/ }).click();
  await page.getByLabel('选择对手').selectOption(foe);
  await page.clock.install({ time: new Date('2026-09-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-26T00:00:01Z'));
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await page.clock.runFor(3100);
}
test('all three fighters render raster art, change poses and cast projectiles with matching effects', async ({
  page,
}, info) => {
  await open(page, 'DeepSeek 娘', 'gpt');
  const me = page.getByTestId('duel-fighter-0'),
    foe = page.getByTestId('duel-fighter-1');
  await expect(me.locator('[data-renderer="raster"]')).toHaveAttribute('data-pose', 'ready');
  await expect(foe.locator('[data-renderer="raster"]')).toHaveAttribute('data-pose', 'ready');
  await page.locator('image').evaluateAll((nodes) =>
    Promise.all(
      nodes.map((i) => {
        const im = new Image();
        im.src = i.getAttribute('href')!;
        return im.decode();
      }),
    ),
  );
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(135);
  await expect(me.locator('[data-renderer="raster"]')).toHaveAttribute('data-pose', 'jab_hit');
  await page.screenshot({ path: info.outputPath('webp-punch.png'), fullPage: true });
  await page.getByRole('button', { name: '结束练习', exact: true }).click();
  await page.getByRole('button', { name: '换角色', exact: true }).click();
  await page.getByRole('button', { name: '选择豆包娘' }).click();
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await page.clock.runFor(3100);
  await expect(me.locator('[data-renderer="raster"]')).toHaveAttribute('data-character', 'doubao');
  await page.keyboard.press('KeyU');
  await page.clock.runFor(450);
  await expect(page.locator('[data-effect-art="bubble"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath('webp-bubble.png'), fullPage: true });
  for (let n = 0; n < 80 && !(await page.locator('[data-effect-art="bubble_pop"]').count()); n++)
    await page.clock.runFor(17);
  await expect(page.locator('[data-effect-art="bubble_pop"]')).toBeVisible();
  await expect(page.locator('[data-effect-art="hit_heavy"]')).toBeVisible();
});
test('missing combat art falls back to a visible vector fighter', async ({ page }) => {
  await page.route(/\/ready(?:-[^/]*)?\.webp$/, (route) => route.abort());
  await open(page, 'DeepSeek 娘', 'gpt');
  const me = page.getByTestId('duel-fighter-0');
  await expect(me.locator('[data-renderer="raster"]')).toHaveCount(0);
  await expect(me.locator('[data-character="deepseek"]')).toBeVisible();
  await expect(me).toHaveAttribute('data-hp', '1000');
});
