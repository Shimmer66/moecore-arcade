import { expect, test, type Page } from '@playwright/test';

async function enterParkour(page: Page) {
  await page.clock.install();
  await page.goto('/#/games/parkour');
  await expect(page.getByRole('button', { name: '开始冲刺', exact: true })).toBeVisible();
  await expect(page.locator('.runner-world')).toHaveAttribute('data-phase', 'ready');
}
async function startParkour(page: Page) {
  await page.getByRole('button', { name: '开始冲刺', exact: true }).click();
  await page.clock.runFor(3300);
  await expect(page.locator('.runner-world')).toHaveAttribute('data-phase', 'running');
}

test('parkour and match3 are registered independently and the runner fits the viewport', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /AI 娘消消乐/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /AI 娘星潮跑酷/ })).toBeVisible();
  await page.getByRole('button', { name: /AI 娘星潮跑酷/ }).click();
  await expect(page.getByRole('button', { name: '开始冲刺', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '选择 Claude', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择 Claude', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('parkour-ready.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('waiting for start does not move the game and keyboard inputs perform a double jump and slide', async ({
  page,
}) => {
  await enterParkour(page);
  await page.clock.runFor(5000);
  await expect(page.getByTestId('runner-distance')).toHaveText('0');
  await startParkour(page);
  await page.keyboard.press('Space');
  await page.clock.runFor(120);
  const firstY = Number(await page.getByTestId('runner-player').getAttribute('data-y'));
  expect(firstY).toBeGreaterThan(0);
  await page.keyboard.press('ArrowUp');
  await page.clock.runFor(120);
  expect(Number(await page.getByTestId('runner-player').getAttribute('data-y'))).toBeGreaterThan(
    firstY,
  );
  await page.keyboard.down('ArrowDown');
  await page.clock.runFor(400);
  await expect(page.getByTestId('runner-player')).toHaveAttribute('data-pose', 'slide');
  await page.keyboard.up('ArrowDown');
  await page.clock.runFor(100);
  await expect(page.getByTestId('runner-player')).toHaveAttribute('data-pose', 'run');
});

test('touch buttons and swipe gestures control the player', async ({ page }) => {
  await enterParkour(page);
  await startParkour(page);
  await page.getByRole('button', { name: '跳跃', exact: true }).click();
  await page.clock.runFor(100);
  await expect(page.getByTestId('runner-player')).toHaveAttribute('data-pose', 'jump');
  await page.getByRole('button', { name: '滑铲', exact: true }).click();
  await page.clock.runFor(200);
  await expect(page.getByTestId('runner-player')).toHaveAttribute('data-pose', 'slide');
  await page.clock.runFor(700);
  const area = (await page.locator('.runner-world').boundingBox())!;
  await page.mouse.move(area.x + area.width * 0.5, area.y + 100);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width * 0.5, area.y + 150);
  await page.mouse.up();
  await page.clock.runFor(100);
  await expect(page.getByTestId('runner-player')).toHaveAttribute('data-pose', 'slide');
});

test('background and manual pause freeze distance and clear held input', async ({ page }) => {
  await enterParkour(page);
  await startParkour(page);
  await page.keyboard.down('ArrowDown');
  await page.clock.runFor(100);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const distance = await page.getByTestId('runner-distance').textContent();
  const tick = await page.locator('.runner-world').getAttribute('data-tick');
  await page.clock.runFor(10000);
  await expect(page.getByTestId('runner-distance')).toHaveText(distance!);
  await expect(page.locator('.runner-world')).toHaveAttribute('data-tick', tick!);
  await page.keyboard.up('ArrowDown');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(100);
  await expect(page.getByTestId('runner-player')).toHaveAttribute('data-pose', 'run');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('region', { name: '暂停菜单' })).toBeVisible();
});

test('taking three hits settles once and replay starts with fresh resources', async ({ page }) => {
  await enterParkour(page);
  await startParkour(page);
  await expect(page.getByRole('button', { name: '冲刺', exact: true })).toBeDisabled();
  await page.clock.runFor(30000);
  await expect(page.getByRole('region', { name: '对局结算' })).toBeVisible();
  await expect(page.getByTestId('runner-health')).toHaveAttribute('aria-label', '剩余 0 次体力');
  const result = await page.getByRole('region', { name: '对局结算' }).textContent();
  await page.clock.runFor(10000);
  expect(await page.getByRole('region', { name: '对局结算' }).textContent()).toBe(result);
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始冲刺', exact: true })).toBeVisible();
  await expect(page.getByTestId('runner-distance')).toHaveText('0');
  await expect(page.getByTestId('runner-health')).toHaveAttribute('aria-label', '剩余 3 次体力');
});

test('switching games unmounts the running loop and direct route refresh works', async ({
  page,
}) => {
  await enterParkour(page);
  await startParkour(page);
  await page.getByRole('button', { name: '返回游戏列表', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('button', { name: /AI 娘消消乐/ }).click();
  await expect(page.locator('.match3-tile')).toHaveCount(64);
  await page.clock.runFor(15000);
  await expect(page.getByTestId('moves')).toHaveText('20');
  await expect(page.getByRole('region', { name: '对局结算' })).toHaveCount(0);
  await page.goto('/#/games/parkour');
  await page.reload();
  await expect(page.getByRole('button', { name: '开始冲刺', exact: true })).toBeVisible();
  await expect(page.getByTestId('runner-distance')).toHaveText('0');
});

test('the story pauses at both checkpoints and reaches an ending through normal controls', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await enterParkour(page);
  await expect(page.getByText('把星光带回灯塔', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '选择 GLM', exact: true }).click();
  await expect(page.locator('.opening-line')).toContainText('回家的坐标');
  await startParkour(page);
  let chapters = 0;
  let crouching = false;
  for (let index = 0; index < 800; index += 1) {
    if (await page.getByRole('region', { name: '对局结算' }).isVisible()) break;
    const snapshot = await page.locator('.runner-world').evaluate((world) => {
      const obstacle = world.querySelector<HTMLElement>('.runner-obstacle');
      const player = world.querySelector<HTMLElement>('.runner-player')!;
      return {
        phase: world.getAttribute('data-phase'),
        distance: Number(world.getAttribute('data-distance')),
        speed: Number(world.getAttribute('data-speed')),
        grounded: Number(player.dataset.y) === 0,
        obstacle: obstacle ? { x: Number(obstacle.dataset.x), kind: obstacle.dataset.kind } : null,
      };
    });
    if (snapshot.phase === 'chapter') {
      chapters += 1;
      await expect(page.getByRole('region', { name: '章节故事' })).toBeVisible();
      await expect(
        page.getByRole('heading', {
          name: chapters === 1 ? '第一章 · 灯塔的秘密' : '第二章 · 一起回家',
        }),
      ).toBeVisible();
      const tick = await page.locator('.runner-world').getAttribute('data-tick');
      await page.clock.runFor(5000);
      await expect(page.locator('.runner-world')).toHaveAttribute('data-tick', tick!);
      await page.screenshot({
        path: testInfo.outputPath(`chapter-${chapters}.png`),
        fullPage: true,
      });
      if (crouching) {
        await page.keyboard.up('ArrowDown');
        crouching = false;
      }
      await page.getByRole('button', { name: '继续旅程', exact: true }).click();
      continue;
    }
    const lead = snapshot.obstacle ? snapshot.obstacle.x - snapshot.distance - 0.6 : Infinity;
    const shouldCrouch = snapshot.obstacle?.kind === 'air' && lead < snapshot.speed * 0.7;
    if (shouldCrouch && !crouching) {
      await page.keyboard.down('ArrowDown');
      crouching = true;
    }
    if (!shouldCrouch && crouching) {
      await page.keyboard.up('ArrowDown');
      crouching = false;
    }
    if (snapshot.obstacle?.kind === 'ground' && snapshot.grounded && lead < snapshot.speed * 0.4) {
      await page.keyboard.press('Space');
    }
    await page.clock.runFor(200);
  }
  expect(chapters).toBe(2);
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('1200');
  await expect(page.getByRole('heading', { name: '星潮长明', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('story-ending.png'), fullPage: true });
});
