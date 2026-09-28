import { test, expect, type Page } from '@playwright/test';
async function installClock(page: Page) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
}
async function open(page: Page) {
  await installClock(page);
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '开始整活', exact: true }).click();
}
async function walk(page: Page, ms: number) {
  await page.keyboard.down('KeyD');
  await page.clock.runFor(ms);
  await page.keyboard.up('KeyD');
}
async function walkTo(page: Page, x: number) {
  await page.keyboard.down('KeyD');
  for (let i = 0; i < 50; i++) {
    if (Number(await page.getByTestId('glitch-player').getAttribute('data-x')) >= x) break;
    await page.clock.runFor(100);
  }
  await page.keyboard.up('KeyD');
}
test('opens the new adventure, accepts movement and freezes both the world and event during pause', async ({
  page,
}, info) => {
  await installClock(page);
  await page.goto('/');
  await page.getByRole('button', { name: /别乱生成/ }).click();
  await page.getByRole('button', { name: '开始整活', exact: true }).click();
  if (info.project.name.startsWith('mobile')) {
    const button = page.getByRole('button', { name: '向右移动', exact: true });
    await button.scrollIntoViewIfNeeded();
    const r = (await button.boundingBox())!;
    const c = await page.context().newCDPSession(page);
    await c.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }],
    });
    await page.clock.runFor(500);
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await c.detach();
  } else await walk(page, 500);
  expect(Number(await page.getByTestId('glitch-player').getAttribute('data-x'))).toBeGreaterThan(
    120,
  );
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const position = await page.getByTestId('glitch-player').getAttribute('transform');
  const phase = await page.locator('.glitch-game').getAttribute('data-glitch');
  await page.clock.runFor(6000);
  expect(await page.getByTestId('glitch-player').getAttribute('transform')).toBe(position);
  await expect(page.locator('.glitch-game')).toHaveAttribute('data-glitch', phase!);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('generated-world.png'), fullPage: true });
});
test('rescues a real fall, uses inverted gravity, clears all three rooms and resets', async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  await walk(page, 2200);
  await expect(page.locator('.glitch-game')).toHaveAttribute('data-phase', 'rescue');
  const stars = await page.getByTestId('glitch-stars').textContent();
  await page.getByRole('button', { name: '拉我回来' }).click();
  await expect(page.locator('.glitch-game')).toHaveAttribute('data-glitch', 'fixed');
  await expect(page.getByTestId('glitch-stars')).toHaveText(stars!);
  await walk(page, 2000);
  await expect(page.locator('.glitch-game')).toHaveAttribute('data-phase', 'clear');
  await page.getByRole('button', { name: '下一场事故' }).click();
  await walk(page, 1700);
  await page.clock.runFor(1400);
  await expect(page.locator('.glitch-game')).toHaveAttribute('data-glitch', 'active');
  expect(Number(await page.getByTestId('glitch-player').getAttribute('data-y'))).toBeLessThan(110);
  await expect(page.getByTestId('glitch-stars')).toHaveText('2/3');
  await page.keyboard.press('KeyE');
  await walk(page, 2100);
  await expect(page.locator('.glitch-game')).toHaveAttribute('data-phase', 'clear');
  await page.getByRole('button', { name: '下一场事故' }).click();
  await walkTo(page, 345);
  await page.keyboard.down('KeyD');
  await page.keyboard.press('Space');
  await page.clock.runFor(650);
  await page.keyboard.press('KeyE');
  await page.clock.runFor(2000);
  await page.keyboard.up('KeyD');
  await expect(page.locator('.glitch-game')).toHaveAttribute('data-phase', 'clear');
  await page.getByRole('button', { name: '看看事故报告' }).click();
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('三关完成');
  await page.getByRole('button', { name: '再来一局' }).click();
  await expect(page.locator('.glitch-game')).toHaveAttribute('data-level', '0');
  await expect(page.locator('.glitch-game')).toHaveAttribute('data-phase', 'ready');
  await expect(page.getByTestId('glitch-stars')).toHaveText('0/3');
});
