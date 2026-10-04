import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  // install alone still advances wall time during screenshots and protocol round trips.
  // Drive every simulation frame explicitly so held movement cannot leak into those waits.
  await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
});

test('deploys original character art and supports aim, prone, jump, fire and grenade', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByRole('region', { name: '模型战争游戏' })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.rewrite-personas img')
        .evaluateAll((images) => images.every((i) => (i as HTMLImageElement).naturalWidth > 0)),
    )
    .toBe(true);
  await page.screenshot({ path: info.outputPath('deployment.png'), fullPage: true });
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  const world = page.locator('.rewrite-world');
  const missionCard = page.locator('.rewrite-mission-card');
  await expect(missionCard).toBeVisible();
  await expect(missionCard).toContainText('收到不代表处理');
  await expect(missionCard.locator('image')).toHaveAttribute('href', /mission-card-atlas-v1/);
  await expect(world.locator('[data-stage-meme="0"]')).toHaveCount(1);
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyJ');
  await page.clock.runFor(100);
  await expect(world).toHaveAttribute('data-aim-y', '1');
  await expect(page.getByTestId('rewrite-player').locator('.actor-sprite')).toHaveAttribute(
    'data-pose',
    'aim-up',
  );
  await expect(page.getByTestId('rewrite-player').locator('.actor-sprite')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect(page.getByTestId('rewrite-player').locator('.sprite-atlas')).toHaveAttribute(
    'href',
    /aim-motion/,
  );
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyJ');
  await page.keyboard.down('KeyS');
  await page.clock.runFor(50);
  await expect(world).toHaveAttribute('data-crouching', 'true');
  await page.keyboard.up('KeyS');
  await page.keyboard.press('Space');
  await page.clock.runFor(200);
  expect(Number(await world.getAttribute('data-y'))).toBeGreaterThan(1);
  await page.keyboard.press('KeyL');
  await page.clock.runFor(50);
  await expect(world).toHaveAttribute('data-grenades', '2');
  await page.clock.runFor(1100);
  await expect(missionCard).toBeHidden();
  await page.screenshot({ path: info.outputPath('combat.png'), fullPage: true });
  const urls = await world
    .locator('image')
    .evaluateAll((images) => images.map((i) => (i as SVGImageElement).href.baseVal));
  const decoded = await page.evaluate(
    async (urls) =>
      Promise.all(
        urls.map(async (url) => {
          const img = new Image();
          img.src = url;
          await img.decode();
          return img.naturalWidth > 0;
        }),
      ),
    urls,
  );
  expect(decoded.every(Boolean)).toBe(true);
  expect(errors).toEqual([]);
});

test('pause freezes the simulation, clears held input, and restores keyboard focus', async ({
  page,
}) => {
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(250);
  expect(Number(await world.getAttribute('data-x'))).toBeGreaterThan(3);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const frozen = await world.getAttribute('data-x');
  await page.clock.runFor(1500);
  await expect(world).toHaveAttribute('data-x', frozen!);
  await page.keyboard.up('KeyD');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(200);
  await expect(world).toHaveAttribute('data-x', frozen!);
  await page.keyboard.down('KeyD');
  await page.clock.runFor(150);
  await page.keyboard.up('KeyD');
  expect(Number(await world.getAttribute('data-x'))).toBeGreaterThan(Number(frozen));
});

test('multi-pointer movement and shooting release independently on cancel', async ({ page }) => {
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const joystick = page.locator('.rewrite-joystick').first();
  const fire = page.getByRole('button', { name: '射击', exact: true });
  // Synthetic pointer events exercise the UI contract; real capture is covered by the click test.
  await joystick.evaluate((e) => {
    e.setPointerCapture = () => {};
  });
  await fire.evaluate((e) => {
    e.setPointerCapture = () => {};
  });
  const stick = await joystick.boundingBox();
  if (!stick) throw new Error('Joystick is not visible');
  await joystick.dispatchEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    clientX: stick.x + stick.width * 0.85,
    clientY: stick.y + stick.height * 0.5,
  });
  await fire.dispatchEvent('pointerdown', { pointerId: 2 });
  await page.clock.runFor(200);
  const world = page.locator('.rewrite-world');
  expect(Number(await world.getAttribute('data-x'))).toBeGreaterThan(3);
  await joystick.dispatchEvent('pointercancel', { pointerId: 1 });
  const stopped = await world.getAttribute('data-x');
  await page.clock.runFor(150);
  await expect(world).toHaveAttribute('data-x', stopped!);
  await expect(page.getByTestId('rewrite-player').locator('image')).toHaveAttribute(
    'href',
    /claude-shoot/,
  );
  await fire.dispatchEvent('lostpointercapture', { pointerId: 2 });
  await page.clock.runFor(300);
  await expect(page.getByTestId('rewrite-player').locator('image')).toHaveAttribute(
    'href',
    /claude-idle/,
  );
});

