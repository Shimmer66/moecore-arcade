import { expect, test, type Page } from '@playwright/test';

async function practice(page: Page) {
  await page.goto('/#/games/duel');
  await expect(page.getByRole('button', { name: /练招房/ })).toBeVisible();
  await page.clock.install({ time: new Date('2026-09-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-26T00:00:01Z'));
  await page.getByRole('button', { name: /练招房/ }).click();
  await page.getByRole('button', { name: '选择DeepSeek 娘' }).click();
  await page.getByLabel('选择对手').selectOption('gpt');
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await page.clock.runFor(3100);
  await until(
    page,
    async () => (await page.locator('.duel').getAttribute('data-phase')) === 'fight',
  );
}
async function until(page: Page, predicate: () => Promise<boolean>) {
  for (let i = 0; i < 120; i++) {
    if (await predicate()) return;
    await page.clock.runFor(17);
  }
  expect(await predicate()).toBe(true);
}

test('normal inputs perform launcher, aerial chase and slam with scaled damage', async ({
  page,
}, info) => {
  await practice(page);
  const me = page.getByTestId('duel-fighter-0'),
    foe = page.getByTestId('duel-fighter-1');
  await page.keyboard.down('KeyD');
  await until(
    page,
    async () =>
      Number(await foe.getAttribute('data-x')) - Number(await me.getAttribute('data-x')) <= 55,
  );
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS');
  await page.keyboard.press('KeyK');
  await until(page, async () => (await me.getAttribute('data-action')) === 'upper');
  await page.keyboard.up('KeyS');
  await until(page, async () => (await foe.getAttribute('data-action')) === 'launched');
  await page.keyboard.press('Space');
  await until(page, async () => (await me.getAttribute('data-action')) === 'jump');
  await page.keyboard.press('KeyJ');
  await until(page, async () => (await foe.getAttribute('data-combo')) === '2');
  expect(Number(await me.getAttribute('data-y'))).toBeGreaterThan(0);
  expect(Number(await foe.getAttribute('data-y'))).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('aerial-chase.png'), fullPage: true });
  await page.keyboard.press('KeyK');
  await until(page, async () => (await foe.getAttribute('data-action')) === 'down');
  await expect(foe).toHaveAttribute('data-hp', '815');
  await expect(foe).toHaveAttribute('data-combo', '3');
  await page.screenshot({ path: info.outputPath('aerial-slam.png'), fullPage: true });
  await page.clock.runFor(1400);
  await expect(me).toHaveAttribute('data-y', '0.0');
  await expect(foe).toHaveAttribute('data-y', '0.0');
});

test('dash and double jump are accessible on the control pad and respect reduced motion', async ({
  page,
  isMobile,
}, info) => {
  await practice(page);
  const me = page.getByTestId('duel-fighter-0');
  const press = async (name: string) => {
    const button = page.getByRole('button', { name, exact: true });
    if (isMobile) await button.tap();
    else await button.click();
  };
  await press('冲刺');
  await page.clock.runFor(84);
  expect(Number(await me.getAttribute('data-x'))).toBeGreaterThan(280);
  await expect(page.getByTestId('dash-afterimages')).toBeVisible();
  await page.screenshot({ path: info.outputPath('dash-afterimages.png'), fullPage: true });
  await press('跳跃');
  await page.clock.runFor(100);
  await expect(me).toHaveAttribute('data-jumps', '1');
  await press('跳跃');
  await page.clock.runFor(84);
  await expect(me).toHaveAttribute('data-jumps', '2');
  await press('冲刺');
  await page.clock.runFor(84);
  await expect(me).toHaveAttribute('data-air-dash-used', 'true');
  await page.clock.runFor(1300);
  await expect(me).toHaveAttribute('data-y', '0.0');
  await page.getByRole('checkbox', { name: '减少动态效果' }).check();
  await press('冲刺');
  await page.clock.runFor(84);
  await expect(page.getByTestId('dash-afterimages')).toHaveCount(0);
  if (isMobile) await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '冲刺', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: '冲刺', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('control-pad.png'), fullPage: true });
});
