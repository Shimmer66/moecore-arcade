import { expect, test, type Locator, type Page } from '@playwright/test';

async function center(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Control is not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function slide(page: Page, source: Locator, target: Locator, pointerId: number) {
  const to = await center(target);
  const hit = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest<HTMLButtonElement>('button')
        ?.getAttribute('aria-label') ?? '',
    to,
  );
  expect(hit).toBe(await target.getAttribute('aria-label'));
  await source.dispatchEvent('pointermove', {
    pointerId,
    pointerType: 'touch',
    clientX: to.x,
    clientY: to.y,
  });
  await page.clock.runFor(120);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-10-01T09:00:00Z'));
});

test('a held touch slides through directions and releases outside the dpad', async ({ page }) => {
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const world = page.locator('.rewrite-world');
  const right = page.getByRole('button', { name: '向右移动', exact: true });
  const upRight = page.getByRole('button', { name: '右上瞄准', exact: true });
  const left = page.getByRole('button', { name: '向左移动', exact: true });
  await right.evaluate((element) => {
    element.setPointerCapture = () => {};
  });
  await right.dispatchEvent('pointerdown', { pointerId: 31, pointerType: 'touch' });
  await page.clock.runFor(120);
  const movedRight = Number(await world.getAttribute('data-x'));
  expect(movedRight).toBeGreaterThan(2);
  await slide(page, right, upRight, 31);
  expect(Number(await world.getAttribute('data-aim-y'))).toBeGreaterThan(0.6);
  const diagonalX = Number(await world.getAttribute('data-x'));
  await slide(page, right, left, 31);
  const movedLeft = Number(await world.getAttribute('data-x'));
  expect(movedLeft).toBeLessThan(diagonalX);
  await right.dispatchEvent('pointermove', {
    pointerId: 31,
    pointerType: 'touch',
    clientX: 1,
    clientY: 1,
  });
  const stopped = await world.getAttribute('data-x');
  await page.clock.runFor(200);
  await expect(world).toHaveAttribute('data-x', stopped!);
  await right.dispatchEvent('pointerup', { pointerId: 31, pointerType: 'touch' });
});

test('sliding P1 direction does not disturb P2 movement or a held fire touch', async ({ page }) => {
  await page.getByRole('button', { name: '双人协作', exact: true }).click();
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  const p1Right = page.getByRole('button', { name: 'P1 向右移动', exact: true });
  const p1Left = page.getByRole('button', { name: 'P1 向左移动', exact: true });
  const p2Right = page.getByRole('button', { name: 'P2 向右移动', exact: true });
  const p2Fire = page.getByRole('button', { name: 'P2 射击', exact: true });
  for (const control of [p1Right, p2Right, p2Fire])
    await control.evaluate((element) => {
      element.setPointerCapture = () => {};
    });
  await p1Right.dispatchEvent('pointerdown', { pointerId: 41, pointerType: 'touch' });
  await p2Right.dispatchEvent('pointerdown', { pointerId: 42, pointerType: 'touch' });
  await p2Fire.dispatchEvent('pointerdown', { pointerId: 43, pointerType: 'touch' });
  await page.clock.runFor(150);
  const p2 = page.getByTestId('rewrite-partner');
  const p2x = Number(await p2.getAttribute('data-x'));
  await slide(page, p1Right, p1Left, 41);
  expect(Number(await p2.getAttribute('data-x'))).toBeGreaterThan(p2x);
  expect(Number(await p2.locator('.actor-sprite').getAttribute('data-recoil'))).toBeGreaterThan(0);
  await p1Right.dispatchEvent('pointerup', { pointerId: 41, pointerType: 'touch' });
  await p2Right.dispatchEvent('pointerup', { pointerId: 42, pointerType: 'touch' });
  await p2Fire.dispatchEvent('pointerup', { pointerId: 43, pointerType: 'touch' });
});