test('touch actions work and all controls fit a 320px viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  await page.getByRole('button', { name: '跳跃', exact: true }).click();
  await page.clock.runFor(180);
  expect(Number(await page.locator('.rewrite-world').getAttribute('data-y'))).toBeGreaterThan(1);
  await page.getByRole('button', { name: '手雷', exact: true }).click();
  await page.clock.runFor(50);
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-grenades', '2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: '射击', exact: true })).toBeVisible();
  expect(
    await page.locator('.rewrite-controls').evaluateAll((controls) =>
      controls.every((c) => {
        const bounds = c.getBoundingClientRect();
        return [...c.querySelectorAll('button')].every(
          (b) =>
            b.getBoundingClientRect().right <= bounds.right &&
            b.getBoundingClientRect().left >= bounds.left,
        );
      }),
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('narrow-touch.png'), fullPage: true });
});

test('boss practice exposes eight distinct atlas cells without awarding campaign completion', async ({
  page,
}, info) => {
  const cells = new Set<string>();
  for (let i = 0; i < 8; i++) {
    if (i) await page.reload();
    await page.getByRole('button', { name: '关卡演练', exact: true }).click();
    await page.getByLabel('演练目标', { exact: true }).selectOption(String(i));
    await page.getByRole('button', { name: /GPT 娘/ }).click();
    const bossReaction = page.locator('.rewrite-operator-reaction');
    await expect(bossReaction).toBeVisible();
    await expect(bossReaction).toContainText('九成把握');
    await expect(page.locator('.rewrite-world')).toHaveAttribute('data-stage', String(i + 1));
    const atlas = page.locator('[data-enemy="boss"] [data-boss-art]');
    // Move far enough to see the boss in both desktop and mobile viewports.
    await page.keyboard.down('KeyD');
    await page.clock.runFor(1150);
    await page.keyboard.up('KeyD');
    await expect(atlas).toBeVisible();
    cells.add((await atlas.getAttribute('data-boss-art'))!);
    await expect(atlas.locator('image')).toHaveAttribute('href', /boss-atlas/);
    await expect(page.locator('[data-stage-prop]')).toHaveCount(4);
    if (i === 4 || i === 6 || i === 7) {
      const background = page.locator(
        `.rewrite-world > g > image[href*="${
          i === 4 ? 'token-furnace' : i === 6 ? 'alignment-wall' : 'neural-nest'
        }"]`,
      );
      await expect(background).toBeVisible();
      expect(
        await background.evaluate(async (el) => {
          const image = new Image();
          image.src = (el as SVGImageElement).href.baseVal;
          await image.decode();
          return image.naturalWidth;
        }),
      ).toBe(1881);
    }
    await page.screenshot({ path: info.outputPath(`boss-${i + 1}.png`), fullPage: true });
  }
  expect(cells.size).toBe(8);
});

test('a real-damage practice fight can be won and replayed without a campaign result', async ({
  page,
}) => {
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  await page.keyboard.down('KeyJ');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(1500);
  await page.keyboard.up('KeyD');
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('KeyL');
    await page.clock.runFor(500);
    if (await page.getByRole('dialog', { name: '关卡完成' }).isVisible()) break;
  }
  await page.keyboard.up('KeyJ');
  await expect(page.getByRole('dialog', { name: '关卡完成' })).toBeVisible();
  await expect(
    page.locator('[data-combat-effect="defeat"] [data-boss-state="defeated"]'),
  ).toBeVisible();
  await expect(page.locator('[data-operator-reaction="victory"]')).toHaveCount(1);
  await page.getByRole('button', { name: '再次演练', exact: true }).click();
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-phase', 'running');
  await expect(page.getByTestId('rewrite-player').locator('.actor-sprite')).toHaveAttribute(
    'data-spin',
    '0.0',
  );
  await expect(page.getByTestId('rewrite-player').locator('.actor-sprite')).toHaveAttribute(
    'data-recoil',
    '0.00',
  );
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-stage', '1');
  await expect(page.getByRole('heading', { name: '本局结果' })).toHaveCount(0);
});

