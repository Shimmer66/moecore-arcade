import { expect, test } from '@playwright/test';

async function waitForEntrance(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
}

async function prepareBarrageBattle(page: import('@playwright/test').Page) {
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await page.getByRole('button', { name: '开始对战' }).click();
  await waitForEntrance(page);
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
  await page.getByLabel('角色语音').uncheck();
  await page.getByLabel('打击音效').uncheck();
  await page.getByLabel('待机环境声').uncheck();
  await page.getByTestId('stardust-arena').click();
  for (let step = 0; step < 80; step++) {
    const [first, second] = await page
      .locator('[data-testid="stardust-p1"], [data-testid="stardust-p2"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => Number.parseFloat((node as HTMLElement).style.left)),
      );
    if (Math.abs(second! - first!) <= 1.5) {
      await page
        .locator('.controls section')
        .first()
        .getByRole('button', { name: /替身连打/ })
        .click();
      return;
    }
    const key = second! > first! ? 'KeyD' : 'KeyA';
    await page.keyboard.down(key);
    await page.clock.runFor(16);
    await page.keyboard.up(key);
  }
  throw new Error('Could not approach the barrage target');
}

test('barrage repeatedly damages in range, respects guard and pause, and expires', async ({
  page,
}) => {
  await prepareBarrageBattle(page);
  const attacker = page.getByTestId('stardust-p1');
  const target = page.getByTestId('stardust-p2');
  const hp = async () => Number(await target.getAttribute('data-hp'));
  expect(await hp()).toBe(485);
  const position = await target.evaluate((element) => (element as HTMLElement).style.left);
  await page.clock.runFor(960);
  expect(await hp()).toBe(470);
  expect(await target.evaluate((element) => (element as HTMLElement).style.left)).toBe(position);

  await page.keyboard.down('ArrowRight');
  await page.clock.runFor(240);
  await page.keyboard.up('ArrowRight');
  await page.clock.runFor(3200);
  const outsideHp = await hp();
  await page.clock.runFor(960);
  expect(await hp()).toBe(outsideHp);
  await page.keyboard.down('KeyD');
  await page.clock.runFor(128);
  await page.keyboard.up('KeyD');
  const reenteredHp = await hp();
  await page.clock.runFor(640);
  expect(await hp()).toBeLessThan(reenteredHp);

  await page.keyboard.down('Digit3');
  await page.clock.runFor(32);
  const guardedHp = await hp();
  await page.clock.runFor(960);
  expect(guardedHp - (await hp())).toBeGreaterThanOrEqual(3);
  expect(guardedHp - (await hp())).toBeLessThanOrEqual(6);
  await page.keyboard.up('Digit3');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const pausedHp = await hp();
  const remaining = await attacker.getAttribute('data-barrage-ms');
  await page.clock.runFor(2_000);
  expect(await hp()).toBe(pausedHp);
  await expect(attacker).toHaveAttribute('data-barrage-ms', remaining!);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.keyboard.down('Digit3');
  await page.clock.runFor(Number(remaining) + 64);
  await page.keyboard.up('Digit3');
  await expect(attacker).toHaveAttribute('data-attack', 'idle');
  expect(await hp()).toBeLessThan(pausedHp);
  const endedHp = await hp();
  await page.clock.runFor(960);
  expect(await hp()).toBe(endedHp);
});

test('two bounded barrages end only the round and pause the round break', async ({ page }) => {
  test.setTimeout(45_000);
  await prepareBarrageBattle(page);
  await page.clock.runFor(10_032);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '250');
  await page.keyboard.press('KeyU');
  await page.clock.runFor(9_650);
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'round-break');
  await expect(page.getByTestId('stardust-score')).toContainText('P1 1 : 0 P2');
  await expect(page.getByRole('region', { name: '对局结算' })).toHaveCount(0);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '0');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.clock.runFor(3_000);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '0');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(1_800);
  await page.keyboard.up('KeyD');
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'fight');
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '500');
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-barrage-ms', '0');
  await expect(page.getByTestId('stardust-score')).toContainText('第 2 回合');
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-stand-mode', 'attached');
  expect(
    await page.getByTestId('stardust-p1').evaluate((el) => (el as HTMLElement).style.left),
  ).toBe('25%');
  await page.clock.runFor(1_000);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '500');
});

