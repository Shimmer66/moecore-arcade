import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-09-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-26T00:00:01Z'));
  await page.goto('/#/games/duel');
  await expect(page.getByRole('button', { name: '选择DeepSeek 娘' })).toBeVisible();
}
async function begin(page: Page) {
  await page.getByRole('button', { name: '开打 →', exact: true }).click();
  await page.clock.runFor(3100);
  await expect(page.locator('.duel')).toHaveAttribute('data-phase', 'fight');
}
async function finishNaturally(page: Page) {
  for (let i = 0; i < 60; i++) {
    if (await page.getByRole('region', { name: '对局结算' }).count()) return;
    await page.clock.runFor(5000);
  }
  await expect(page.getByRole('region', { name: '对局结算' })).toBeVisible();
}

test('three fighters load, keyboard movement pauses and clears held input, and host restart resets the match', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.getByRole('button', { name: '选择豆包娘' }).click();
  await expect(page.getByRole('button', { name: '选择豆包娘' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: info.outputPath('duel-selection.png'), fullPage: true });
  await begin(page);
  const f = page.getByTestId('duel-fighter-0');
  const before = Number(await f.getAttribute('data-x'));
  await page.keyboard.down('KeyD');
  await page.clock.runFor(200);
  expect(Number(await f.getAttribute('data-x'))).toBeGreaterThan(before);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const frozen = await f.getAttribute('data-x'),
    timer = await page.locator('.duel').getAttribute('data-timer');
  await page.clock.runFor(3000);
  expect(await f.getAttribute('data-x')).toBe(frozen);
  expect(await page.locator('.duel').getAttribute('data-timer')).toBe(timer);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(200);
  expect(await f.getAttribute('data-x')).toBe(frozen);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyU');
  await page.clock.runFor(400);
  await page.screenshot({ path: info.outputPath('duel-battle.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.duel')).toHaveAttribute('data-phase', 'countdown');
  await expect(page.getByTestId('duel-fighter-0')).toHaveAttribute('data-hp', '1000');
  await expect(page.getByTestId('duel-fighter-0').locator('[data-character]')).toHaveAttribute(
    'data-character',
    'doubao',
  );
  expect(errors).toEqual([]);
});

test('a real CPU match finishes, replays with the same fighters and offers a fresh character selection', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await open(page);
  await page.getByRole('button', { name: '选择GPT 娘' }).click();
  await page.getByLabel('选择对手').selectOption('deepseek');
  await begin(page);
  await finishNaturally(page);
  const result = page.getByRole('region', { name: '对局结算' });
  await expect(result).toContainText('GPT 娘 VS DeepSeek 娘');
  await page.screenshot({ path: info.outputPath('duel-result.png'), fullPage: true });
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.duel')).toHaveAttribute('data-round', '1');
  await expect(page.locator('.duel')).toHaveAttribute('data-phase', 'countdown');
  await expect(page.getByTestId('duel-fighter-0').locator('[data-character]')).toHaveAttribute(
    'data-character',
    'gpt',
  );
  await finishNaturally(page);
  await page.getByRole('button', { name: '换角色', exact: true }).click();
  await expect(page.locator('.duel')).toHaveAttribute('data-phase', 'select');
  await page.getByRole('button', { name: '选择豆包娘' }).click();
  await begin(page);
  await expect(page.getByTestId('duel-fighter-0').locator('[data-character]')).toHaveAttribute(
    'data-character',
    'doubao',
  );
});

