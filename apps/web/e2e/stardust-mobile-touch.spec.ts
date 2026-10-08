import { expect, test, type Page } from '@playwright/test';

async function enterPractice(page: Page) {
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /练习模式/ }).click();
  await page.getByTestId('stardust-start').click();
  await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  for (const label of ['角色语音', '打击音效', '待机环境声'])
    await page.getByLabel(label).uncheck();
}

function touch(id: number, x: number, y: number) {
  return { id, x, y, radiusX: 2, radiusY: 2, force: 1 };
}

test('single-player mobile layout exposes a thumb-friendly controller without overflow', async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Touch layout is mobile-only.');
  await enterPractice(page);
  const controls = page.getByTestId('stardust-mobile-controls');
  await expect(controls).toBeVisible();
  await expect(page.locator('.controls')).toBeVisible();
  await expect(page.locator('.stand-controls')).toBeVisible();
  await expect(page.getByTestId('stardust-touch-joystick')).toBeVisible();
  for (const id of ['jump', 'light', 'heavy', 'barrage', 'ultimate', 'guard', 'detach'])
    await expect(page.getByTestId(`stardust-touch-${id}`)).toBeVisible();
  const bounds = await controls.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: info.outputPath('portrait-touch.png'), fullPage: true });

  await page.setViewportSize({ width: 320, height: 640 });
  const narrow = await controls.boundingBox();
  expect(narrow).not.toBeNull();
  expect(narrow!.x + narrow!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const button of await controls.locator('button').all()) {
    const buttonBounds = await button.boundingBox();
    expect(buttonBounds).not.toBeNull();
    expect(buttonBounds!.x).toBeGreaterThanOrEqual(narrow!.x);
    expect(buttonBounds!.x + buttonBounds!.width).toBeLessThanOrEqual(narrow!.x + narrow!.width);
  }
  await page.screenshot({ path: info.outputPath('narrow-touch.png'), fullPage: true });

  await page.setViewportSize({ width: 844, height: 390 });
  const landscape = await controls.boundingBox();
  expect(landscape).not.toBeNull();
  expect(landscape!.x + landscape!.width).toBeLessThanOrEqual(844);
  const arena = await page.getByTestId('stardust-arena').boundingBox();
  expect(arena).not.toBeNull();
  expect(landscape!.y).toBeGreaterThanOrEqual(arena!.y + arena!.height);
  await page.screenshot({ path: info.outputPath('landscape-touch.png'), fullPage: true });
});

test('real multi-touch keeps moving while a second thumb attacks and releases independently', async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Multi-touch runs on mobile.');
  await enterPractice(page);
  const client = await page.context().newCDPSession(page);
  const joystick = (await page.getByTestId('stardust-touch-joystick').boundingBox())!;
  const light = (await page.getByTestId('stardust-touch-light').boundingBox())!;
  const movement = touch(1, joystick.x + joystick.width * 0.88, joystick.y + joystick.height / 2);
  const action = touch(2, light.x + light.width / 2, light.y + light.height / 2);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [movement] });
  await page.clock.runFor(400);
  const beforeAttack = Number.parseFloat(
    await page.getByTestId('stardust-p1').evaluate((node) => (node as HTMLElement).style.left),
  );
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [movement, action],
  });
  await page.clock.runFor(64);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '493');
  const afterAttack = Number.parseFloat(
    await page.getByTestId('stardust-p1').evaluate((node) => (node as HTMLElement).style.left),
  );
  expect(afterAttack).toBeGreaterThan(beforeAttack);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const released = await page.getByTestId('stardust-p1').getAttribute('style');
  await page.clock.runFor(500);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('style', released!);
});

test('touch input buffers the next attack during the final recovery frames', async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Touch behavior runs on mobile.');
  await enterPractice(page);
  await page.getByTestId('stardust-arena').click();
  for (let step = 0; step < 40; step++) {
    const [first, second] = await page
      .locator('[data-testid="stardust-p1"], [data-testid="stardust-p2"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => Number.parseFloat((node as HTMLElement).style.left)),
      );
    if (Math.abs(second! - first!) <= 3) break;
    await page.keyboard.down(second! > first! ? 'KeyD' : 'KeyA');
    await page.clock.runFor(16);
    await page.keyboard.up(second! > first! ? 'KeyD' : 'KeyA');
  }
  await page.getByTestId('stardust-touch-light').dispatchEvent('pointerdown', {
    pointerId: 21,
    pointerType: 'touch',
  });
  await page.clock.runFor(160);
  await page.getByTestId('stardust-touch-heavy').dispatchEvent('pointerdown', {
    pointerId: 22,
    pointerType: 'touch',
  });
  await page.clock.runFor(320);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '480');
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-energy', '50');
});

