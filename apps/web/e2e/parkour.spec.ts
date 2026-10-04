import { expect, test, type Page } from '@playwright/test';

async function enterOffice(page: Page) {
  await page.clock.install({ time: new Date('2026-09-21T08:00:00Z') });
  await page.goto('/#/games/parkour');
  await page.getByRole('button', { name: '单项练习', exact: true }).click();
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
    const dialogue = game.querySelector('.whale-dialogue')?.getBoundingClientRect();
    const strip = game.querySelector('.whale-feedback-strip')!.getBoundingClientRect();
    const copy = game.querySelector('.whale-dialogue-copy')?.getBoundingClientRect();
    const captions = game.querySelectorAll(
      '.beam-label, .printer-warning, .printer-receipt, .rice-label, .office-hallucination > span, .office-queue > span, .answer-package > span, .office-exit > span',
    );
    return {
      aboveTrack: !dialogue || dialogue.bottom <= world.top + 1,
      belowTrack: strip.top >= world.bottom - 1,
      dialogueFits:
        !dialogue || !copy || (copy.top >= dialogue.top && copy.bottom <= dialogue.bottom + 1),
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

for (const course of [
  { number: 2, finish: 650, answer: 566, gate: 629 },
  { number: 3, finish: 740, answer: 650, gate: 724 },
]) {
  test(`course ${course.number} delivers through normal input and saves its skill medal`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(100_000);
    await enterOffice(page);
    await page
      .getByRole('group', { name: '选择关卡' })
      .getByRole('button', { name: new RegExp(`第${course.number}关`) })
      .click();
    await startOffice(page);
    let crouching = false;
    let capturedGate = false;
    let jumpedAfterGate = false;
    for (let index = 0; index < 1500; index++) {
      const s = await snapshot(page);
      if (s.phase === 'ended') break;
      if (!capturedGate && s.distance >= course.gate - 5) {
        capturedGate = true;
        expect(s.dash).toBe(0);
        await expect(page.locator('.beam-label', { hasText: '验收门' })).toBeVisible();
        await checkCopyLayout(page);
        await page.screenshot({
          path: testInfo.outputPath(`course-${course.number}-gate.png`),
          fullPage: true,
        });
      }
      jumpedAfterGate ||= s.distance > course.gate + 2 && !s.grounded;
      const obstacle = s.obstacles[0];
      const lead = obstacle ? obstacle.x - s.distance - 0.6 : Infinity;
      const paper = s.papers[0];
      const fake = s.hallucinations[0];
      const low = obstacle?.kind === 'air' && lead < s.speed * 0.5;
      const crouch = low || Boolean(paper && paper - s.distance < 1 && s.cooldown && !s.tail);
      if (crouch !== crouching) {
        if (crouch) await page.keyboard.down('ArrowDown');
        else await page.keyboard.up('ArrowDown');
        crouching = crouch;
      }
      if (!low && obstacle?.kind === 'ground' && s.grounded && lead < s.speed * 0.25)
        await page.keyboard.press('Space');
      if (
        !s.cooldown &&
        !s.dash &&
        ((paper !== undefined && paper - s.distance < 3.1) ||
          (fake !== undefined && fake - s.distance < 3.1) ||
          (s.energy === 100 && s.distance >= course.answer))
      )
        await page.keyboard.press('KeyX');
      await page.clock.runFor(50);
    }
    if (crouching) await page.keyboard.up('ArrowDown');
    const result = await snapshot(page);
    expect(result.distance).toBe(course.finish);
    expect(capturedGate && jumpedAfterGate).toBe(true);
    if (course.number === 2) expect(result.returns).toBe(5);
    else expect(result.verified).toBe(4);
    await expect(page.getByRole('region', { name: '对局结算' })).toContainText(
      course.number === 2 ? '停止补充！' : '查无此饭',
    );
    const badges = await page.evaluate(
      (level) => JSON.parse(localStorage.getItem(`moecore:parkour:badges:v1:${level}`) ?? '[]'),
      course.number - 1,
    );
    expect(badges).toContain(course.number === 2 ? 'returns' : 'verify');
    await page.screenshot({
      path: testInfo.outputPath(`course-${course.number}-delivered.png`),
      fullPage: true,
    });
  });
}

test('one opening exchange leads straight into the shared Vue game', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /模型消消乐/ })).toBeVisible();
  await page.getByRole('button', { name: /大肥鱼跑酷：答案马上就到/ }).click();
  await page.getByRole('button', { name: '单项练习', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '大肥鱼跑酷：答案马上就到', exact: true }),
  ).toBeVisible();
  const opening = page.getByRole('region', { name: '开场故事' });
  await expect(opening).toContainText('访客：');
  await expect(opening).toContainText('DeepSeek 娘：');
  await expect(opening).toContainText('吃白饭的蓝色大肥鱼');
  await expect(page.getByText('空格 / 点跑道：跳，连按二段', { exact: false })).toBeVisible();
  await expect(page.getByText('“白饭我吃，答案我交。看好了。”', { exact: false })).toHaveCount(1);
  const modes = page.getByRole('group', { name: '思考强度' });
  await expect(modes.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true');
  await modes.getByRole('button', { name: 'Max' }).click();
  await expect(modes.getByRole('button', { name: 'Max' })).toHaveAttribute('aria-pressed', 'true');
  expect(Number(await page.locator('.office-world').getAttribute('data-speed'))).toBeCloseTo(9.212);
  await checkCopyLayout(page);
  await expect(page.locator('.whale-controls button')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '深度思考', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: '选择关卡' }).getByRole('button')).toHaveCount(4);
  await expect
    .poll(() =>
      page.locator('.office-background').evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('shift-opening.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: '单项练习', exact: true }).click();
  await expect(
    page.getByRole('group', { name: '思考强度' }).getByRole('button', { name: 'Max' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('all three levels can be selected and a failed run returns to selection', async ({
  page,
}, testInfo) => {
  await enterOffice(page);
  const picker = page.getByRole('group', { name: '选择关卡' });
  await picker.getByRole('button', { name: /第2关/ }).click();
  await expect(page.locator('.office-world')).toHaveClass(/level-2/);
  await expect(page.locator('.whale-distance')).toContainText('650 m');
  const secondBackground = await page.locator('.office-background').getAttribute('src');
  await page.screenshot({ path: testInfo.outputPath('level-2-opening.png'), fullPage: true });
  await picker.getByRole('button', { name: /第3关/ }).click();
  await expect(page.locator('.office-world')).toHaveClass(/level-3/);
  await expect(page.locator('.whale-distance')).toContainText('740 m');
  expect(await page.locator('.office-background').getAttribute('src')).not.toBe(secondBackground);
  await expect
    .poll(() =>
      page.locator('.office-background').evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('level-3-opening.png'), fullPage: true });
  await startOffice(page);
  await page.screenshot({ path: testInfo.outputPath('level-3-running.png'), fullPage: true });
  await page.clock.runFor(60000);
  await expect(page.getByRole('region', { name: '对局结算' })).toBeVisible();
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await expect(
    page.getByRole('group', { name: '选择关卡' }).getByRole('button', { name: /第3关/ }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('endless mode keeps scoring until a mistake and can retry immediately', async ({
  page,
}, testInfo) => {
  await enterOffice(page);
  await page
    .getByRole('group', { name: '选择关卡' })
    .getByRole('button', { name: /无限航线/ })
    .click();
  await expect(page.locator('.office-world')).toHaveClass(/level-4/);
  await expect(page.locator('.whale-distance')).toContainText('∞');
  await expect(page.locator('.whale-progress')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('endless-opening.png'), fullPage: true });
  await startOffice(page);
  await expect(page.getByRole('button', { name: '尾巴回信', exact: true })).toBeEnabled();
  await expect(page.getByTestId('runner-returns')).toHaveText('0');
  await expect(page.locator('.verified-count')).toContainText('核验 0');
  await page.clock.runFor(1000);
  expect(
    Number((await page.getByTestId('runner-score').textContent())?.replace(/\D/g, '')),
  ).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('endless-running.png'), fullPage: true });
  await page.clock.runFor(60000);
  const result = page.getByRole('region', { name: '对局结算' });
  await expect(result).toContainText('无限航线');
  await expect(result).toContainText('新纪录！');
  expect(
    Number(await page.evaluate(() => localStorage.getItem('moecore:parkour:best-score:v2:3'))),
  ).toBeGreaterThan(0);
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.office-world')).toHaveClass(/level-4/);
  await expect(page.getByTestId('runner-distance')).toHaveText('0');
});

test('starting brings controls into view and teaches the first obstacle', async ({ page }) => {
  await enterOffice(page);
  await startOffice(page);
  const jump = await page.getByRole('button', { name: '跳跃', exact: true }).boundingBox();
  expect(jump).not.toBeNull();
  expect(jump!.y).toBeGreaterThanOrEqual(0);
  expect(jump!.y + jump!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.getByRole('status').filter({ hasText: '二段跳' })).toBeVisible();
  await page.clock.runFor(2400);
  await expect(page.getByRole('status').filter({ hasText: '前方文档堆' })).toBeVisible();
});

test('space starts the run without finding the start button', async ({ page }) => {
  await enterOffice(page);
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: '开场故事' })).toHaveCount(0);
  await page.clock.runFor(750);
  await expect(page.locator('.office-world')).toHaveAttribute('data-phase', 'running');
  const floorBefore = await page
    .locator('.office-floor')
    .evaluate((element) => getComputedStyle(element).backgroundPositionX);
  await page.clock.runFor(1000);
  const floorAfter = await page
    .locator('.office-floor')
    .evaluate((element) => getComputedStyle(element).backgroundPositionX);
  expect(floorAfter).not.toBe(floorBefore);
});

test('space immediately retries after a result', async ({ page }) => {
  await enterOffice(page);
  await startOffice(page);
  await page.clock.runFor(60000);
  await expect(page.getByRole('region', { name: '对局结算' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: '对局结算' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '开场故事' })).toHaveCount(0);
  await expect(page.getByTestId('runner-distance')).toHaveText('0');
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
  await expect(settlement).toContainText('答案还在前面');
  await expect(settlement).toContainText('从数据浪里爬起来');
  await expect(settlement).toContainText('提示：');
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
  await page.getByRole('button', { name: /模型消消乐/ }).click();
  await expect(page.locator('.match3-tile')).toHaveCount(64);
  await page.keyboard.press('KeyX');
  await page.clock.runFor(15000);
  await expect(page.getByTestId('moves')).toHaveText('20');
  await expect(page.getByRole('region', { name: '对局结算' })).toHaveCount(0);
  await page.goto('/#/games/parkour');
  await page.reload();
  await page.getByRole('button', { name: '单项练习', exact: true }).click();
  await expect(page.getByRole('region', { name: '开场故事' })).toBeVisible();
});

test('the 320px layout keeps text and all three controls in their bounds', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
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
  await checkCopyLayout(page);
  await page.screenshot({ path: testInfo.outputPath('shift-320.png'), fullPage: true });
  await startOffice(page);
  const controls = await page.locator('.whale-controls').boundingBox();
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(640);
  const health = await page.getByTestId('runner-health').boundingBox();
  const world = await page.locator('.office-world').boundingBox();
  expect(health!.y).toBeGreaterThanOrEqual(0);
  expect(world!.y).toBeGreaterThanOrEqual(0);
  expect(world!.y + world!.height).toBeLessThan(controls!.y);
  await page.screenshot({ path: testInfo.outputPath('shift-320-running.png'), fullPage: false });
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
  let capturedRiceFace = false;
  let capturedBurstPose = false;
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
        (s.energy === 100 && (lead < 6 || s.distance >= 526)));
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
    if (
      !capturedRiceFace &&
      (await page.locator('.whale-coach.quip img[src*="rice-guilty"]').count())
    ) {
      capturedRiceFace = true;
      await expect
        .poll(() =>
          page
            .locator('.whale-coach.quip img')
            .evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      await expect(page.getByTestId('runner-player')).toHaveAttribute('data-reaction', 'rice');
      await expect(page.locator('.office-player .maid-sprite')).toHaveAttribute(
        'src',
        /char-rice-run/,
      );
      await page.screenshot({ path: testInfo.outputPath('shift-rice-face.png'), fullPage: true });
    }
    if (
      !capturedBurstPose &&
      (await page.locator('.office-player[data-reaction="burst"]').count())
    ) {
      capturedBurstPose = true;
      await expect(page.locator('.office-player .maid-sprite')).toHaveAttribute(
        'src',
        /char-whale-burst/,
      );
      await page.screenshot({ path: testInfo.outputPath('shift-burst-pose.png'), fullPage: true });
    }
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
  expect(result.distance).toBe(600);
  expect(result.time).toBeGreaterThanOrEqual(38);
  expect(result.time).toBeLessThanOrEqual(52);
  expect(result.rice).toBeGreaterThan(0);
  expect(result.returns).toBeGreaterThan(0);
  expect(result.verified).toBeGreaterThan(0);
  expect(result.breaks).toBeGreaterThan(0);
  expect(capturedRiceFace && capturedBurstPose && capturedReturn && capturedQueue).toBe(true);
  await expect(
    page.getByRole('heading', { name: '答案送达，白饭没白吃', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('先验收，再开饭');
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('新纪录！');
  await expect(page.getByRole('button', { name: '下一关', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('shift-delivered.png'), fullPage: true });
  expect(
    Number(await page.evaluate(() => localStorage.getItem('moecore:parkour:best-score:v2:0'))),
  ).toBeGreaterThan(0);
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.locator('.office-world')).toHaveClass(/level-2/);
  await expect(page.getByRole('region', { name: '开场故事' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
