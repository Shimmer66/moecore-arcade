import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../../games/arena/src/campaign';

test('frames separated copies in a long custom room and follows the unfinished one', async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: '创建关卡', exact: true }).click();
  await page.getByRole('textbox', { name: '关卡代码', exact: true }).fill(
    JSON.stringify({
      format: 'moecore-arena-room',
      version: 1,
      room: {
        title: '副本镜头检查',
        promise: '每个副本都要到达。',
        width: 2500,
        spawn: { x: 50, y: 306 },
        cloneSpawns: [{ x: 1500, y: 306 }],
        exit: { x: 2410, y: 292, w: 64, h: 62 },
        secret: { x: 500, y: 220 },
        floors: [{ x: 0, y: 354, w: 2500, h: 86 }],
        traps: [],
      },
    }),
  );
  await page.getByRole('button', { name: '导入关卡', exact: true }).click();
  await page.getByRole('button', { name: '试玩', exact: true }).click();
  const scene = page.locator('.playfield > svg');
  const first = (await scene.getAttribute('viewBox'))!.split(' ').map(Number);
  expect(first[0]).toBeLessThanOrEqual(50);
  expect(first[0]! + first[2]!).toBeGreaterThanOrEqual(1532);
  await page.screenshot({ path: info.outputPath('separated-copies.png'), fullPage: true });
  await page.keyboard.down('KeyD');
  await page.clock.runFor(3400);
  await page.keyboard.up('KeyD');
  await expect(page.getByTestId('controlled-clone')).toHaveAttribute('data-done', 'true');
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'playing');
  const second = (await scene.getAttribute('viewBox'))!.split(' ').map(Number);
  const playerX = Number(await page.getByTestId('campaign-player').getAttribute('data-x'));
  expect(second[2]).toBeLessThan(first[2]!);
  expect(second[0]).toBeLessThan(playerX);
  expect(second[0]! + second[2]!).toBeGreaterThan(playerX + 32);
  await page.keyboard.down('KeyD');
  await page.clock.runFor(6000);
  await page.keyboard.up('KeyD');
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'clear');
});

test('authors a trap, undoes edits, clears the real room and shares a saved draft', async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: '创建关卡', exact: true }).click();
  await page.getByLabel('关卡名称', { exact: true }).fill('测试工坊');
  await page.getByRole('combobox', { name: '机关类型', exact: true }).selectOption('pit');
  const canvas = page.getByRole('img', { name: '关卡编辑画布' });
  const bounds = (await canvas.boundingBox())!;
  const placement = { position: { x: bounds.width * 0.4, y: bounds.height * 0.8 } };
  if (info.project.name === 'mobile') await canvas.tap(placement);
  else await canvas.click(placement);
  const x = page.getByLabel('横坐标', { exact: true });
  await expect(x).toHaveValue('400');
  await x.fill('420');
  await x.blur();
  await page.getByRole('button', { name: '撤销编辑', exact: true }).click();
  await page.getByRole('button', { name: '选择与移动', exact: true }).click();
  await canvas.click({ position: { x: bounds.width * 0.43, y: bounds.height * 0.87 } });
  await expect(x).toHaveValue('400');
  await expect(page.getByRole('button', { name: '重做编辑', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '重做编辑', exact: true }).click();
  await canvas.click({ position: { x: bounds.width * 0.45, y: bounds.height * 0.87 } });
  await expect(x).toHaveValue('420');
  await expect(page.getByRole('button', { name: '复制关卡', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('editor.png'), fullPage: true });
  await page.getByRole('button', { name: '试玩', exact: true }).click();
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-mode', 'custom');
  const player = page.getByTestId('campaign-player');
  await page.keyboard.down('KeyD');
  for (let i = 0; i < 100 && Number(await player.getAttribute('data-x')) < 360; i++)
    await page.clock.runFor(32);
  await page.keyboard.press('Space');
  await page.clock.runFor(2500);
  await page.keyboard.up('KeyD');
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'clear');
  await page.getByRole('button', { name: '返回编辑', exact: true }).click();
  await expect(page.getByRole('button', { name: '复制关卡', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '复制关卡', exact: true }).click();
  const code = await page.getByRole('textbox', { name: '关卡代码', exact: true }).inputValue();
  expect(JSON.parse(code).room.traps[0].body.x).toBe(420);
  await page.getByLabel('关卡名称', { exact: true }).fill('修改后');
  await page.getByLabel('关卡名称', { exact: true }).blur();
  await expect(page.getByRole('button', { name: '复制关卡', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: '关卡代码', exact: true }).fill(code);
  await page.getByRole('button', { name: '导入关卡', exact: true }).click();
  await expect(page.getByLabel('关卡名称', { exact: true })).toHaveValue('测试工坊');
  await page.reload();
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await expect(page.locator('.map-heading')).toContainText(`0/${CAMPAIGN.length}`);
  await page.getByRole('button', { name: '创建关卡', exact: true }).click();
  await expect(page.getByLabel('关卡名称', { exact: true })).toHaveValue('测试工坊');
  await expect(page.getByRole('button', { name: '复制关卡', exact: true })).toBeEnabled();
  await page.getByRole('textbox', { name: '关卡代码', exact: true }).fill('{"version":99}');
  await page.getByRole('button', { name: '导入关卡', exact: true }).click();
  await expect(page.getByText('不支持这个关卡版本。')).toBeVisible();
  await expect(page.getByLabel('关卡名称', { exact: true })).toHaveValue('测试工坊');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
