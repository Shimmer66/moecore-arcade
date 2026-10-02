import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../../games/arena/src/campaign';
import { MAIN_ROUTE, nextJourneyRoom } from '../../../games/arena/src/journey';
import { openRoom } from '../../../games/arena/src/runner';
import { SECRET_ROUTES, type RouteDriver } from '../../../games/arena/tests/routes';
test('shows generated jump fall landing and defeat poses, and holds jet thrust', async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  const player = page.getByTestId('campaign-player');
  await expect(player).toBeVisible();
  await page.clock.runFor(50);
  await page.keyboard.press('Space');
  await page.clock.runFor(100);
  await expect(player).toHaveAttribute('data-pose', 'jump');
  const atlas = await player.locator('image').evaluate(async (element) => {
    const image = new Image();
    image.src = element.getAttribute('href')!;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  expect(atlas).toEqual([1254, 1254]);
  await page.screenshot({ path: info.outputPath('pose-jump.png'), fullPage: true });
  await page.clock.runFor(400);
  await expect(player).toHaveAttribute('data-pose', 'fall');
  for (let i = 0; i < 90 && (await player.getAttribute('data-grounded')) !== 'true'; i++)
    await page.clock.runFor(16);
  await expect(player).toHaveAttribute('data-pose', 'land');
  await page.screenshot({ path: info.outputPath('pose-land.png'), fullPage: true });
  await page.keyboard.down('KeyD');
  for (
    let i = 0;
    i < 100 && (await page.locator('.campaign-game').getAttribute('data-phase')) !== 'dead';
    i++
  )
    await page.clock.runFor(32);
  await page.keyboard.up('KeyD');
  await expect(player).toHaveAttribute('data-pose', 'defeat');
  await page.screenshot({ path: info.outputPath('pose-defeat.png'), fullPage: true });
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /燃烧 Token/ }).click();
  await page.clock.runFor(50);
  const jump = page.getByRole('button', { name: '跳跃', exact: true });
  await jump.scrollIntoViewIfNeeded();
  const bounds = (await jump.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.clock.runFor(700);
  await page.mouse.up();
  expect(Number(await player.getAttribute('data-fuel'))).toBeLessThan(25);
  expect(Number(await player.getAttribute('data-y'))).toBeLessThan(200);
  const fuel = await player.getAttribute('data-fuel');
  await page.clock.runFor(100);
  expect(await player.getAttribute('data-fuel')).toBe(fuel);
});

test('finishes a best-of-five sweep and restarts with fresh sabotage charges', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '双人竞速', exact: true }).click();
  for (let index = 0; index < 3; index++) {
    const run = openRoom(index);
    const inputs: { horizontal: number; jump: boolean }[] = [];
    SECRET_ROUTES[index]!({
      get rect() {
        return run.rect;
      },
      get traps() {
        return run.traps;
      },
      get grounded() {
        return run.grounded;
      },
      get phase() {
        return run.phase;
      },
      step(horizontal, jump) {
        if (run.phase !== 'playing') return;
        inputs.push({ horizontal, jump });
        run.step(horizontal, jump);
      },
    });
    run.dispose();
    let held = '';
    for (let offset = 0; offset < inputs.length;) {
      const input = inputs[offset]!;
      const key = input.horizontal > 0 ? 'ArrowRight' : input.horizontal < 0 ? 'ArrowLeft' : '';
      if (held !== key) {
        if (held) await page.keyboard.up(held);
        if (key) await page.keyboard.down(key);
        held = key;
      }
      if (input.jump) await page.keyboard.press('ArrowUp');
      let end = offset + 1;
      while (
        end < inputs.length &&
        !inputs[end]!.jump &&
        inputs[end]!.horizontal === input.horizontal
      )
        end++;
      for (let i = 0; i < 30; i++) {
        const tick = Number(await page.locator('.campaign-game').getAttribute('data-race-tick'));
        if (tick >= end) {
          expect(tick).toBe(end);
          break;
        }
        await page.clock.runFor(Math.max(1, (end - tick) * 16));
      }
      offset = end;
    }
    if (held) await page.keyboard.up(held);
    await expect(page.locator('.deaths')).toContainText(`0 : ${index + 1}`);
    if (index < 2) await page.getByRole('button', { name: '下一局', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'P2 赢得本场！' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('match-champion.png'), fullPage: true });
  await page.getByRole('button', { name: '再来一场', exact: true }).click();
  await expect(page.locator('.deaths')).toContainText('0 : 0');
  await page.keyboard.press('KeyS');
  await page.clock.runFor(20);
  await expect(page.getByRole('button', { name: 'P1 追加需求', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'P2 追加需求', exact: true })).toBeEnabled();
  await expect(page.getByTestId('falling-body')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await page.clock.runFor(20);
  await expect(page.getByRole('button', { name: 'P2 追加需求', exact: true })).toBeDisabled();
  await expect(page.getByTestId('falling-body')).toHaveCount(2);
});

