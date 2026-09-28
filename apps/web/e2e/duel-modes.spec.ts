import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-09-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-26T00:00:01Z'));
  await page.goto('/#/games/duel');
  await expect(page.getByRole('button', { name: '选择GPT 娘' })).toBeVisible();
}
async function positions(page: Page) {
  return page.locator('[data-testid^="duel-fighter-"]').evaluateAll((nodes) =>
    nodes.map((n) => ({
      x: Number(n.getAttribute('data-x')),
      hp: Number(n.getAttribute('data-hp')),
      energy: Number(n.getAttribute('data-energy')),
      action: n.getAttribute('data-action'),
    })),
  );
}
async function approach(page: Page) {
  await page.locator('.duel-arena').focus();
  for (let i = 0; i < 30; i++) {
    const [me, enemy] = await positions(page);
    if (Math.abs(me!.x - enemy!.x) < 62) break;
    const direction = me!.x < enemy!.x ? 'KeyD' : 'KeyA';
    await page.keyboard.down(direction);
    await page.clock.runFor(100);
    await page.keyboard.up(direction);
  }
}
test('practice uses real inputs to teach combos, throws, variants and a full-meter ultimate', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await open(page);
  await page.getByRole('button', { name: /练招房/ }).click();
  await page.getByRole('button', { name: '选择GPT 娘' }).click();
  await page.getByLabel('选择对手').selectOption('doubao');
  await expect(page.locator('.duel-portrait')).toHaveCount(3);
  await expect
    .poll(() =>
      page
        .locator('.duel-portrait')
        .evaluateAll((nodes) => nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0)),
    )
    .toBe(true);
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await page.clock.runFor(3100);
  await expect(page.locator('.duel')).toHaveAttribute('data-mode', 'practice');
  const time = await page.locator('.duel').getAttribute('data-timer');
  await approach(page);
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(150);
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(160);
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(850);
  await expect(page.locator('[aria-label="练招目标"]')).toContainText('✓ 打出三连');
  await page.getByRole('button', { name: '重置站位', exact: true }).click();
  await page.getByLabel('木桩行为').selectOption('guard');
  await approach(page);
  await page.keyboard.press('KeyO');
  await page.clock.runFor(800);
  await expect(page.locator('[aria-label="练招目标"]')).toContainText('✓ 投技命中');
  await page.getByRole('button', { name: '重置站位', exact: true }).click();
  await page.getByLabel('木桩行为').selectOption('idle');
  await approach(page);
  await page.keyboard.press('KeyV');
  await page.clock.runFor(800);
  await expect(page.locator('[aria-label="练招目标"]')).toContainText('✓ 变招命中');
  await page.keyboard.press('KeyI');
  await page.clock.runFor(400);
  await expect(page.locator('.duel-ultimate')).toBeVisible();
  await expect(page.locator('.duel-ultimate-art img')).toBeVisible();
  await page.clock.runFor(1700);
  await expect(page.locator('[aria-label="练招目标"]')).toContainText('✓ 大招命中');
  expect(await page.locator('.duel').getAttribute('data-timer')).toBe(time);
  await page.screenshot({ path: info.outputPath('practice-complete.png'), fullPage: true });
  await page.getByRole('button', { name: '结束练习', exact: true }).click();
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('4/4');
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.duel')).toHaveAttribute('data-mode', 'practice');
  await expect(page.locator('[aria-label="练招目标"]')).toContainText('○ 变招命中');
});

test('mode selection and new controls fit narrow phones, portraits fail back to SVG', async ({
  page,
}, info) => {
  await page.route(/\/duel_gpt_base[^/]*\.(?:png|webp)$/, (route) => route.abort());
  await open(page);
  await expect(
    page.getByRole('button', { name: '选择GPT 娘' }).locator('svg[viewBox="-100 -155 200 165"]'),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /练招房/ }).click();
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await page.clock.runFor(3100);
  for (const name of ['变招', '清空上下文']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await page.screenshot({ path: info.outputPath('modes-narrow.png'), fullPage: true });
});

