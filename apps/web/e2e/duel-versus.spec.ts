import { expect, test, type Page } from '@playwright/test';
async function start(page: Page, p1 = 'DeepSeek 娘', p2 = 'gpt') {
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
async function until(page: Page, fn: () => Promise<boolean>, limit = 200) {
  for (let n = 0; n < limit; n++) {
    if (await fn()) return;
    await page.clock.runFor(17);
  }
  expect(await fn()).toBe(true);
}
test('both players move independently, P2 attacks, pause clears keys, and rice can be interrupted', async ({
  page,
}, info) => {
  await start(page);
  const a = page.getByTestId('duel-fighter-0'),
    b = page.getByTestId('duel-fighter-1');
  await page.clock.runFor(500);
  await expect(b).toHaveAttribute('data-x', '680.0');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowLeft');
  await page.clock.runFor(220);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ArrowLeft');
  expect(Number(await a.getAttribute('data-x'))).toBeGreaterThan(280);
  expect(Number(await b.getAttribute('data-x'))).toBeLessThan(680);
  await page.keyboard.down('ArrowLeft');
  await until(
    page,
    async () =>
      Number(await b.getAttribute('data-x')) - Number(await a.getAttribute('data-x')) <= 55,
  );
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('KeyF');
  await page.clock.runFor(34);
  await expect(page.getByTestId('rice-bowl')).toBeVisible();
  await page.keyboard.press('Digit1');
  await until(page, async () => Number(await a.getAttribute('data-hp')) < 1000);
  await expect(page.getByTestId('rice-spill')).toBeVisible();
  await expect(a).toHaveAttribute('data-hp', '960');
  await page.screenshot({ path: info.outputPath('rice-spill-versus.png'), fullPage: true });
  await page.keyboard.down('ArrowRight');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.locator('.duel-p2-pad .held')).toHaveCount(0);
  const x = await b.getAttribute('data-x');
  expect(x).not.toBeNull();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(300);
  await expect(b).toHaveAttribute('data-x', x!);
  await page.keyboard.up('ArrowRight');
});
test('GPT catches a descending P2 and rice grants energy on completion', async ({ page }, info) => {
  await start(page, 'GPT 娘', 'deepseek');
  const a = page.getByTestId('duel-fighter-0'),
    b = page.getByTestId('duel-fighter-1');
  await page.keyboard.press('Digit9');
  await page.clock.runFor(700);
  await expect(b).toHaveAttribute('data-energy', '20');
  await page.keyboard.down('ArrowLeft');
  await until(
    page,
    async () =>
      Number(await b.getAttribute('data-x')) - Number(await a.getAttribute('data-x')) <= 58,
  );
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.clock.runFor(300);
  await page.keyboard.press('KeyF');
  await until(page, async () => (await b.getAttribute('data-action')) === 'grabbed');
  await expect(page.getByTestId('steady-catch-prop')).toBeVisible();
  await page.screenshot({ path: info.outputPath('steady-catch.png'), fullPage: true });
  await page.clock.runFor(600);
  await expect(b).toHaveAttribute('data-hp', '880');
});
test('Tangbao return shot can hit its owner and both touchscreen pads remain reachable', async ({
  page,
  isMobile,
}, info) => {
  await start(page, '豆包娘', 'gpt');
  const a = page.getByTestId('duel-fighter-0');
  if (isMobile) await page.getByRole('button', { name: '角色梗技能', exact: true }).tap();
  else await page.keyboard.press('KeyF');
  await page.clock.runFor(500);
  await expect(page.getByTestId('tangbao-prop')).toBeVisible();
  await until(page, async () => Number(await a.getAttribute('data-hp')) < 1000);
  await expect(a).toHaveAttribute('data-hp', '950');
  await page.getByRole('button', { name: 'P2 向右移动', exact: true }).scrollIntoViewIfNeeded();
  if (isMobile) await page.getByRole('button', { name: 'P2 跳跃', exact: true }).tap();
  else await page.getByRole('button', { name: 'P2 跳跃', exact: true }).click();
  await page.clock.runFor(100);
  expect(Number(await page.getByTestId('duel-fighter-1').getAttribute('data-y'))).toBeGreaterThan(
    0,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('two-player-pads.png'), fullPage: true });
});

test('P2 can win the whole match and replay preserves local mode and selected fighters', async ({
  page,
}, info) => {
  test.skip(
    info.project.name.startsWith('mobile'),
    'Shared keyboard match progression is covered on desktop.',
  );
  test.setTimeout(90000);
  await start(page, 'DeepSeek 娘', 'doubao');
  for (let i = 0; i < 420; i++) {
    const phase = await page.locator('.duel').getAttribute('data-phase');
    if (phase === 'done') break;
    if (phase !== 'fight') {
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowRight');
      await page.clock.runFor(500);
      continue;
    }
    const a = page.getByTestId('duel-fighter-0'),
      b = page.getByTestId('duel-fighter-1');
    const delta = Number(await a.getAttribute('data-x')) - Number(await b.getAttribute('data-x'));
    await page.keyboard.up(delta < 0 ? 'ArrowRight' : 'ArrowLeft');
    if (Math.abs(delta) > 55) await page.keyboard.down(delta < 0 ? 'ArrowLeft' : 'ArrowRight');
    else {
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowRight');
    }
    if (Math.abs(delta) < 76) await page.keyboard.press('Digit1');
    await page.clock.runFor(250);
  }
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowRight');
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('P2 获胜');
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText(
    'P1 DeepSeek 0 : 2 P2 豆包',
  );
  await page.screenshot({ path: info.outputPath('p2-wins.png'), fullPage: true });
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await page.clock.runFor(3100);
  await expect(page.locator('.duel')).toHaveAttribute('data-mode', 'versus');
  await expect(page.getByTestId('duel-fighter-1')).toHaveAttribute('data-hp', '1000');
  await page.clock.runFor(500);
  await expect(page.getByTestId('duel-fighter-1')).toHaveAttribute('data-x', '680.0');
});
