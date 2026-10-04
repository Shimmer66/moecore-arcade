import { expect, test } from '@playwright/test';

test('selects characters and starts local versus combat', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/games/stardust');
  await expect(
    page.getByTestId('stardust-game').getByRole('heading', { name: '星尘远征：替身决斗' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('group', { name: '玩家一选择角色' })
      .getByRole('button', { name: /空条承太郎/ })
      .locator('.roster-art'),
  ).toHaveCSS('background-image', /jotaro-star-platinum-v1/);
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await page
    .getByRole('group', { name: '玩家一选择角色' })
    .getByRole('button', { name: /空条承太郎/ })
    .click();
  await page
    .getByRole('group', { name: '玩家二选择角色' })
    .getByRole('button', { name: /花京院典明/ })
    .click();
  await page.getByRole('button', { name: '开始对战' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-mode', 'versus');
  await expect(page.getByTestId('stardust-p1')).toBeVisible();
  await expect(page.getByTestId('stardust-p2')).toBeVisible();
  await expect(page.getByTestId('stardust-p1').locator('.fighter-art')).toHaveCSS(
    'background-image',
    /jotaro-star-platinum-v1/,
  );
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyJ');
  await expect(page.getByText(/空条承太郎 · 1 HIT/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('adventure exposes the shared three-revive rule', async ({ page }) => {
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: '开始远征' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-mode', 'adventure');
  await expect(page.getByTestId('stardust-revives')).toContainText('◆◆◆');
  await expect(page.getByText('荷尔·荷斯')).toBeVisible();
  await expect(page.getByText(/共享三次复活/)).toBeVisible();
});