test('selects characters and starts local versus combat', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await expect(
    page.getByTestId('stardust-game').getByRole('heading', { name: '星尘远征：替身决斗' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('group', { name: '玩家一选择角色' })
      .getByRole('button', { name: /空条承太郎/ })
      .locator('.roster-art'),
  ).toHaveCSS('background-image', /jotaro-star-platinum-chibi-v1/);
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await page
    .getByRole('group', { name: '玩家一选择角色' })
    .getByRole('button', { name: /空条承太郎/ })
    .click();
  if (await page.getByRole('dialog').isVisible())
    await page.getByRole('dialog').getByRole('button', { name: '确认选择' }).click();
  await page
    .getByRole('group', { name: '玩家二选择角色' })
    .getByRole('button', { name: /花京院典明/ })
    .click();
  if (await page.getByRole('dialog').isVisible())
    await page.getByRole('dialog').getByRole('button', { name: '确认选择' }).click();
  await page.getByRole('button', { name: '开始对战' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-mode', 'versus');
  const intro = page.getByTestId('stardust-intro');
  await expect(intro).toContainText('空条承太郎');
  await expect(intro).toContainText('白金之星', { timeout: 2500 });
  await expect(intro).toContainText('花京院典明', { timeout: 3500 });
  await expect(intro).toContainText('绿色法皇', { timeout: 4500 });
  await expect(intro).toBeHidden({ timeout: 6500 });
  await expect(page.getByTestId('stardust-p1')).toBeVisible();
  await expect(page.getByTestId('stardust-p2')).toBeVisible();
  await expect(page.getByTestId('stardust-p1').locator('.fighter-art')).toHaveCSS(
    'background-image',
    /jotaro-chibi-action-sheet-v1-clean-v1/,
  );
  const initialFrame = await page
    .getByTestId('stardust-p1')
    .locator('.fighter-art')
    .evaluate((element) => getComputedStyle(element).backgroundPosition);
  await expect
    .poll(
      () =>
        page
          .getByTestId('stardust-p1')
          .locator('.fighter-art')
          .evaluate((element) => getComputedStyle(element).backgroundPosition),
      { timeout: 1200 },
    )
    .not.toBe(initialFrame);
  const fighterArtBox = await page.getByTestId('stardust-p1').locator('.fighter-art').boundingBox();
  expect(fighterArtBox).not.toBeNull();
  expect(fighterArtBox!.width).toBeCloseTo(fighterArtBox!.height, 0);
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByTestId('stardust-arena').click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(272);
  await page.keyboard.up('KeyD');
  await page.locator('.controls section').first().getByRole('button', { name: /轻拳/ }).click();
  await expect(page.getByText(/空条承太郎 · 1 HIT/)).toBeVisible();
  await page.clock.runFor(300);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-attack', 'idle');
  await page
    .locator('.controls section')
    .first()
    .getByRole('button', { name: /替身连打/ })
    .click();
  await expect(page.getByText(/欧拉！欧拉！欧拉！/)).toBeVisible();
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-attack', 'stand');
  const initialBarrageMs = Number(
    await page.getByTestId('stardust-p1').getAttribute('data-barrage-ms'),
  );
  expect(initialBarrageMs).toBeGreaterThan(9_500);
  await page.clock.runFor(1_100);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-attack', 'stand');
  const continuingBarrageMs = Number(
    await page.getByTestId('stardust-p1').getAttribute('data-barrage-ms'),
  );
  expect(continuingBarrageMs).toBeGreaterThan(7_500);
  await expect(page.getByLabel('打击音效')).toBeChecked();
  await expect(page.getByLabel('角色语音')).toBeChecked();
  await expect(page.getByLabel('待机环境声')).toBeChecked();
  await page.getByLabel('角色语音').uncheck();
  await expect(page.getByText(/欧拉！欧拉！欧拉！/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('plays movement, jump and crouch poses and returns to idle', async ({ page }) => {
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await page.getByRole('button', { name: '开始对战' }).click();
  await waitForEntrance(page);
  const fighter = page.getByTestId('stardust-p1');

  await page.keyboard.down('KeyD');
  await expect(fighter).toHaveAttribute('data-pose', 'move');
  await page.keyboard.up('KeyD');

  await page.keyboard.press('KeyW');
  await expect(fighter).toHaveAttribute('data-pose', 'jump');
  await expect(fighter.locator('.fighter-art')).toHaveCSS(
    'background-image',
    /jotaro-extended-motion-v1/,
  );
  await expect(fighter).toHaveAttribute('data-pose', 'idle', { timeout: 2_000 });

  await page.keyboard.down('KeyS');
  await expect(fighter).toHaveAttribute('data-pose', 'crouch');
  await expect(fighter.locator('.fighter-art')).toHaveCSS(
    'background-image',
    /jotaro-extended-motion-v1/,
  );
  await page.keyboard.up('KeyS');
  await expect(fighter).toHaveAttribute('data-pose', 'idle', { timeout: 800 });
});

test('Jotaro attacks never damage their own owner', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await page.getByRole('button', { name: '开始对战' }).click();
  await waitForEntrance(page);
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByTestId('stardust-arena').click();
  const jotaro = page.getByTestId('stardust-p1');
  const art = jotaro.locator('.fighter-art');
  const hp = () => jotaro.getAttribute('data-hp');

  await page.keyboard.press('KeyJ');
  await expect(art).toHaveCSS('background-position', '0% 50%');
  await page.clock.runFor(160);
  await expect(art).toHaveCSS('background-position', '33.3333% 50%');
  await page.clock.runFor(160);
  expect(await hp()).toBe('500');

  await page.keyboard.press('KeyK');
  await expect(art).toHaveCSS('background-position', '66.6667% 50%');
  await page.clock.runFor(272);
  await expect(art).toHaveCSS('background-position', '100% 50%');
  await page.clock.runFor(160);

  await page.keyboard.press('KeyU');
  const barrageFrames = new Set<string>();
  for (let sample = 0; sample < 8; sample += 1) {
    await page.clock.runFor(112);
    await expect(jotaro).toHaveAttribute('data-pose', 'stand');
    await expect(art).toHaveCSS('background-position-y', '50%');
    barrageFrames.add(
      await art.evaluate((element) => getComputedStyle(element).backgroundPositionX),
    );
  }
  expect(barrageFrames).toEqual(new Set(['0%', '33.3333%']));
  expect(await hp()).toBe('500');

  await page.keyboard.press('KeyF');
  await expect(jotaro).toHaveAttribute('data-stand-mode', 'detached');
  await page.clock.runFor(900);
  expect(await hp()).toBe('500');

  await page.keyboard.press('KeyF');
  await page.clock.runFor(8500);
  await page.keyboard.down('ArrowLeft');
  await page.clock.runFor(240);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('Digit1');
  await page.clock.runFor(128);
  await expect(jotaro).toHaveAttribute('data-hp', '493');
  await expect(jotaro).toHaveAttribute('data-pose', 'hurt');
  await expect(art).toHaveCSS('background-position', '33.3333% 100%');
  await page.clock.runFor(300);
  await expect(jotaro).toHaveAttribute('data-pose', 'idle');
});

test('pure solo adventure creates no partner', async ({ page }) => {
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /纯单人冒险/ }).click();
  await expect(page.getByTestId('stardust-enemy-route').locator('li')).toHaveCount(14);
  await expect(page.getByTestId('stardust-enemy-route')).toContainText('宠物店');
  await expect(page.getByTestId('stardust-enemy-route')).toContainText('DIO');
  await page.getByRole('button', { name: '开始远征' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-mode', 'solo');
  await waitForEntrance(page);
  await expect(page.getByTestId('stardust-partner')).toHaveCount(0);
  await expect(page.getByTestId('stardust-partner-hud')).toHaveCount(0);
  await expect(page.getByText(/纯单人远征/)).toBeVisible();
  await expect(page.getByText('格雷·弗莱')).toBeVisible();
});

test('single-player adventure uses an AI partner and checkpoint', async ({ page }) => {
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /AI伙伴冒险/ }).click();
  await page.getByRole('button', { name: '开始远征' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-mode', 'story');
  await waitForEntrance(page);
  await expect(page.getByTestId('stardust-partner')).toBeVisible();
  await expect(page.getByTestId('stardust-partner-hud')).toContainText('AI伙伴');
  await expect(page.getByTestId('stardust-revives')).toContainText('◆');
  await expect(page.getByText('格雷·弗莱')).toBeVisible();
  await expect(page.getByTestId('stardust-p2').locator('.fighter-art')).toHaveCSS(
    'background-image',
    /gray-fly-chibi-action-sheet-v1-clean-v1/,
  );
});

test('co-op adventure gives player two a controllable partner and three revives', async ({
  page,
}) => {
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /双人冒险/ }).click();
  await page.getByRole('button', { name: '开始远征' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-mode', 'coop');
  await waitForEntrance(page);
  await expect(page.getByTestId('stardust-partner')).toBeVisible();
  await expect(page.getByTestId('stardust-partner-hud')).toContainText('P2伙伴');
  await expect(page.getByTestId('stardust-revives')).toContainText('◆◆◆');
  await expect(page.locator('.controls section').nth(1)).toContainText('P2');
});

test('practice mode has no countdown and exposes a passive dummy', async ({ page }) => {
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /练习模式/ }).click();
  await page.getByRole('button', { name: '开始练习' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-mode', 'practice');
  await waitForEntrance(page);
  await expect(page.locator('.clock')).toContainText('∞');
  await expect(page.getByText(/木桩不会主动攻击/)).toBeVisible();
});

test('challenge mode selects any enemy and starts an AI duel', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem('moecore:stardust:v1:enemy-kills', JSON.stringify({ 'gray-fly': 29 }));
  });
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /挑战模式/ }).click();
  await expect(page.getByRole('group', { name: '玩家一选择角色' }).locator('button')).toHaveCount(
    4,
  );
  await expect(page.getByRole('group', { name: '选择挑战敌人' }).locator('button')).toHaveCount(14);

  await page.getByTestId('stardust-choice-p2-gray-fly').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('击败进度 29 / 30');
  await dialog.getByRole('button', { name: '选择挑战目标' }).click();
  await page.getByRole('button', { name: '开始挑战' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-mode', 'challenge');
  await waitForEntrance(page);
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
  const enemyStart = Number(await page.getByTestId('stardust-p2').getAttribute('data-hp'));
  await page.clock.runFor(4_000);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', String(enemyStart));
  expect(Number(await page.getByTestId('stardust-p1').getAttribute('data-hp'))).toBeLessThan(500);
});

test('survives one simulated minute of repeated combat without leaving the game', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  let crashed = false;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('crash', () => {
    crashed = true;
  });
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /练习模式/ }).click();
  await page.getByRole('button', { name: '开始练习' }).click();
  await waitForEntrance(page);
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
  await page.getByLabel('角色语音').uncheck();
  await page.getByLabel('打击音效').uncheck();
  await page.getByLabel('待机环境声').uncheck();

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.keyboard.press(cycle % 4 === 0 ? 'KeyF' : cycle % 3 === 0 ? 'KeyK' : 'KeyJ');
    if (cycle % 4 === 1) await page.keyboard.press('KeyE');
    if (cycle % 10 === 0) await page.keyboard.press('KeyW');
    await page.clock.runFor(3_000);
    if (cycle % 5 === 0) await expect(page.getByTestId('stardust-game')).toBeVisible();
  }

  expect(crashed).toBe(false);
  expect(errors).toEqual([]);
  expect(page.url()).toContain('/#/games/stardust');
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'fight');
  expect(await page.locator('[data-testid="stardust-hit-effect"]').count()).toBeLessThanOrEqual(12);
});

