import { expect, test, type Page } from '@playwright/test';

async function enterWithoutSessionStorage(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new DOMException('Storage denied for this test', 'SecurityError');
      },
    });
  });
  await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
  await page.goto('/#/games/parkour');
  await page.getByRole('button', { name: '单项练习', exact: true }).click();
  await expect(page.getByRole('region', { name: '开场故事' })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
}

for (const activity of [
  { name: 'flight', entry: /算力喷射/, start: '开始喷射', world: '.flight-world' },
  { name: 'rhythm', entry: /Token 蹦迪/, start: '开始打拍', world: '.rhythm-world' },
]) {
  test(`denied session storage preserves ${activity.name} on retry but resets activity on a new visit`, async ({
    page,
  }) => {
    await enterWithoutSessionStorage(page);
    await page.getByRole('button', { name: activity.entry }).click();
    await page.getByRole('button', { name: activity.start, exact: true }).click();
    await page.clock.runFor(20000);
    await expect(page.getByRole('region', { name: '对局结算' })).toBeVisible();
    await page.getByRole('button', { name: '再来一局', exact: true }).click();
    await expect(page.locator(activity.world)).toHaveAttribute('data-phase', 'playing');
    await page.getByRole('button', { name: '返回游戏列表', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await page.getByRole('button', { name: /大肥鱼跑酷：答案马上就到/ }).click();
    await expect(page.getByRole('heading', { name: '三分钟送答行动', exact: true })).toBeVisible();
    await expect(page.locator(activity.world)).toHaveCount(0);
  });
}

test('denied session storage preserves course and thinking strength across retry', async ({
  page,
}) => {
  await enterWithoutSessionStorage(page);
  await page
    .getByRole('group', { name: '选择关卡' })
    .getByRole('button', { name: /第3关/ })
    .click();
  await page
    .getByRole('group', { name: '思考强度' })
    .getByRole('button', { name: 'Max', exact: true })
    .click();
  await page.getByRole('button', { name: '开跑', exact: true }).click();
  await page.clock.runFor(60000);
  await expect(page.getByRole('region', { name: '对局结算' })).toBeVisible();
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.office-world')).toHaveClass(/level-3/);
  await expect(page.locator('.whale-footer')).toContainText('思考强度：Max');
});
