import { expect, test, type Page } from '@playwright/test';

async function enterOffice(page: Page) {
  await page.clock.install({ time: new Date('2026-09-21T08:00:00Z') });
  await page.goto('/#/games/parkour');
  await expect(page.getByRole('region', { name: '开场故事' })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-21T09:00:00Z'));
}
async function startOffice(page: Page) {
  await page.getByRole('button', { name: '开跑', exact: true }).click();
  await page.clock.runFor(750);
  await expect(page.locator('.office-world')).toHaveAttribute('data-phase', 'running');
}
async function worldTick(page: Page) {
  return Number(await page.locator('.office-world').getAttribute('data-tick'));
}
async function checkCopyLayout(page: Page) {
  const layout = await page.locator('.whale-game').evaluate((game) => {
    const world = game.querySelector('.office-world')!.getBoundingClientRect();
    const dialogue = game.querySelector('.whale-dialogue')!.getBoundingClientRect();
    const strip = game.querySelector('.whale-feedback-strip')!.getBoundingClientRect();
    const copy = game.querySelector('.whale-dialogue-copy')!.getBoundingClientRect();
    const captions = game.querySelectorAll(
      '.beam-label, .printer-warning, .printer-receipt, .rice-label, .office-hallucination > span, .office-queue > span, .answer-package > span, .office-exit > span',
    );
    return {
      aboveTrack: dialogue.bottom <= world.top + 1,
      belowTrack: strip.top >= world.bottom - 1,
      dialogueFits: copy.top >= dialogue.top && copy.bottom <= dialogue.bottom + 1,
      captionsFit: [...captions].every((caption) => {
        const bounds = caption.getBoundingClientRect();
        return bounds.left >= world.left - 1 && bounds.right <= world.right + 1;
      }),
      textFits: [
        ...game.querySelectorAll<HTMLElement>(
          '.whale-notice, .whale-ability, .whale-dialogue-copy',
        ),
      ].every((element) => element.scrollWidth <= element.clientWidth + 1),
    };
  });
  expect(layout).toEqual({
    aboveTrack: true,
    belowTrack: true,
    dialogueFits: true,
    captionsFit: true,
    textFits: true,
  });
}
async function snapshot(page: Page) {
  return page.locator('.office-world').evaluate((world) => {
    const player = world.querySelector<HTMLElement>('.office-player')!;
    const distance = Number(world.getAttribute('data-distance'));
    return {
      phase: world.getAttribute('data-phase'),
      distance,
      speed: Number(world.getAttribute('data-speed')),
      grounded: Number(player.dataset.y) === 0,
      vy: Number(player.dataset.vy),
      airJumps: Number(player.dataset.airJumps),
      energy: Number(world.getAttribute('data-energy')),
      cooldown: Number(world.getAttribute('data-cooldown')),
      tail: Number(world.getAttribute('data-tail')),
      dash: Number(world.getAttribute('data-dash')),
      returns: Number(world.getAttribute('data-returns')),
      parries: Number(world.getAttribute('data-parries')),
      rice: Number(world.getAttribute('data-rice')),
      verified: Number(world.getAttribute('data-verified')),
      breaks: Number(world.getAttribute('data-breaks')),
      time: Number(world.getAttribute('data-real-tick')) / 60,
      obstacles: [...world.querySelectorAll<HTMLElement>('.office-obstacle, .office-queue')]
        .map((o) => ({ x: Number(o.dataset.x), kind: o.dataset.kind }))
        .filter((o) => o.x + 1.2 > distance)
        .sort((a, b) => a.x - b.x),
      papers: [...world.querySelectorAll<HTMLElement>('.office-paper[data-returned="false"]')]
        .map((p) => Number(p.dataset.x))
        .filter((x) => x + 0.45 > distance),
      food: [...world.querySelectorAll<HTMLElement>('.office-pickup.rice')]
        .map((p) => Number(p.dataset.x))
        .filter((x) => x > distance),
      hallucinations: [...world.querySelectorAll<HTMLElement>('.office-hallucination')]
        .map((p) => Number(p.dataset.x))
        .filter((x) => x + 0.35 > distance),
    };
  });
}

test('one opening exchange leads straight into the shared Vue game', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /AI 娘消消乐/ })).toBeVisible();
  await page.getByRole('button', { name: /大肥鱼跑酷：答案马上就到/ }).click();
  await expect(
    page.getByRole('heading', { name: '大肥鱼跑酷：答案马上就到', exact: true }),
  ).toBeVisible();
  const opening = page.getByRole('region', { name: '开场故事' });
  await expect(opening).toContainText('访客：');
  await expect(opening).toContainText('DeepSeek 娘：');
  await expect(opening).toContainText('想玩个小游戏');
  await expect(page.getByText('“包的。答案马上送到。”', { exact: false })).toHaveCount(1);
  await checkCopyLayout(page);
  await expect(page.locator('.whale-controls button')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '深度思考', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('shift-opening.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('jump, double jump, fast fall and tail buttons work without story interruptions', async ({
  page,
}) => {
  await enterOffice(page);
  await page.clock.runFor(6000);
  await expect(page.getByTestId('runner-distance')).toHaveText('0');
  await startOffice(page);
  await page.getByRole('button', { name: '跳跃', exact: true }).click();
  await page.clock.runFor(150);
  const y = Number(await page.getByTestId('runner-player').getAttribute('data-y'));
  expect(y).toBeGreaterThan(0);
  await page.keyboard.press('ArrowUp');
  await page.clock.runFor(150);
  expect(Number(await page.getByTestId('runner-player').getAttribute('data-y'))).toBeGreaterThan(y);
  await page.getByRole('button', { name: '滑铲', exact: true }).click();
  await page.clock.runFor(450);
  await expect(page.getByTestId('runner-player')).toHaveAttribute('data-pose', 'slide');
  await page.clock.runFor(500);
  await page.getByRole('button', { name: '尾巴回信', exact: true }).click();
  await page.clock.runFor(80);
  expect(Number(await page.locator('.office-world').getAttribute('data-tail'))).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '尾巴回信', exact: true })).toBeDisabled();
  await page.clock.runFor(650);
  await expect(page.getByRole('button', { name: '尾巴回信', exact: true })).toBeEnabled();
});