test('plays every room and secret through the browser before the final ending', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  await expect(page.getByTestId('campaign-player')).toBeVisible();
  for (const index of MAIN_ROUTE) {
    const route = SECRET_ROUTES[index]!;
    const run = openRoom(index);
    const inputs: { horizontal: number; jump: boolean }[] = [];
    const driver: RouteDriver = {
      get rect() {
        return run.rect;
      },
      get traps() {
        return run.traps;
      },
      get phase() {
        return run.phase;
      },
      get grounded() {
        return run.grounded;
      },
      step(horizontal, jump) {
        if (run.phase !== 'playing') return;
        inputs.push({ horizontal, jump });
        run.step(horizontal, jump);
      },
    };
    route(driver);
    expect(run.phase, CAMPAIGN[index]!.id).toBe('clear');
    run.dispose();
    let held = '';
    for (let offset = 0; offset < inputs.length;) {
      const input = inputs[offset]!;
      const key = input.horizontal > 0 ? 'KeyD' : input.horizontal < 0 ? 'KeyA' : '';
      if (key !== held) {
        if (held) await page.keyboard.up(held);
        if (key) await page.keyboard.down(key);
        held = key;
      }
      if (input.jump) await page.keyboard.press('Space');
      let end = offset + 1;
      while (
        end < inputs.length &&
        !inputs[end]!.jump &&
        inputs[end]!.horizontal === input.horizontal
      )
        end++;
      for (let advance = 0; advance < 30; advance++) {
        const tick = Number(await page.locator('.campaign-game').getAttribute('data-tick'));
        if (tick >= end) {
          expect(tick, `${CAMPAIGN[index]!.id} replay tick`).toBe(end);
          break;
        }
        await page.clock.runFor(Math.max(1, (end - tick) * 16));
        await expect(page.locator('.campaign-game'), CAMPAIGN[index]!.id).not.toHaveAttribute(
          'data-phase',
          'dead',
        );
      }
      offset = end;
    }
    if (held) await page.keyboard.up(held);
    await expect(page.locator('.campaign-game'), CAMPAIGN[index]!.id).toHaveAttribute(
      'data-phase',
      'clear',
    );
    await expect(page.locator('.run-record'), CAMPAIGN[index]!.id).toContainText('秘密已收集');
    if (CAMPAIGN[index]!.width) {
      const viewBox = (await page.locator('.playfield > svg').getAttribute('viewBox'))!
        .split(' ')
        .map(Number);
      expect(viewBox[0]).toBeGreaterThan(1000);
      await page.screenshot({ path: info.outputPath('long-room-clear.png'), fullPage: true });
    }
    await page
      .getByRole('button', {
        name: nextJourneyRoom(index) === null ? '完成' : '下一关',
        exact: true,
      })
      .click();
  }
  await expect(page.getByText('比训练数据更完整的答案', { exact: true })).toBeVisible();
  await expect(
    page.getByText(new RegExp(`秘密 ${CAMPAIGN.length}/${CAMPAIGN.length}`)),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('complete-ending.png'), fullPage: true });
  await page.getByRole('button', { name: '重返关卡地图', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '关卡地图' })).toBeVisible();
  await expect(page.locator('.map-heading')).toContainText(`${CAMPAIGN.length}/${CAMPAIGN.length}`);
});