test('barrage phrases are not retriggered by 300ms pulses and stop at 10 active seconds', async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const calls: { src: string; at: number }[] = [];
    const clips: HTMLMediaElement[] = [];
    const timers = new WeakMap<HTMLMediaElement, number>();
    Object.assign(window, { barrageRecordingCalls: calls, barrageRecordingClips: clips });
    HTMLMediaElement.prototype.play = function () {
      if (!clips.includes(this)) {
        clips.push(this);
        Object.defineProperty(this, 'paused', { get: () => !timers.has(this) });
      }
      calls.push({ src: new URL(this.src).pathname, at: performance.now() });
      timers.set(
        this,
        window.setTimeout(() => {
          timers.delete(this);
          this.dispatchEvent(new Event('ended'));
        }, 2_400),
      );
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      window.clearTimeout(timers.get(this));
      timers.delete(this);
    };
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        cancel() {},
        speak(utterance: SpeechSynthesisUtterance) {
          calls.push({ src: `unexpected-synthesis:${utterance.text}`, at: performance.now() });
        },
      },
    });
  });
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await page.getByRole('button', { name: '开始对战' }).click();
  await waitForEntrance(page);
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
  const calls = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            barrageRecordingCalls: { src: string; at: number }[];
          }
        ).barrageRecordingCalls,
    );
  await page
    .locator('.controls section')
    .first()
    .getByRole('button', { name: /替身连打/ })
    .click();
  expect(await calls()).toHaveLength(1);
  await page.clock.runFor(960);
  const firstCalls = await calls();
  expect(firstCalls).toHaveLength(1);
  expect(firstCalls.every((call) => call.src === '/audio/stardust/jotaro-ora.wav')).toBe(true);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const fighter = page.getByTestId('stardust-p1');
  const remaining = await fighter.getAttribute('data-barrage-ms');
  const matchClock = await page.locator('.clock').innerText();
  await page.clock.runFor(2_000);
  await expect(fighter).toHaveAttribute('data-barrage-ms', remaining!);
  expect(await page.locator('.clock').innerText()).toBe(matchClock);
  expect(await calls()).toHaveLength(1);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(9_024);
  await expect(fighter).toHaveAttribute('data-attack', 'stand');
  expect(await calls()).toHaveLength(5);
  const resumedCalls = (await calls()).slice(1);
  for (let index = 1; index < resumedCalls.length; index += 1) {
    expect(resumedCalls[index]!.at - resumedCalls[index - 1]!.at).toBeGreaterThanOrEqual(2_400);
  }
  await page.clock.runFor(64);
  await expect(fighter).toHaveAttribute('data-attack', 'idle');
  await expect(fighter).toHaveAttribute('data-barrage-ms', '0');
  await page.clock.runFor(600);
  expect(await calls()).toHaveLength(5);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { barrageRecordingClips: HTMLMediaElement[] }
      ).barrageRecordingClips.every((clip) => clip.paused && clip.currentTime === 0),
    ),
  ).toBe(true);
});