test('touch holds direction while another finger jumps, and narrow screens keep all actions reachable', async ({
  page,
}, info) => {
  test.skip(
    !info.project.name.startsWith('mobile'),
    'Physical touch coverage runs in the mobile project.',
  );
  await open(page);
  await begin(page);
  const right = page.getByRole('button', { name: '向右移动', exact: true });
  await right.scrollIntoViewIfNeeded();
  const r = (await right.boundingBox())!,
    j = (await page.getByRole('button', { name: '跳跃', exact: true }).boundingBox())!;
  const client = await page.context().newCDPSession(page);
  const first = { id: 1, x: r.x + r.width / 2, y: r.y + r.height / 2 };
  const second = { id: 2, x: j.x + j.width / 2, y: j.y + j.height / 2 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await page.clock.runFor(100);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [first, second],
  });
  await page.clock.runFor(180);
  expect(Number(await page.getByTestId('duel-fighter-0').getAttribute('data-y'))).toBeGreaterThan(
    0,
  );
  expect(Number(await page.getByTestId('duel-fighter-0').getAttribute('data-x'))).toBeGreaterThan(
    280,
  );
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const name of ['轻击', '重击', '防御', '特色技能', '投技', '终结技']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    const rect = (await button.boundingBox())!;
    expect(rect.width).toBeGreaterThanOrEqual(48);
    expect(rect.height).toBeGreaterThanOrEqual(48);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(320);
  }
  await page.screenshot({ path: info.outputPath('duel-narrow.png'), fullPage: true });
});

test('normal keyboard attacks earn meter and release a visible ultimate during an active match', async ({
  page,
}, info) => {
  test.skip(
    info.project.name.startsWith('mobile'),
    'Keyboard combat is covered on desktop; multi-touch has its own test.',
  );
  test.setTimeout(120000);
  await open(page);
  await page.getByRole('button', { name: '选择GPT 娘' }).click();
  await page.getByLabel('选择对手').selectOption('gpt');
  await begin(page);
  let direction = '',
    sawUltimate = false,
    dealtDamage = false;
  for (let n = 0; n < 1000; n++) {
    const phase = await page.locator('.duel').getAttribute('data-phase');
    if (phase === 'done') break;
    if (phase === 'cinematic') {
      if ((await page.locator('.duel-ultimate').getAttribute('data-actor')) !== '0') {
        await page.clock.runFor(1300);
        continue;
      }
      sawUltimate = true;
      await expect(page.locator('.duel-ultimate')).toBeVisible();
      await page.clock.runFor(600);
      await page.screenshot({ path: info.outputPath('duel-ultimate.png'), fullPage: true });
      break;
    }
    if (phase !== 'fight') {
      if (direction) await page.keyboard.up(direction);
      direction = '';
      await page.clock.runFor(300);
      continue;
    }
    const fighters = await page.locator('[data-testid^="duel-fighter-"]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        x: Number(node.getAttribute('data-x')),
        y: Number(node.getAttribute('data-y')),
        hp: Number(node.getAttribute('data-hp')),
        energy: Number(node.getAttribute('data-energy')),
        action: node.getAttribute('data-action'),
      })),
    );
    const [me, enemy] = fighters;
    expect(me).toBeTruthy();
    expect(enemy).toBeTruthy();
    if (enemy!.hp < 1000) dealtDamage = true;
    const distance = Math.abs(enemy!.x - me!.x);
    if (distance <= 64) await page.keyboard.down('KeyL');
    else await page.keyboard.up('KeyL');
    const nextDirection = distance > 55 ? (enemy!.x > me!.x ? 'KeyD' : 'KeyA') : '';
    if (nextDirection !== direction) {
      if (direction) await page.keyboard.up(direction);
      if (nextDirection) await page.keyboard.down(nextDirection);
      direction = nextDirection;
    }
    // Confirm a grounded light hit before committing meter; airborne/knocked-down foes
    // cannot be finished by a grounded super. Sampling speeds up around this window.
    if (me!.energy >= 100) {
      if (
        me!.y === 0 &&
        enemy!.y === 0 &&
        enemy!.action === 'hurt' &&
        ['light1', 'light2'].includes(me!.action ?? '')
      )
        await page.keyboard.press('KeyI');
      else if (
        distance < 76 &&
        me!.y === 0 &&
        enemy!.y === 0 &&
        !['down', 'hurt'].includes(enemy!.action ?? '')
      )
        await page.keyboard.press('KeyJ');
    } else if (distance < 64 && enemy!.action === 'guard') await page.keyboard.press('KeyO');
    else if (n % 4 === 0) await page.keyboard.press('KeyU');
    else await page.keyboard.press('KeyJ');
    await page.clock.runFor(me!.energy >= 95 ? 33 : 150);
  }
  if (direction) await page.keyboard.up(direction);
  await page.keyboard.up('KeyL');
  expect(dealtDamage).toBe(true);
  expect(sawUltimate).toBe(true);
});