test('changes movement in the lab and loads its generated background', async ({ page }, info) => {
  await page.clock.install();
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /温度拉满/ }).click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(600);
  await page.keyboard.up('KeyD');
  const player = page.getByTestId('campaign-player');
  const x = Number(await player.getAttribute('data-x'));
  await page.clock.runFor(150);
  expect(Number(await player.getAttribute('data-x'))).toBeGreaterThan(x + 10);
  const background = page.locator('.playfield > svg > image');
  await expect(background).toHaveAttribute('href', /parameter-lab/);
  expect(
    await background.evaluate(async (element) => {
      const image = new Image();
      image.src = element.getAttribute('href')!;
      await image.decode();
      return image.naturalWidth;
    }),
  ).toBe(1536);
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /四比特起跳/ }).click();
  await page.clock.runFor(100);
  await page.keyboard.press('Space');
  await page.clock.runFor(300);
  expect(Number(await player.getAttribute('data-y'))).toBeGreaterThan(225);
  expect(Number(await player.getAttribute('data-y'))).toBeLessThan(275);
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /大力出奇迹/ }).click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(1000);
  await page.keyboard.up('KeyD');
  expect(Number(await player.getAttribute('data-y'))).toBeLessThan(250);
  await page.screenshot({ path: info.outputPath('parameter-lab.png'), fullPage: true });
});

test('accepts simultaneous touch directions and a separate P2 jump', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Touch behavior uses the mobile browser project.');
  await page.clock.install();
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '双人竞速', exact: true }).click();
  const one = page.getByRole('button', { name: '向右移动', exact: true });
  const two = page.getByRole('button', { name: 'P2 向右移动', exact: true });
  const jump = page.getByRole('button', { name: 'P2 跳跃', exact: true });
  await jump.scrollIntoViewIfNeeded();
  const a = (await one.boundingBox())!,
    b = (await two.boundingBox())!,
    c = (await jump.boundingBox())!;
  const points = [
    { id: 1, x: a.x + a.width / 2, y: a.y + a.height / 2 },
    { id: 2, x: b.x + b.width / 2, y: b.y + b.height / 2 },
  ];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await page.clock.runFor(400);
  const p1 = page.getByTestId('campaign-player'),
    p2 = page.getByTestId('race-player-2');
  expect(Number(await p1.getAttribute('data-x'))).toBeGreaterThan(130);
  expect(Number(await p2.getAttribute('data-x'))).toBeGreaterThan(130);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [...points, { id: 3, x: c.x + c.width / 2, y: c.y + c.height / 2 }],
  });
  await page.clock.runFor(150);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  expect(Number(await p2.getAttribute('data-y'))).toBeLessThan(
    Number(await p1.getAttribute('data-y')) - 40,
  );
});

test('rejects the fake exit, explains the failure and allows jumping over it', async ({
  page,
}, info) => {
  await page.clock.install();
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /这个链接绝对能用/ }).click();
  await page.getByRole('button', { name: '关闭音效', exact: true }).click();
  await page.locator('.speech').click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(1750);
  await page.keyboard.up('KeyD');
  await expect(page.locator('.speech')).toContainText('可用性另算');
  await expect(page.locator('.deaths')).toContainText('1');
  await page.clock.runFor(500);
  await page.getByRole('button', { name: '重试本关', exact: true }).click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(1300);
  await page.keyboard.press('Space');
  await page.clock.runFor(2100);
  await page.keyboard.up('KeyD');
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'clear');
  const nextButton = await page.getByRole('button', { name: '下一关', exact: true }).boundingBox();
  expect(nextButton!.height).toBeLessThan(65);
  expect(nextButton!.width).toBeGreaterThan(120);
  await expect(page.getByRole('button', { name: '开启音效', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('fake-exit-cleared.png'), fullPage: true });
});

test('keeps a collected secret and best time after reloading', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  const player = page.getByTestId('campaign-player');
  await expect(player).toBeVisible();
  async function walkTo(x: number) {
    await page.keyboard.down('KeyD');
    for (let i = 0; i < 250; i++) {
      if (
        Number(await player.getAttribute('data-x')) >= x ||
        (await page.locator('.campaign-game').getAttribute('data-phase')) !== 'playing'
      )
        break;
      await page.clock.runFor(32);
    }
    await page.keyboard.up('KeyD');
  }
  await walkTo(250);
  await page.keyboard.press('Space');
  await walkTo(480);
  for (let i = 0; i < 90 && (await player.getAttribute('data-grounded')) !== 'true'; i++)
    await page.clock.runFor(16);
  await expect(player).toHaveAttribute('data-grounded', 'true');
  await page.keyboard.press('Space');
  await page.clock.runFor(1000);
  await walkTo(950);
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'clear');
  await expect(page.locator('.run-record')).toContainText('秘密已收集');
  await page.reload();
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  const record = page.getByRole('button', { name: /来源：我自己/ });
  await expect(record).toContainText(/\d+\.\d+s/);
  await expect(record.locator('svg[fill="currentColor"]')).toHaveCount(1);
});

