import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../../games/arena/src/campaign';

test('offers skipping after repeated failures without awarding a false clear', async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date('2026-09-29T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-29T00:00:01Z'));
  await page.goto('/#/games/arena');
  await expect(page.getByTestId('campaign-player')).toBeVisible();
  await expect(page.getByRole('button', { name: '跳过本关', exact: true })).toHaveCount(0);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.down('KeyD');
    await page.clock.runFor(2300);
    await page.keyboard.up('KeyD');
    await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'playing');
  }
  await page.getByRole('button', { name: '跳过本关', exact: true }).click();
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-room', 'autocomplete');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await expect(page.locator('.map-heading')).toContainText(`0/${CAMPAIGN.length}`);
  await expect(page.getByRole('heading', { name: /幻觉世界/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath('world-door-map.png'), fullPage: true });
});

test('navigates the map in document order and returns focus without moving the player', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  const map = page.getByRole('dialog', { name: '关卡地图' });
  const current = map.getByRole('button', { name: /01 来源：我自己/ });
  await expect(current).toBeFocused();
  expect(await page.locator('.map-chapters > section h4').first().textContent()).toContain(
    '幻觉世界',
  );
  const player = page.getByTestId('campaign-player');
  const position = await player.getAttribute('data-x');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(300);
  await page.keyboard.up('KeyD');
  expect(await player.getAttribute('data-x')).toBe(position);
  await page.keyboard.press('Tab');
  await expect(map.getByRole('button', { name: /02 猜你想跳/ })).toBeFocused();
  await map.getByRole('button', { name: '无尽生成', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(map.getByRole('button', { name: '返回当前关卡', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(map.getByRole('button', { name: '无尽生成', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(map).toHaveCount(0);
  await expect(page.locator('.campaign-game')).toBeFocused();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(200);
  await page.keyboard.up('KeyD');
  expect(Number(await player.getAttribute('data-x'))).toBeGreaterThan(Number(position));
});

test('keeps controls visible in short desktop windows and supports focused keyboard buttons', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1265, height: 712 });
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  const jump = page.getByRole('button', { name: '跳跃', exact: true });
  await expect(jump).toBeVisible();
  await page.clock.runFor(100);
  const bounds = (await jump.boundingBox())!;
  expect(bounds.y + bounds.height).toBeLessThan(712);
  await page.getByRole('button', { name: '向右移动', exact: true }).focus();
  await page.keyboard.down('Space');
  await page.clock.runFor(250);
  await page.keyboard.up('Space');
  const player = page.getByTestId('campaign-player');
  expect(Number(await player.getAttribute('data-x'))).toBeGreaterThan(100);
  const x = await player.getAttribute('data-x');
  await page.clock.runFor(100);
  expect(await player.getAttribute('data-x')).toBe(x);
  await jump.focus();
  await page.keyboard.press('Enter');
  await page.clock.runFor(100);
  expect(Number(await player.getAttribute('data-y'))).toBeLessThan(300);
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  const first = await page.locator('.map-chapters > section').evaluateAll(
    (sections) =>
      sections
        .map((section) => ({
          title: section.querySelector('h4')?.textContent,
          top: section.getBoundingClientRect().top,
        }))
        .sort((a, b) => a.top - b.top)[0]?.title,
  );
  expect(first).toContain('幻觉世界');
  await page.screenshot({ path: info.outputPath('short-window-map.png'), fullPage: true });
});