test('climbs the entire context tower through real inputs and reaches the summit arena', async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
  await page.getByLabel('演练目标', { exact: true }).selectOption('2');
  await page.getByLabel('演练起始位置', { exact: true }).selectOption('entry');
  await page.getByLabel('演练武器', { exact: true }).selectOption('homing');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await expect(world).toHaveAttribute('data-axis', 'vertical');
  await expect(world).toHaveAttribute('data-arena', 'false');
  await page.keyboard.down('KeyJ');
  const centers = [
    4, 7.5, 11, 14.5, 18, 14.5, 11, 7.5, 4, 7.5, 11, 14.5, 18, 14.5, 11, 7.5, 4, 7.5, 11, 14.5, 18,
    14.5, 11, 11,
  ];
  for (let step = 0; step < centers.length; step++) {
    const target = centers[step]!;
    await page.keyboard.press('Space');
    for (let tick = 0; tick < 24; tick++) {
      const x = Number(await world.getAttribute('data-x'));
      await page.keyboard.up('KeyA');
      await page.keyboard.up('KeyD');
      if (Math.abs(x - target) > 0.3) await page.keyboard.down(x < target ? 'KeyD' : 'KeyA');
      await page.clock.runFor(50);
      if (
        Number(await world.getAttribute('data-y')) >= (step + 1) * 2 &&
        (await world.getAttribute('data-grounded')) === 'true'
      )
        break;
    }
    expect(Number(await world.getAttribute('data-y'))).toBeCloseTo((step + 1) * 2);
    if (step === 5) {
      await expect(world).toHaveAttribute('data-checkpoint-y', '12');
      await expect(world).toHaveAttribute('data-arena', 'false');
      const landedX = await world.getAttribute('data-x');
      await page.screenshot({ path: info.outputPath('vertical-cache.png'), fullPage: true });
      await expect(world).toHaveAttribute('data-x', landedX!);
    }
  }
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyJ');
  await expect(world).toHaveAttribute('data-checkpoint-y', '48');
  expect(Number(await world.getAttribute('data-camera-y'))).toBeGreaterThan(1700);
  await expect(world).toHaveAttribute('data-arena', 'true');
  await expect(page.locator('[data-enemy="boss"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath('vertical-summit.png'), fullPage: true });
});

test('two players have independent keyboard actions and pause releases both controllers', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: '双人协作', exact: true }).click();
  await page.getByLabel('P2 角色', { exact: true }).selectOption('claude');
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  const p1 = page.getByTestId('rewrite-player'),
    p2 = page.getByTestId('rewrite-partner');
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-players', '2');
  await expect(p2.locator('image')).toHaveAttribute('href', /claude-idle/);
  const x1 = await p1.getAttribute('data-x');
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Comma');
  await page.clock.runFor(250);
  await expect(p1).toHaveAttribute('data-x', x1!);
  expect(Number(await p2.getAttribute('data-x'))).toBeGreaterThan(4);
  await expect(p2.locator('.actor-sprite')).toHaveAttribute('data-pose', 'run');
  await expect(p2.locator('.actor-sprite')).toHaveAttribute('data-ready', 'true');
  await expect(p2.locator('.sprite-atlas')).toHaveAttribute('href', /claude-motion/);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyJ');
  await page.keyboard.press('Period');
  await page.clock.runFor(200);
  expect(Number(await p2.getAttribute('data-y'))).toBeGreaterThan(1);
  await expect(p1).toHaveAttribute('data-y', '0.00');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const positions = [await p1.getAttribute('data-x'), await p2.getAttribute('data-x')];
  await page.clock.runFor(1000);
  await expect(p1).toHaveAttribute('data-x', positions[0]!);
  await expect(p2).toHaveAttribute('data-x', positions[1]!);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyJ');
  await page.keyboard.up('Comma');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(150);
  await expect(p1).toHaveAttribute('data-x', positions[0]!);
  await expect(p2).toHaveAttribute('data-x', positions[1]!);
  await page.screenshot({ path: info.outputPath('coop-keyboard.png'), fullPage: true });
});