test('renders periodic gates, a moving shuttle and inverted ceiling travel', async ({
  page,
}, info) => {
  await page.clock.install();
  await page.goto('/#/games/arena');
  for (const title of ['请求过于频繁', '拼车推理', '让我想一想', '向上发展']) {
    await page.getByRole('button', { name: '选择关卡', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await page.clock.runFor(50);
    if (title === '让我想一想') {
      await page.keyboard.down('KeyD');
      await page.clock.runFor(900);
      await page.keyboard.up('KeyD');
    }
    if (title !== '向上发展') {
      const body = page
        .getByTestId(
          title === '请求过于频繁'
            ? 'gate-body'
            : title === '让我想一想'
              ? 'falling-body'
              : 'platform-body',
        )
        .first();
      expect(
        await body.evaluate((element) => {
          const bounds = (element as SVGGraphicsElement).getBBox();
          return bounds.width > 0 && bounds.height > 0;
        }),
      ).toBe(true);
    }
    if (title === '向上发展') {
      await page.keyboard.down('KeyD');
      await page.clock.runFor(1250);
      await page.keyboard.up('KeyD');
      await expect(page.getByTestId('campaign-player')).toHaveAttribute('transform', /,-1\)/);
    }
    await page.screenshot({ path: info.outputPath(`${title}.png`), fullPage: true });
  }
});

test('races with independent keys and renders the generated archive', async ({ page }, info) => {
  await page.clock.install();
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '双人竞速', exact: true }).click();
  await page.locator('.speech').click();
  const p1 = page.getByTestId('campaign-player');
  const p2 = page.getByTestId('race-player-2');
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(750);
  expect(Number(await p1.getAttribute('data-x'))).toBe(50);
  expect(Number(await p2.getAttribute('data-x'))).toBeGreaterThan(200);
  await page.keyboard.press('ArrowUp');
  await page.clock.runFor(2600);
  await page.keyboard.up('ArrowRight');
  await expect(page.getByRole('heading', { name: 'P2 抢先发布！' })).toBeVisible();
  await expect(page.locator('.deaths')).toContainText('0 : 1');
  await page.getByRole('button', { name: '再赛一局', exact: true }).click();
  await expect(p2).toHaveAttribute('data-x', '50');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /删去不重要的/ }).click();
  const background = page.locator('.playfield > svg > image');
  await expect(background).toHaveAttribute('href', /server-archive/);
  expect(
    await background.evaluate(async (element) => {
      const image = new Image();
      image.src = element.getAttribute('href')!;
      await image.decode();
      return image.naturalWidth;
    }),
  ).toBe(1536);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('race-archive.png'), fullPage: true });
  await page.getByRole('button', { name: '单人冒险', exact: true }).click();
  await expect(p2).toHaveCount(0);
});

test('renders generated assets, retries and clears a room through real input', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto('/#/games/arena');
  const player = page.getByTestId('campaign-player');
  await expect(player).toBeVisible();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(1800);
  await page.keyboard.up('KeyD');
  await expect(page.locator('.deaths')).toContainText('1');
  await page.clock.runFor(500);
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'playing');
  await page.getByRole('button', { name: '重试本关', exact: true }).click();
  await page.locator('.speech').click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(750);
  await page.keyboard.press('Space');
  await page.clock.runFor(2600);
  await page.keyboard.up('KeyD');
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'clear');
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-room', 'autocomplete');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const x = await player.getAttribute('data-x');
  await page.clock.runFor(1000);
  expect(await player.getAttribute('data-x')).toBe(x);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  if (info.project.name === 'mobile') {
    const button = page.getByRole('button', { name: '向右移动', exact: true });
    const rect = (await button.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }],
    });
    await page.clock.runFor(250);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    expect(Number(await player.getAttribute('data-x'))).toBeGreaterThan(Number(x));
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const images = await page.locator('.playfield image').evaluateAll(async (elements) =>
    Promise.all(
      elements.map(
        (element) =>
          new Promise<boolean>((resolve) => {
            const image = new Image();
            image.onload = () => resolve(image.naturalWidth > 0);
            image.onerror = () => resolve(false);
            image.src = element.getAttribute('href')!;
          }),
      ),
    ),
  );
  expect(images.every(Boolean)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('campaign.png'), fullPage: true });
});
