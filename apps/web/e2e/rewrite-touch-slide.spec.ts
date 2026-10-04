import { expect, test, type Locator, type Page } from '@playwright/test';

async function point(locator: Locator, x: number, y: number) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Control is not visible');
  return {
    x: box.x + box.width * (0.5 + x * 0.42),
    y: box.y + box.height * (0.5 + y * 0.42),
  };
}

async function moveStick(page: Page, joystick: Locator, pointerId: number, x: number, y: number) {
  const to = await point(joystick, x, y);
  await joystick.dispatchEvent('pointermove', {
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

test('a held touch slides through directions, recenters outside, and resumes on re-entry', async ({
  page,
}) => {
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const world = page.locator('.rewrite-world');
  const joystick = page.locator('.rewrite-joystick').first();
  await joystick.evaluate((element) => {
    element.setPointerCapture = () => {};
  });
  const right = await point(joystick, 0.85, 0);
  await joystick.dispatchEvent('pointerdown', {
    pointerId: 31,
    pointerType: 'touch',
    clientX: right.x,
    clientY: right.y,
  });
  await page.clock.runFor(120);
  const movedRight = Number(await world.getAttribute('data-x'));
  expect(movedRight).toBeGreaterThan(2);
  await moveStick(page, joystick, 31, 0.75, -0.75);
  expect(Number(await world.getAttribute('data-aim-y'))).toBeGreaterThan(0.6);
  const diagonalX = Number(await world.getAttribute('data-x'));
  await moveStick(page, joystick, 31, -0.85, 0);
  const movedLeft = Number(await world.getAttribute('data-x'));
  expect(movedLeft).toBeLessThan(diagonalX);
  await moveStick(page, joystick, 31, 1.5, 0);
  const stopped = await world.getAttribute('data-x');
  await page.clock.runFor(200);
  await expect(world).toHaveAttribute('data-x', stopped!);
  await moveStick(page, joystick, 31, 0.85, 0);
  expect(Number(await world.getAttribute('data-x'))).toBeGreaterThan(Number(stopped));
  await joystick.dispatchEvent('pointerup', { pointerId: 31, pointerType: 'touch' });
});

test('sliding P1 direction does not disturb P2 movement or a held fire touch', async ({ page }) => {
  await page.getByRole('button', { name: '双人协作', exact: true }).click();
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  const controls = page.locator('.rewrite-controls');
  const p1Joystick = controls.nth(0).locator('.rewrite-joystick');
  const p2Joystick = controls.nth(1).locator('.rewrite-joystick');
  const p2Fire = page.getByRole('button', { name: 'P2 射击', exact: true });
  for (const control of [p1Joystick, p2Joystick, p2Fire])
    await control.evaluate((element) => {
      element.setPointerCapture = () => {};
    });
  const p1Right = await point(p1Joystick, 0.85, 0);
  const p2Right = await point(p2Joystick, 0.85, 0);
  await p1Joystick.dispatchEvent('pointerdown', {
    pointerId: 41,
    pointerType: 'touch',
    clientX: p1Right.x,
    clientY: p1Right.y,
  });
  await p2Joystick.dispatchEvent('pointerdown', {
    pointerId: 42,
    pointerType: 'touch',
    clientX: p2Right.x,
    clientY: p2Right.y,
  });
  await p2Fire.dispatchEvent('pointerdown', { pointerId: 43, pointerType: 'touch' });
  await page.clock.runFor(150);
  const p2 = page.getByTestId('rewrite-partner');
  const p2x = Number(await p2.getAttribute('data-x'));
  await moveStick(page, p1Joystick, 41, -0.85, 0);
  expect(Number(await p2.getAttribute('data-x'))).toBeGreaterThan(p2x);
  expect(Number(await p2.locator('.actor-sprite').getAttribute('data-recoil'))).toBeGreaterThan(0);
  await p1Joystick.dispatchEvent('pointerup', { pointerId: 41, pointerType: 'touch' });
  await p2Joystick.dispatchEvent('pointerup', { pointerId: 42, pointerType: 'touch' });
  await p2Fire.dispatchEvent('pointerup', { pointerId: 43, pointerType: 'touch' });
});