test('two touch controllers fit 320px and keep simultaneous player actions separate', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: '双人协作', exact: true }).click();
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  const p1Joystick = page.locator('.rewrite-controls').nth(0).locator('.rewrite-joystick');
  const jump = page.getByRole('button', { name: 'P2 跳跃', exact: true });
  await p1Joystick.evaluate((e) => {
    e.setPointerCapture = () => {};
  });
  await jump.evaluate((e) => {
    e.setPointerCapture = () => {};
  });
  const stick = await p1Joystick.boundingBox();
  if (!stick) throw new Error('P1 joystick is not visible');
  await p1Joystick.dispatchEvent('pointerdown', {
    pointerId: 10,
    pointerType: 'touch',
    clientX: stick.x + stick.width * 0.85,
    clientY: stick.y + stick.height * 0.5,
  });
  await jump.dispatchEvent('pointerdown', { pointerId: 20 });
  await page.clock.runFor(200);
  expect(Number(await page.getByTestId('rewrite-player').getAttribute('data-x'))).toBeGreaterThan(
    3,
  );
  expect(Number(await page.getByTestId('rewrite-partner').getAttribute('data-y'))).toBeGreaterThan(
    1,
  );
  await expect(page.getByTestId('rewrite-player')).toHaveAttribute('data-y', '0.00');
  await p1Joystick.dispatchEvent('pointercancel', { pointerId: 10 });
  await jump.dispatchEvent('pointercancel', { pointerId: 20 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const overflow = await page.locator('.rewrite-controls').evaluateAll((controls) =>
    controls.flatMap((c) => {
      const bounds = c.getBoundingClientRect();
      return [...c.querySelectorAll('button')]
        .filter((button) => {
          const buttonBounds = button.getBoundingClientRect();
          return buttonBounds.right > bounds.right || buttonBounds.left < bounds.left;
        })
        .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '');
    }),
  );
  expect(overflow).toEqual([]);
  await page.screenshot({ path: info.outputPath('coop-touch.png'), fullPage: true });
});

test('an offline player rejoins by borrowing a surviving teammate life', async ({ page }, info) => {
  await page.getByRole('button', { name: '双人协作', exact: true }).click();
  await page.getByLabel('P2 角色', { exact: true }).selectOption('claude');
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  await page.keyboard.down('KeyJ');
  await page.keyboard.down('Comma');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(2700);
  await page.keyboard.up('ArrowRight');
  // P2 waits on solid ground; P1 repeatedly runs into the authored first gap.
  for (let i = 0; i < 12; i++) {
    await page.clock.runFor(500);
    if (await page.getByRole('button', { name: '为 P1 分出一命', exact: true }).isVisible()) break;
  }
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyJ');
  await page.keyboard.up('Comma');
  await expect(page.getByTestId('rewrite-player')).toHaveCount(0);
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-phase', 'running');
  const donorLives = Number(await page.getByTestId('rewrite-partner').getAttribute('data-lives'));
  await page.getByRole('button', { name: '为 P1 分出一命', exact: true }).click();
  await expect(page.getByTestId('rewrite-player')).toHaveAttribute('data-lives', '1');
  await expect(page.getByTestId('rewrite-partner')).toHaveAttribute(
    'data-lives',
    String(donorLives - 1),
  );
  await page.screenshot({ path: info.outputPath('coop-reconnect.png'), fullPage: true });
});

test('both players defeat a scaled boss and restart the same party', async ({ page }, info) => {
  await page.getByRole('button', { name: '双人协作', exact: true }).click();
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  await page.keyboard.down('KeyJ');
  await page.keyboard.down('Comma');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(1250);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ArrowRight');
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('KeyL');
    await page.keyboard.press('Slash');
    await page.clock.runFor(500);
    if (await page.getByRole('dialog', { name: '关卡完成' }).isVisible()) break;
  }
  await page.keyboard.up('KeyJ');
  await page.keyboard.up('Comma');
  await expect(page.getByRole('dialog', { name: '关卡完成' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('coop-boss-clear.png'), fullPage: true });
  await page.getByRole('button', { name: '再次演练', exact: true }).click();
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-players', '2');
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-phase', 'running');
  await expect(page.getByTestId('rewrite-player')).toHaveAttribute('data-lives', '3');
  await expect(page.getByTestId('rewrite-partner')).toHaveAttribute('data-lives', '3');
});