test('manual and background pauses freeze movement and real-time ability windows', async ({
  page,
}) => {
  await enterOffice(page);
  await startOffice(page);
  await page.getByRole('button', { name: '尾巴回信', exact: true }).click();
  await page.clock.runFor(80);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const tick = await worldTick(page);
  const cooldown = await page.locator('.office-world').getAttribute('data-cooldown');
  const realTick = await page.locator('.office-world').getAttribute('data-real-tick');
  await page.clock.runFor(10000);
  expect(await worldTick(page)).toBe(tick);
  await expect(page.locator('.office-world')).toHaveAttribute('data-cooldown', cooldown!);
  await expect(page.locator('.office-world')).toHaveAttribute('data-real-tick', realTick!);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(100);
  expect(await worldTick(page)).toBeGreaterThan(tick);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('region', { name: '暂停菜单' })).toBeVisible();
});

test('failure settles once and retry skips the intro while resetting resources', async ({
  page,
}) => {
  await enterOffice(page);
  await startOffice(page);
  await page.clock.runFor(60000);
  const settlement = page.getByRole('region', { name: '对局结算' });
  await expect(settlement).toContainText('人先扁了');
  await expect(settlement).toContainText('把你和尾巴一起');
  const result = await settlement.textContent();
  await page.clock.runFor(10000);
  expect(await settlement.textContent()).toBe(result);
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.getByRole('region', { name: '开场故事' })).toHaveCount(0);
  await expect(page.getByTestId('runner-distance')).toHaveText('0');
  await expect(page.getByTestId('runner-energy')).toHaveText('20');
  await expect(page.locator('.office-world')).toHaveAttribute('data-context', '0');
  await expect(page.locator('.office-world')).toHaveAttribute('data-answer', 'false');
  await page.clock.runFor(750);
  await expect(page.locator('.office-world')).toHaveAttribute('data-phase', 'running');
});