test('barrage recordings decode, play without synthesis and stop on pause', async ({ page }) => {
  await page.addInitScript(() => {
    const clips: HTMLMediaElement[] = [];
    const played: string[] = [];
    const speech: string[] = [];
    Object.assign(window, { barrageMedia: { clips, played, speech } });
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!clips.includes(this)) clips.push(this);
      return originalPlay.call(this).then(() => {
        played.push(new URL(this.src).pathname);
      });
    };
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        cancel() {},
        speak(utterance: SpeechSynthesisUtterance) {
          speech.push(utterance.text);
        },
      },
    });
  });
  await page.goto('/#/games/stardust');
  const decoded = await page.evaluate(async () => {
    const context = new AudioContext();
    try {
      return await Promise.all(
        ['/audio/stardust/jotaro-ora.wav', '/audio/stardust/dio-muda.wav'].map(async (src) => {
          const response = await fetch(src);
          if (!response.ok) throw new Error(`Missing recording: ${src}`);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          const samples = buffer.getChannelData(0);
          const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
          const rms = Math.sqrt(
            samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length,
          );
          return { src, duration: buffer.duration, peak, rms };
        }),
      );
    } finally {
      await context.close();
    }
  });
  for (const clip of decoded) {
    expect(clip.duration).toBeCloseTo(2.4, 3);
    expect(clip.peak).toBeGreaterThan(0.48);
    expect(clip.peak).toBeLessThan(0.53);
    if (clip.src.endsWith('dio-muda.wav')) {
      expect(clip.rms).toBeGreaterThan(0.09);
      expect(clip.rms).toBeLessThan(0.15);
    }
  }
  await page.getByRole('button', { name: /练习模式/ }).click();
  await page.getByRole('button', { name: '开始练习' }).click();
  await waitForEntrance(page);
  await page
    .locator('.controls section')
    .first()
    .getByRole('button', { name: /替身连打/ })
    .click();
  const playback = () =>
    page.evaluate(() => {
      const media = (
        window as unknown as {
          barrageMedia: { clips: HTMLMediaElement[]; played: string[]; speech: string[] };
        }
      ).barrageMedia;
      return {
        played: media.played,
        speech: media.speech,
        position: media.clips[0]?.currentTime ?? 0,
        volume: media.clips[0]?.volume ?? 0,
        stopped: media.clips.every((clip) => clip.paused && clip.currentTime === 0),
      };
    });
  await expect.poll(async () => (await playback()).position).toBeGreaterThan(0.7);
  expect((await playback()).played).toHaveLength(1);
  expect((await playback()).volume).toBeLessThanOrEqual(0.75);
  expect((await playback()).played.every((src) => src === '/audio/stardust/jotaro-ora.wav')).toBe(
    true,
  );
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect.poll(async () => (await playback()).stopped).toBe(true);
  expect((await playback()).speech).toEqual([]);
  const pausedCount = (await playback()).played.length;
  await page.waitForTimeout(400);
  expect((await playback()).played).toHaveLength(pausedCount);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect.poll(async () => (await playback()).position).toBeGreaterThan(0.4);
  await page.getByLabel('角色语音').uncheck();
  await expect.poll(async () => (await playback()).stopped).toBe(true);
  const mutedCount = (await playback()).played.length;
  await page.waitForTimeout(400);
  expect((await playback()).played).toHaveLength(mutedCount);
});
