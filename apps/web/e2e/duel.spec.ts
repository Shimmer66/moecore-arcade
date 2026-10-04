import { expect, test, type Page } from '@playwright/test';

async function openDuel(page: Page) {
  await page.clock.install({ time: new Date('2026-10-02T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-02T00:00:01Z'));
  await page.goto('/#/games/duel');
  await expect(page.locator('.duel')).toHaveAttribute('data-phase', 'select');
  await expect(page.getByRole('group', { name: '选择角色' }).locator('.duel-card')).toHaveCount(6);
}

async function advanceToFight(page: Page) {
  for (let step = 0; step < 40; step += 1) {
    if ((await page.locator('.duel').getAttribute('data-phase')) === 'fight') return;
    await page.bringToFront();
    const resume = page.getByRole('button', { name: '继续游戏', exact: true });
    if (await resume.isVisible()) await resume.click();
    await page.clock.runFor(100);
  }
  await expect(page.locator('.duel')).toHaveAttribute('data-phase', 'fight');
}

async function startQuickMatch(page: Page) {
  await page.getByRole('button', { name: '选择GPT 娘' }).click();
  await page.getByLabel('选择对手').selectOption('deepseek');
  await page.getByRole('button', { name: '开打 →', exact: true }).click();
  await advanceToFight(page);
}

test('loads six fighters, starts a match and preserves pause and restart behavior', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openDuel(page);
  await expect
    .poll(() =>
      page
        .locator('.duel-portrait')
        .evaluateAll((portraits) =>
          portraits.every(
            (portrait) => portrait instanceof HTMLImageElement && portrait.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await startQuickMatch(page);

  const fighter = page.getByTestId('duel-fighter-0');
  const startX = Number(await fighter.getAttribute('data-x'));
  await page.keyboard.down('KeyD');
  await page.clock.runFor(180);
  await page.keyboard.up('KeyD');
  expect(Number(await fighter.getAttribute('data-x'))).toBeGreaterThan(startX);

  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const frozenX = await fighter.getAttribute('data-x');
  const frozenTimer = await page.locator('.duel').getAttribute('data-timer');
  await page.clock.runFor(1500);
  expect(await fighter.getAttribute('data-x')).toBe(frozenX);
  expect(await page.locator('.duel').getAttribute('data-timer')).toBe(frozenTimer);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();

  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.duel')).toHaveAttribute('data-phase', 'countdown');
  await expect(page.getByTestId('duel-fighter-0')).toHaveAttribute('data-hp', '1000');
  expect(errors).toEqual([]);
});

test('builds two three-person teams and starts a local 3v3 relay match', async ({ page }) => {
  await openDuel(page);
  await page.getByRole('button', { name: /3v3车轮战/ }).click();
  const teamSelect = page.getByRole('region', { name: '三人队伍编成' });
  await expect(teamSelect.getByRole('combobox')).toHaveCount(6);
  await teamSelect.getByRole('button', { name: '双人队伍战', exact: true }).click();
  const start = page.getByRole('button', { name: '全队开打 →', exact: true });
  await expect(start).toBeEnabled({ timeout: 30_000 });
  await start.click();
  await advanceToFight(page);

  await expect(page.locator('.duel')).toHaveAttribute('data-mode', 'team');
  await expect(page.getByTestId('duel-team-0').locator('[data-character]')).toHaveCount(3);
  await expect(page.getByTestId('duel-team-1').locator('[data-character]')).toHaveCount(3);
  await expect(page.locator('.duel-p2-pad')).toBeVisible();
});

test('practice exposes current lessons, input history and a truthful result summary', async ({
  page,
}) => {
  await openDuel(page);
  await page.getByRole('button', { name: /练招房/ }).click();
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await advanceToFight(page);

  await expect(page.locator('.duel')).toHaveAttribute('data-mode', 'practice');
  await expect(page.locator('[aria-label="练招目标"] > span')).toHaveCount(9);
  await page.locator('.duel-arena').focus();
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(180);
  await expect(page.getByTestId('duel-input-0')).toContainText('轻拳');
  await page.getByRole('button', { name: '结束练习', exact: true }).click();
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText(
    /已完成 \d+\/9 项练习/,
  );
});

test('mobile controls support simultaneous movement and jump without horizontal overflow', async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Multi-touch coverage runs on mobile.');
  await openDuel(page);
  const quickStart = page.locator('.duel-mobile-quick');
  await expect(quickStart).toBeVisible();
  await quickStart.click();
  await advanceToFight(page);
  await page.setViewportSize({ width: 320, height: 760 });
  await expect(page.locator('.duel-directions')).toHaveCSS('border-radius', '50%');

  const right = page.getByRole('button', { name: '向右移动', exact: true });
  const jump = page.getByRole('button', { name: '跳跃', exact: true });
  await right.scrollIntoViewIfNeeded();
  const rightBox = (await right.boundingBox())!;
  const jumpBox = (await jump.boundingBox())!;
  const client = await page.context().newCDPSession(page);
  const movement = {
    id: 1,
    x: rightBox.x + rightBox.width / 2,
    y: rightBox.y + rightBox.height / 2,
  };
  const action = {
    id: 2,
    x: jumpBox.x + jumpBox.width / 2,
    y: jumpBox.y + jumpBox.height / 2,
  };
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [movement],
  });
  await page.clock.runFor(100);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [movement, action],
  });
  await page.clock.runFor(180);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();

  const fighter = page.getByTestId('duel-fighter-0');
  expect(Number(await fighter.getAttribute('data-x'))).toBeGreaterThan(280);
  expect(Number(await fighter.getAttribute('data-y'))).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