test('leaving removes listeners; re-entry and refresh are new visits, not retries', async ({
  page,
}) => {
  await enterOffice(page);
  await startOffice(page);
  await page.getByRole('button', { name: '返回游戏列表', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('button', { name: /AI 娘消消乐/ }).click();
  await expect(page.locator('.match3-tile')).toHaveCount(64);
  await page.keyboard.press('KeyX');
  await page.clock.runFor(15000);
  await expect(page.getByTestId('moves')).toHaveText('20');
  await expect(page.getByRole('region', { name: '对局结算' })).toHaveCount(0);
  await page.goto('/#/games/parkour');
  await page.reload();
  await expect(page.getByRole('region', { name: '开场故事' })).toBeVisible();
});

test('the 320px layout keeps text and all three controls in their bounds', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await enterOffice(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const fits = await page
    .locator('.whale-controls button, .whale-dialogue, .whale-feedback-strip')
    .evaluateAll((elements) =>
      elements.every((element) => element.scrollWidth <= element.clientWidth),
    );
  expect(fits).toBe(true);
  const controls = await page.locator('.whale-controls').boundingBox();
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(780);
  await checkCopyLayout(page);
  await page.screenshot({ path: testInfo.outputPath('shift-320.png'), fullPage: true });
  await startOffice(page);
  await page.getByRole('button', { name: '跳跃', exact: true }).click();
  await page.clock.runFor(150);
  await expect(page.getByTestId('runner-player')).toHaveAttribute('data-pose', 'jump');
});

test('normal inputs collect food, return paper, verify hallucinations and deliver without stops', async ({
  page,
}, testInfo) => {
  test.setTimeout(100_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enterOffice(page);
  await startOffice(page);
  let crouching = false;
  let capturedReturn = false;
  let capturedQueue = false;
  for (let index = 0; index < 750; index += 1) {
    const s = await snapshot(page);
    if (s.phase === 'ended') break;
    expect(s.phase).toBe('running');
    const obstacle = s.obstacles[0];
    const lead = obstacle ? obstacle.x - s.distance - 0.6 : Infinity;
    const paper = s.papers[0];
    const fake = s.hallucinations[0];
    const canSlap = s.cooldown === 0 && s.dash === 0;
    const shouldSlap =
      canSlap &&
      ((paper !== undefined && paper - s.distance < 3.4) ||
        (fake !== undefined && fake - s.distance < 3.4) ||
        (s.energy === 100 && (lead < 6 || s.distance >= 406)));
    const shouldCrouch =
      (obstacle?.kind === 'air' && lead < s.speed * 0.65) ||
      (paper !== undefined && paper - s.distance < 1 && !canSlap && !s.tail);
    if (shouldCrouch && !crouching) await page.keyboard.down('ArrowDown');
    if (!shouldCrouch && crouching) await page.keyboard.up('ArrowDown');
    crouching = shouldCrouch;
    if (
      !shouldCrouch &&
      ((obstacle?.kind === 'ground' && s.grounded && lead < s.speed * 0.32) ||
        (!s.grounded && s.airJumps === 0 && s.vy < 4.5 && s.food.some((x) => x - s.distance < 8)))
    )
      await page.keyboard.press('Space');
    if (shouldSlap) await page.keyboard.press('KeyX');
    await page.clock.runFor(100);
    if (index % 5 === 0) await checkCopyLayout(page);
    if (s.parries > 0 && !capturedReturn) {
      capturedReturn = true;
      await page.screenshot({ path: testInfo.outputPath('shift-return.png'), fullPage: true });
    }
    if (s.distance > 260 && !capturedQueue) {
      capturedQueue = true;
      await page.screenshot({ path: testInfo.outputPath('shift-queue.png'), fullPage: true });
    }
  }
  if (crouching) await page.keyboard.up('ArrowDown');
  const result = await snapshot(page);
  expect(result.distance).toBe(480);
  expect(result.time).toBeGreaterThanOrEqual(45);
  expect(result.time).toBeLessThanOrEqual(60);
  expect(result.rice).toBeGreaterThan(0);
  expect(result.returns).toBeGreaterThan(0);
  expect(result.verified).toBeGreaterThan(0);
  expect(result.breaks).toBeGreaterThan(0);
  expect(capturedReturn && capturedQueue).toBe(true);
  await expect(
    page.getByRole('heading', { name: '答案已送达，准许开饭', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('你看，很简单');
  await page.screenshot({ path: testInfo.outputPath('shift-delivered.png'), fullPage: true });
  expect(errors).toEqual([]);
});