for (const [stage, duo] of [
  [1, false],
  [5, true],
] as const) {
  test(`depth base ${stage + 1} with duo=${duo} clears a real first room and renders rear-facing operators`, async ({
    page,
  }, info) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (duo) {
      await page.getByRole('button', { name: '双人协作', exact: true }).click();
      await page.getByLabel('P2 角色', { exact: true }).selectOption('deepseek');
    }
    await page.getByRole('button', { name: '关卡演练', exact: true }).click();
    await page.getByLabel('演练目标', { exact: true }).selectOption(String(stage));
    await page.getByLabel('演练起始位置', { exact: true }).selectOption('entry');
    await page.getByLabel('演练武器', { exact: true }).selectOption('homing');
    await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
    const world = page.locator('.rewrite-world'),
      base = page.locator('.depth-battle');
    await expect(world).toHaveAttribute('data-axis', 'depth');
    await expect(base).toHaveAttribute('data-room', '1');
    await expect(base).toHaveAttribute('data-cores', '3');
    if (duo) await page.getByRole('button', { name: 'P1 跳跃', exact: true }).click();
    else await page.keyboard.press('KeyK');
    await page.clock.runFor(200);
    expect(Number(await world.getAttribute('data-y'))).toBeGreaterThan(1);
    await page.clock.runFor(650);
    await expect(page.getByTestId('rewrite-player').locator('.actor-sprite')).toHaveAttribute(
      'data-ready',
      'true',
    );
    await expect(page.getByTestId('rewrite-player').locator('.sprite-atlas')).toHaveAttribute(
      'href',
      /depth-motion/,
    );
    await page.screenshot({ path: info.outputPath('depth-entry.png'), fullPage: true });
    const loaded = await base.locator('image').evaluateAll(async (images) =>
      Promise.all(
        [...new Set(images.map((i) => (i as SVGImageElement).href.baseVal))].map(async (url) => {
          const img = new Image();
          img.src = url;
          await img.decode();
          return img.naturalWidth > 0;
        }),
      ),
    );
    expect(loaded.every(Boolean)).toBe(true);
    await page.keyboard.down('KeyJ');
    if (duo) await page.keyboard.down('Comma');
    let advancing = false;
    for (let tick = 0; tick < 300; tick++) {
      if (Number(await base.getAttribute('data-room')) > 1) break;
      const x = Number(await world.getAttribute('data-x'));
      const cores = await base.locator('[data-depth-target="core"]').evaluateAll((nodes) =>
        nodes.map((n) => ({
          x: Number(n.getAttribute('data-target-x')),
          y: Number(n.getAttribute('data-target-y')),
        })),
      );
      const target = cores.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
      if (!target && !advancing) {
        advancing = true;
        await page.keyboard.down('KeyW');
        if (duo) await page.keyboard.down('ArrowUp');
      }
      await page.keyboard.up('KeyA');
      await page.keyboard.up('KeyD');
      if (duo) {
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.up('ArrowRight');
      }
      if (target && Math.abs(target.x - x) > 0.35) {
        const right = target.x > x;
        await page.keyboard.down(right ? 'KeyD' : 'KeyA');
        if (duo) await page.keyboard.down(right ? 'ArrowRight' : 'ArrowLeft');
      }
      if (
        ((await world.getAttribute('data-grounded')) === 'true' && (target?.y ?? 0) > 1.8) ||
        tick % 9 === 0
      ) {
        await page.keyboard.press('Space');
        if (duo) await page.keyboard.press('Period');
      }
      await page.clock.runFor(100);
    }
    await page.keyboard.up('KeyJ');
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    if (duo) {
      await page.keyboard.up('Comma');
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowRight');
      await page.keyboard.up('ArrowUp');
    }
    await expect(base).toHaveAttribute('data-room', '2');
    await expect(world).toHaveAttribute('data-phase', 'running');
    await page.screenshot({ path: info.outputPath('depth-second-room.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('host restart preserves the deployed party and difficulty across component remount', async ({
  page,
}) => {
  await page.getByRole('button', { name: /硬核/ }).click();
  await page.getByRole('button', { name: '双人协作', exact: true }).click();
  await page.getByLabel('P2 角色', { exact: true }).selectOption('claude');
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-players', '2');
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-stage', '1');
  await expect(page.locator('.rewrite-world')).toHaveAttribute('data-tick', '0');
  await expect(page.locator('.rewrite-team-hud')).toContainText('硬核');
  await expect(page.getByRole('button', { name: 'P1 射击', exact: true })).toBeEnabled();
  await expect(page.getByTestId('rewrite-player').locator('image')).toHaveAttribute(
    'href',
    /gpt-idle/,
  );
  await expect(page.getByTestId('rewrite-partner').locator('image')).toHaveAttribute(
    'href',
    /claude-idle/,
  );
  await page.keyboard.down('KeyJ');
  await page.clock.runFor(80);
  await page.keyboard.up('KeyJ');
  await expect(page.getByTestId('rewrite-player').locator('image')).toHaveAttribute(
    'href',
    /gpt-shoot/,
  );
});
