import { expect, test } from '@playwright/test';
import { ENEMY_PROGRESS_KEY } from '../../../games/stardust/src/progress';
import { attackSpecs, FIGHTER_HP } from '../../../games/stardust/src/rules';

test('all enemies appear locked and cannot be selected before 30 defeats', async ({ page }) => {
  await page.goto('/#/games/stardust');
  const roster = page.getByRole('group', { name: '玩家一选择角色' });
  await expect(roster.getByRole('button')).toHaveCount(18);
  const dio = page.getByTestId('stardust-choice-p1-dio');
  await expect(dio).toHaveAttribute('data-unlocked', 'false');
  await expect(dio).toContainText('0 / 30');
  await dio.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText('DIO');
  await expect(page.getByTestId('stardust-unlock-progress')).toContainText('0 / 30');
  await expect(dialog.getByRole('button', { name: '确认选择' })).toBeDisabled();
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(page.getByTestId('stardust-choice-p1-jotaro')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await expect(page.getByRole('group', { name: '玩家二选择角色' }).getByRole('button')).toHaveCount(
    18,
  );
  await expect(page.getByTestId('stardust-choice-p2-dio')).toHaveAttribute(
    'data-unlocked',
    'false',
  );
});

test('only the enemy with 30 defeats is unlocked, persists on reload, and uses its own fighter art', async ({
  page,
}) => {
  await page.addInitScript(
    ({ key }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify({ dio: 30, 'gray-fly': 29 }));
    },
    { key: ENEMY_PROGRESS_KEY },
  );
  await page.goto('/#/games/stardust');
  await expect(page.getByTestId('stardust-choice-p1-dio')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('stardust-choice-p1-gray-fly')).toHaveAttribute(
    'data-unlocked',
    'false',
  );
  await expect(page.getByTestId('stardust-choice-p1-gray-fly')).toContainText('29 / 30');
  await page.reload();
  await page.getByRole('button', { name: /练习模式/ }).click();
  await page.getByTestId('stardust-choice-p1-dio').click();
  await expect(page.getByTestId('stardust-unlock-progress')).toContainText('30 / 30');
  await page.getByRole('dialog').getByRole('button', { name: '确认选择' }).click();
  await expect(page.getByTestId('stardust-choice-p1-dio')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('stardust-start').click();
  await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
  const fighter = page.getByTestId('stardust-p1');
  await expect(fighter).toHaveAttribute('data-character', 'dio');
  await expect(fighter).toHaveAttribute('data-hp', '500');
  await expect(fighter.locator('.fighter-art')).toHaveCSS(
    'background-image',
    /dio-body-only-motion/,
  );
  await expect(fighter.locator('.body')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /T.*时停/ })).toBeEnabled();
  const start = await fighter.getAttribute('style');
  await page.keyboard.down('KeyD');
  await expect(fighter).not.toHaveAttribute('style', start!);
  await page.keyboard.up('KeyD');
});

for (const initialCount of [0, 29]) {
  test(`an actual adventure defeat increments only its own counter once (${initialCount} to ${initialCount + 1})`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, count }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify({ 'gray-fly': count, dio: 12 }));
        Math.random = () => 0.999;
      },
      { key: ENEMY_PROGRESS_KEY, count: initialCount },
    );
    await page.clock.install();
    await page.goto('/#/games/stardust');
    await page.getByRole('button', { name: /纯单人冒险/ }).click();
    await page.getByTestId('stardust-start').click();
    await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.getByLabel('角色语音').uncheck();
    await page.getByLabel('打击音效').uncheck();
    await page.getByTestId('stardust-arena').click();
    for (let step = 0; step < 60; step++) {
      const [p1, p2] = await page
        .locator('[data-testid="stardust-p1"], [data-testid="stardust-p2"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => Number.parseFloat((node as HTMLElement).style.left)),
        );
      if (Math.abs(p2! - p1!) <= 3) break;
      const key = p2! > p1! ? 'KeyD' : 'KeyA';
      await page.keyboard.down(key);
      await page.clock.runFor(16);
      await page.keyboard.up(key);
    }
    const progress = () =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), ENEMY_PROGRESS_KEY);
    expect((await progress())['gray-fly']).toBe(initialCount);
    for (
      let attempt = 0;
      attempt < Math.ceil(FIGHTER_HP / attackSpecs.heavy.damage) + 3;
      attempt++
    ) {
      await page.locator('.controls section').first().getByRole('button', { name: /重击/ }).click();
      await page.clock.runFor(attackSpecs.heavy.frames * 16 + 64);
      if ((await progress())['gray-fly'] === initialCount + 1) break;
    }
    expect(await progress()).toEqual({ 'gray-fly': initialCount + 1, dio: 12 });
    await page.clock.runFor(2000);
    expect(await progress()).toEqual({ 'gray-fly': initialCount + 1, dio: 12 });
    await page.reload();
    await expect(page.getByTestId('stardust-choice-p1-gray-fly')).toHaveAttribute(
      'data-unlocked',
      initialCount === 29 ? 'true' : 'false',
    );
    await expect(page.getByTestId('stardust-choice-p1-dio')).toHaveAttribute(
      'data-unlocked',
      'false',
    );
  });
}
