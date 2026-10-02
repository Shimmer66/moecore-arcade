import { expect, test, type Page } from '@playwright/test';
import { rhythmChart, RHYTHM_END_MS } from '../../../games/parkour/src/rules/rhythm';

async function enter(page: Page) {
  await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
  await page.goto('/#/games/parkour');
  await page.getByRole('button', { name: '单项练习', exact: true }).click();
  await expect(page.getByRole('region', { name: '开场故事' })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
  await page.getByRole('button', { name: /Token 蹦迪/ }).click();
  await expect(page.getByRole('heading', { name: 'Token 蹦迪', exact: true })).toBeVisible();
}

test('full original chart works with three controls, pause, score persistence and same-mode retry', async ({
  page,
}, testInfo) => {
  test.setTimeout(100_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enter(page);
  await page.screenshot({ path: testInfo.outputPath('rhythm-ready.png'), fullPage: true });
  await page.getByRole('button', { name: '开始打拍', exact: true }).click();
  await expect(page.locator('.rhythm-world')).toHaveAttribute('data-phase', 'playing');
  const keys = { jump: 'Space', tail: 'KeyX', slide: 'ArrowDown' };
  const names = { jump: '跳跃', tail: '甩尾', slide: '滑铲' };
  let played = 0;
  for (const [index, note] of rhythmChart.entries()) {
    await page.clock.runFor(note.at - played);
    played = note.at;
    if (testInfo.project.name === 'mobile-chromium')
      await page.getByRole('button', { name: names[note.action], exact: true }).click();
    else await page.keyboard.press(keys[note.action]);
    if (index === 10) {
      await page.getByRole('button', { name: '暂停', exact: true }).click();
      const frozen = await page.locator('.rhythm-world').getAttribute('data-elapsed');
      await page.clock.runFor(8000);
      expect(await page.locator('.rhythm-world').getAttribute('data-elapsed')).toBe(frozen);
      await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    }
    if (index === 24) {
      const feedback = await page.locator('.rhythm-judgement').boundingBox();
      const notes = await page.locator('.rhythm-note').evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { y: box.y, bottom: box.bottom };
        }),
      );
      expect(
        notes.every(
          (note) => note.y >= feedback!.y + feedback!.height || note.bottom <= feedback!.y,
        ),
      ).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('rhythm-playing.png'), fullPage: true });
    }
  }
  await page.clock.runFor(RHYTHM_END_MS - played + 30);
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('全精准');
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText(
    `精准 ${rhythmChart.length}/${rhythmChart.length}`,
  );
  expect(
    Number(await page.evaluate(() => localStorage.getItem('moecore:parkour:rhythm:best:v1'))),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => localStorage.getItem('moecore:parkour:best-score:v2:0')),
  ).toBeNull();
  await page.screenshot({ path: testInfo.outputPath('rhythm-complete.png'), fullPage: true });
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.rhythm-world')).toHaveAttribute('data-phase', 'playing');
  await expect(page.locator('.rhythm-world')).toHaveAttribute('data-cursor', '0');
  expect(errors).toEqual([]);
});

test('idle loses, selection returns to runner, and a later runner retry stays there', async ({
  page,
}) => {
  await enter(page);
  await page.getByRole('button', { name: '开始打拍', exact: true }).click();
  await page.clock.runFor(16000);
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('上下文掉拍了');
  expect(
    await page.evaluate(() => localStorage.getItem('moecore:parkour:rhythm:best:v1')),
  ).toBeNull();
  await page.getByRole('button', { name: '返回航线选择', exact: true }).click();
  await expect(page.getByRole('region', { name: '开场故事' })).toBeVisible();
  await page.getByRole('button', { name: '开跑', exact: true }).click();
  await page.clock.runFor(60000);
  await expect(page.getByRole('region', { name: '对局结算' })).toBeVisible();
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.office-world')).toBeVisible();
  await expect(page.locator('.rhythm-world')).toHaveCount(0);
});

test('small screen shows the chart and touch controls without horizontal overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await enter(page);
  await page.getByRole('button', { name: '开始打拍', exact: true }).click();
  await page.clock.runFor(500);
  const world = await page.locator('.rhythm-world').boundingBox();
  const controls = await page.locator('.rhythm-controls').boundingBox();
  expect(world!.y).toBeGreaterThanOrEqual(0);
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(640);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('rhythm-320.png'), fullPage: false });
});
