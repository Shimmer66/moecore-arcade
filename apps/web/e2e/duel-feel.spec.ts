import { expect, test, type Page } from '@playwright/test';
async function practice(page: Page) {
  await page.goto('/#/games/duel');
  await page.getByRole('button', { name: /练招房/ }).click();
  await page.getByRole('button', { name: '选择DeepSeek 娘' }).click();
  await page.getByLabel('选择对手').selectOption('gpt');
  await page.clock.install({ time: new Date('2026-09-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-26T00:00:01Z'));
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await page.clock.runFor(3100);
}
async function until(page: Page, predicate: () => Promise<boolean>) {
  for (let n = 0; n < 140; n++) {
    if (await predicate()) return;
    await page.clock.runFor(17);
  }
  expect(await predicate()).toBe(true);
}
test('quick released direction still produces crouch heavy and backward dash; pause clears held feedback', async ({
  page,
}) => {
  await practice(page);
  const me = page.getByTestId('duel-fighter-0');
  await page.keyboard.down('KeyS');
  await expect(page.getByRole('button', { name: '蹲下', exact: true })).toHaveClass(/held/);
  await page.keyboard.press('KeyK');
  await page.keyboard.up('KeyS');
  await page.clock.runFor(40);
  await expect(me).toHaveAttribute('data-action', 'upper');
  await page.clock.runFor(800);
  const x = Number(await me.getAttribute('data-x'));
  await page.keyboard.down('KeyA');
  await page.keyboard.press('KeyH');
  await page.keyboard.up('KeyA');
  await page.clock.runFor(100);
  expect(Number(await me.getAttribute('data-x'))).toBeLessThan(x);
  await page.keyboard.down('KeyD');
  await expect(page.getByRole('button', { name: '向右移动', exact: true })).toHaveClass(/held/);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.locator('.duel-controls .held')).toHaveCount(0);
  await page.keyboard.up('KeyD');
});
test('real light hit offers a paid dash cancel and another hit preserves the combo', async ({
  page,
}, info) => {
  await practice(page);
  await page.getByLabel('无限能量').uncheck();
  await page.locator('.duel-arena').focus();
  const me = page.getByTestId('duel-fighter-0'),
    foe = page.getByTestId('duel-fighter-1');
  await page.keyboard.down('KeyD');
  await until(
    page,
    async () =>
      Number(await foe.getAttribute('data-x')) - Number(await me.getAttribute('data-x')) <= 55,
  );
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyJ');
  await until(page, async () => Number(await foe.getAttribute('data-hp')) < 1000);
  await expect(page.getByRole('button', { name: '冲刺', exact: true })).toHaveClass(/link-ready/);
  await page.keyboard.press('KeyH');
  await until(page, async () => (await me.getAttribute('data-action')) === 'dash');
  await expect(me).toHaveAttribute('data-energy', '85');
  await page.clock.runFor(50);
  await page.keyboard.press('KeyJ');
  await until(page, async () => (await foe.getAttribute('data-combo')) === '2');
  await expect(foe).toHaveAttribute('data-hp', '926');
  await page.screenshot({ path: info.outputPath('dash-link.png'), fullPage: true });
});
