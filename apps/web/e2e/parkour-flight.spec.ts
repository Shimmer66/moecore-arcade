import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
  await page.goto('/#/games/parkour');
  await page.getByRole('button', { name: '单项练习', exact: true }).click();
  await expect(page.getByRole('region', { name: '开场故事' })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
  await page.getByRole('button', { name: /算力喷射/ }).click();
  await expect(page.getByRole('heading', { name: '算力喷射', exact: true })).toBeVisible();
}
async function snapshot(page: Page) {
  return page.locator('.flight-world').evaluate((world) => {
    const distance = Number(world.getAttribute('data-distance'));
    return {
      phase: world.getAttribute('data-phase'),
      distance,
      y: Number(world.getAttribute('data-y')),
      vy: Number(world.getAttribute('data-vy')),
      gates: [...world.querySelectorAll<HTMLElement>('.flight-gate')]
        .map((g) => ({ x: Number(g.dataset.x), center: Number(g.dataset.center) }))
        .filter((g) => g.x > distance - 1)
        .sort((a, b) => a.x - b.x),
      missiles: [...world.querySelectorAll<HTMLElement>('.flight-warning, .flight-missile')]
        .map((m) => ({ x: Number(m.dataset.x), y: Number(m.dataset.y) }))
        .filter((m) => m.x > distance - 1),
    };
  });
}

test('held controls navigate every gate and missile, pause safely, and retain flight on retry', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enter(page);
  await expect
    .poll(() =>
      page.locator('.flight-player img').evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: '开始喷射', exact: true }).click();
  const cdp =
    testInfo.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : null;
  let held = false;
  const setHeld = async (next: boolean) => {
    if (next === held) return;
    held = next;
    if (cdp) {
      const box = (await page.locator('.flight-thrust').boundingBox())!;
      await cdp.send('Input.dispatchTouchEvent', {
        type: next ? 'touchStart' : 'touchEnd',
        touchPoints: next ? [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] : [],
      });
    } else if (next) await page.keyboard.down('Space');
    else await page.keyboard.up('Space');
  };
  let paused = false;
  let capturedWarning = false;
  for (let index = 0; index < 1300; index++) {
    const s = await snapshot(page);
    if (s.phase === 'ended') break;
    let target = s.gates[0]?.center ?? 5;
    const missile = s.missiles[0];
    if (missile && Math.abs(target - missile.y) < 1.4)
      target = Math.max(1, Math.min(9, missile.y + (missile.y > 5 ? -2 : 2)));
    await setHeld(s.y + s.vy * 0.35 < target);
    if (!capturedWarning && (await page.locator('.flight-warning').count())) {
      capturedWarning = true;
      await page.screenshot({ path: testInfo.outputPath('flight-warning.png'), fullPage: true });
    }
    if (!paused && s.distance > 230) {
      paused = true;
      await page.getByRole('button', { name: '暂停', exact: true }).click();
      const tick = await page.locator('.flight-world').getAttribute('data-tick');
      await page.clock.runFor(5000);
      expect(await page.locator('.flight-world').getAttribute('data-tick')).toBe(tick);
      await expect(page.locator('.flight-world')).toHaveAttribute('data-thrust', 'false');
      await setHeld(false);
      await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    }
    await page.clock.runFor(50);
  }
  await setHeld(false);
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText(
    '算力没白烧，答案已送达',
  );
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('15/15 道限流');
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('零碰撞交付');
  expect(capturedWarning).toBe(true);
  expect(
    Number(await page.evaluate(() => localStorage.getItem('moecore:parkour:flight:best:v1'))),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => localStorage.getItem('moecore:parkour:rhythm:best:v1')),
  ).toBeNull();
  await page.screenshot({ path: testInfo.outputPath('flight-complete.png'), fullPage: true });
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.flight-world')).toHaveAttribute('data-phase', 'playing');
  expect(errors).toEqual([]);
});

test('idle fails and returns to the runner selection', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: '开始喷射', exact: true }).click();
  await page.clock.runFor(20000);
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('算力航班迫降了');
  await page.getByRole('button', { name: '返回航线选择', exact: true }).click();
  await expect(page.getByRole('group', { name: '选择关卡' })).toBeVisible();
  await expect(page.locator('.flight-world')).toHaveCount(0);
});

test('small-screen touch hold overheats and touch cancellation releases thrust', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await enter(page);
  await page.getByRole('button', { name: '开始喷射', exact: true }).click();
  const cdp = await page.context().newCDPSession(page);
  const control = (await page.locator('.flight-thrust').boundingBox())!;
  expect(control.y + control.height).toBeLessThanOrEqual(640);
  expect((await page.locator('.flight-world').boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: control.x + control.width / 2, y: control.y + control.height / 2 }],
  });
  await page.clock.runFor(4000);
  await expect(page.locator('.flight-thrust')).toContainText('过热冷却');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('.flight-world')).toHaveAttribute('data-thrust', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('flight-320-overheat.png'), fullPage: false });
  await page.getByRole('button', { name: '暂停', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '已暂停', exact: true })).toBeVisible();
});