test('joystick supports jump, crouch and detached stand movement', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Touch behavior runs on mobile.');
  await enterPractice(page);
  const joystick = page.getByTestId('stardust-touch-joystick');
  const box = (await joystick.boundingBox())!;
  await joystick.dispatchEvent('pointerdown', {
    pointerId: 31,
    pointerType: 'touch',
    clientX: box.x + box.width / 2,
    clientY: box.y + 4,
  });
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-pose', 'jump');
  await joystick.dispatchEvent('pointerup', { pointerId: 31, pointerType: 'touch' });
  await page.clock.runFor(600);
  await joystick.dispatchEvent('pointerdown', {
    pointerId: 32,
    pointerType: 'touch',
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height - 4,
  });
  await page.clock.runFor(32);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-pose', 'crouch');
  await joystick.dispatchEvent('pointerup', { pointerId: 32, pointerType: 'touch' });
  await page.clock.runFor(32);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-pose', 'idle');

  await page.getByTestId('stardust-touch-detach').dispatchEvent('pointerdown', {
    pointerId: 33,
    pointerType: 'touch',
  });
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-stand-mode', 'detached');
  const owner = await page.getByTestId('stardust-p1').getAttribute('style');
  const stand = page.getByTestId('stardust-stand-p1');
  const initial = Number(await stand.getAttribute('data-world-x'));
  await joystick.dispatchEvent('pointerdown', {
    pointerId: 34,
    pointerType: 'touch',
    clientX: box.x + box.width - 4,
    clientY: box.y + box.height / 2,
  });
  await page.clock.runFor(400);
  await joystick.dispatchEvent('pointerup', { pointerId: 34, pointerType: 'touch' });
  expect(Number(await stand.getAttribute('data-world-x'))).toBeGreaterThan(initial);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('style', owner!);
  await expect(page.getByTestId('stardust-touch-jump')).toBeDisabled();
});

test('guard, pointer cancellation and pause always clear held touch state', async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Touch behavior runs on mobile.');
  await enterPractice(page);
  const client = await page.context().newCDPSession(page);
  const joystick = (await page.getByTestId('stardust-touch-joystick').boundingBox())!;
  const guard = (await page.getByTestId('stardust-touch-guard').boundingBox())!;
  const movement = touch(7, joystick.x + joystick.width * 0.86, joystick.y + joystick.height / 2);
  const defense = touch(8, guard.x + guard.width / 2, guard.y + guard.height / 2);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [movement, defense],
  });
  await page.clock.runFor(64);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-pose', 'guard');
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.clock.runFor(32);
  await expect(page.getByTestId('stardust-p1')).not.toHaveAttribute('data-pose', 'guard');
  const cancelled = await page.getByTestId('stardust-p1').getAttribute('style');
  await page.clock.runFor(400);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('style', cancelled!);

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [movement, defense],
  });
  await page.clock.runFor(32);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(64);
  await expect(page.getByTestId('stardust-p1')).not.toHaveAttribute('data-pose', 'guard');
  const resumed = await page.getByTestId('stardust-p1').getAttribute('style');
  await page.clock.runFor(400);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('style', resumed!);
});

test('touch controller stays single-player and resets on host restart', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Touch layout is mobile-only.');
  await enterPractice(page);
  await page.getByTestId('stardust-touch-joystick').dispatchEvent('pointerdown', {
    pointerId: 41,
    pointerType: 'touch',
    clientX: 1000,
    clientY: 1000,
  });
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await page.clock.runFor(4300);
  await expect(page.getByTestId('stardust-mobile-controls')).toBeVisible();
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-hp', '500');
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-pose', 'idle');

  await page.reload();
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await page.getByTestId('stardust-start').click();
  await page.clock.runFor(4300);
  await expect(page.getByTestId('stardust-mobile-controls')).toHaveCount(0);
  await expect(page.locator('.controls')).toBeVisible();
});

test('desktop keeps keyboard controls and hides the touch controller', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('mobile'), 'Desktop-only visibility check.');
  await enterPractice(page);
  await expect(page.getByTestId('stardust-mobile-controls')).toBeHidden();
  await expect(page.locator('.controls')).toBeVisible();
  await expect(page.locator('.stand-controls')).toBeVisible();
});
