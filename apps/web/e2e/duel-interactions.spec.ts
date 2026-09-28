import { expect, test, type Page } from '@playwright/test';
async function open(page: Page, p1: string, p2: string) {
  await page.goto('/#/games/duel');
  await page.getByRole('button', { name: /双人对战/ }).click();
  await page.getByRole('button', { name: '选择' + p1 }).click();
  await page.getByLabel('选择对手').selectOption(p2);
  await page.clock.install({ time: new Date('2026-09-27T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-27T00:00:01Z'));
  await page.getByRole('button', { name: '开打 →', exact: true }).click();
  await page.clock.runFor(3100);
  await until(
    page,
    async () => (await page.locator('.duel').getAttribute('data-phase')) === 'fight',
  );
}
async function until(page: Page, fn: () => Promise<boolean>) {
  for (let i = 0; i < 220; i++) {
    if (await fn()) return;
    await page.clock.runFor(17);
  }
  expect(await fn()).toBe(true);
}
async function approach(page: Page) {
  const a = page.getByTestId('duel-fighter-0'),
    b = page.getByTestId('duel-fighter-1');
  await page.keyboard.down('ArrowLeft');
  await until(
    page,
    async () =>
      Number(await b.getAttribute('data-x')) - Number(await a.getAttribute('data-x')) <= 55,
  );
  await page.keyboard.up('ArrowLeft');
}
test('P2 steals the rice bowl and consumes the reward through ordinary inputs', async ({
  page,
}, info) => {
  await open(page, 'DeepSeek 娘', 'gpt');
  await approach(page);
  const a = page.getByTestId('duel-fighter-0'),
    b = page.getByTestId('duel-fighter-1');
  await page.keyboard.press('KeyF');
  await page.clock.runFor(34);
  await page.keyboard.press('Digit5');
  await until(page, async () => (await b.getAttribute('data-carrying-rice')) === 'true');
  await expect(a).toHaveAttribute('data-hp', '1000');
  await expect(b.getByTestId('rice-bowl')).toBeVisible();
  await page.screenshot({ path: info.outputPath('rice-stolen.png'), fullPage: true });
  await page.keyboard.press('Digit9');
  await page.clock.runFor(750);
  await expect(b).toHaveAttribute('data-energy', '20');
  await expect(a).toHaveAttribute('data-energy', '0');
  await expect(page.getByTestId('rice-bowl')).toHaveCount(0);
});
test('reclaiming rice and jumping into GPT creates an overload without unpaid slam damage', async ({
  page,
}, info) => {
  await open(page, 'GPT 娘', 'deepseek');
  await approach(page);
  const a = page.getByTestId('duel-fighter-0'),
    b = page.getByTestId('duel-fighter-1');
  await page.keyboard.press('Digit9');
  await page.clock.runFor(34);
  await page.keyboard.press('KeyO');
  await until(page, async () => (await a.getAttribute('data-carrying-rice')) === 'true');
  await page.clock.runFor(250);
  await page.keyboard.press('Digit1');
  await until(page, async () => (await b.getAttribute('data-carrying-rice')) === 'true');
  await page.clock.runFor(400);
  await page.keyboard.press('ArrowUp');
  await page.clock.runFor(300);
  await page.keyboard.press('KeyF');
  await until(page, async () => (await page.getByTestId('catch-overload').count()) > 0);
  await expect(a).toHaveAttribute('data-action', 'down');
  await expect(b).toHaveAttribute('data-action', 'down');
  await expect(b).toHaveAttribute('data-hp', '1000');
  await expect(page.getByTestId('rice-bowl')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('catch-overload.png'), fullPage: true });
  await page.clock.runFor(1600);
  await expect(a).toHaveAttribute('data-action', 'idle');
  await expect(b).toHaveAttribute('data-action', 'idle');
});
test('P2 heavy returns Doubao bubble to its sender and triggers signed-for delivery', async ({
  page,
}, info) => {
  await open(page, '豆包娘', 'gpt');
  await page.keyboard.press('KeyU');
  const bubble = page.getByTestId('duel-projectile');
  await until(
    page,
    async () => (await bubble.count()) > 0 && Number(await bubble.getAttribute('data-x')) >= 530,
  );
  await page.keyboard.press('Digit2');
  await until(
    page,
    async () => (await bubble.count()) > 0 && (await bubble.getAttribute('data-owner')) === '1',
  );
  await expect(page.getByTestId('return-parcel')).toBeVisible();
  await until(
    page,
    async () => Number(await page.getByTestId('duel-fighter-0').getAttribute('data-hp')) < 1000,
  );
  await expect(page.getByTestId('duel-fighter-0')).toHaveAttribute('data-hp', '900');
  await expect(page.getByTestId('parcel-label')).toContainText('挨打已签收');
  await page.screenshot({ path: info.outputPath('parcel-delivered.png'), fullPage: true });
});