test('the escape control breaks a real incoming hit and spends meter once', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /练招房/ }).click();
  await page.getByLabel('选择对手').selectOption('gpt');
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await page.clock.runFor(3100);
  await page.getByLabel('无限能量').uncheck();
  await page.getByLabel('木桩行为').selectOption('fight');
  await approach(page);
  let escaped = false;
  for (let i = 0; i < 150; i++) {
    const f = page.getByTestId('duel-fighter-0');
    if ((await f.getAttribute('data-action')) === 'hurt') {
      await page.getByRole('button', { name: '清空上下文', exact: true }).click();
      await page.clock.runFor(150);
      if ((await f.getAttribute('data-burst-used')) === 'true') {
        escaped = true;
        break;
      }
    }
    await page.clock.runFor(33);
  }
  expect(escaped).toBe(true);
  expect(
    Number(await page.getByTestId('duel-fighter-0').getAttribute('data-energy')),
  ).toBeLessThanOrEqual(60);
  await expect(page.getByRole('button', { name: '清空上下文', exact: true })).toContainText(
    '本回合已用',
  );
});

test('a three-station campaign can be beaten through normal keyboard play and two real upgrade choices', async ({
  page,
}, info) => {
  test.skip(
    info.project.name.startsWith('mobile'),
    'Long keyboard campaign is exercised on desktop; touch and practice are separate cases.',
  );
  test.setTimeout(180000);
  await open(page);
  await page.getByRole('button', { name: '选择GPT 娘' }).click();
  await page.getByRole('button', { name: /三站连战/ }).click();
  await page.getByLabel('选择难度').selectOption('easy');
  await page.getByRole('button', { name: '开始连战 →', exact: true }).click();
  let direction = '',
    upgrades = 0;
  for (let i = 0; i < 1800; i++) {
    if (await page.getByRole('region', { name: '对局结算' }).count()) break;
    if (await page.getByRole('region', { name: '连战补丁选择' }).count()) {
      if (direction) await page.keyboard.up(direction);
      direction = '';
      await page.keyboard.up('KeyL');
      await page.screenshot({ path: info.outputPath(`upgrade-${upgrades}.png`), fullPage: true });
      await page.getByRole('button', { name: upgrades === 0 ? /续杯 Token/ : /水冷大脑/ }).click();
      upgrades++;
      continue;
    }
    const phase = await page.locator('.duel').getAttribute('data-phase');
    if (phase !== 'fight') {
      if (direction) await page.keyboard.up(direction);
      direction = '';
      await page.keyboard.up('KeyL');
      await page.clock.runFor(300);
      continue;
    }
    const [me, enemy] = await positions(page);
    const distance = Math.abs(me!.x - enemy!.x);
    if (distance <= 70) await page.keyboard.down('KeyL');
    else await page.keyboard.up('KeyL');
    const nextDirection = distance > 55 ? (me!.x < enemy!.x ? 'KeyD' : 'KeyA') : '';
    if (nextDirection !== direction) {
      if (direction) await page.keyboard.up(direction);
      if (nextDirection) await page.keyboard.down(nextDirection);
      direction = nextDirection;
    }
    if (me!.energy >= 100 && distance < 160) await page.keyboard.press('KeyI');
    else if (enemy!.action === 'guard' && distance < 64) await page.keyboard.press('KeyO');
    else if (i % 4 === 0) await page.keyboard.press('KeyU');
    else await page.keyboard.press('KeyJ');
    await page.clock.runFor(150);
  }
  if (direction) await page.keyboard.up(direction);
  await page.keyboard.up('KeyL');
  expect(upgrades).toBe(2);
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('连战 3/3 站');
  await page.screenshot({ path: info.outputPath('campaign-cleared.png'), fullPage: true });
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.duel')).toHaveAttribute('data-station', '0');
  await expect(page.locator('.duel-perk')).toHaveCount(0);
});
