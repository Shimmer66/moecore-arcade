import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, freePlay = true) {
  await page.clock.install({ time: new Date('2026-09-26T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-26T10:00:01Z'));
  await page.goto('/#/games/steady');
  if (freePlay) await page.getByRole('button', { name: /自由整活/ }).click();
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-phase', 'editing');
}
async function place(page: Page, name: string, x?: number, y?: number) {
  await page.getByRole('button', { name: '添加' + name, exact: true }).click();
  if (x === undefined || y === undefined)
    await page.getByRole('button', { name: '放到建议位置' }).click();
  else {
    const room = page.getByTestId('workshop-room');
    await room.scrollIntoViewIfNeeded();
    const b = (await room.boundingBox())!;
    await page.mouse.click(b.x + (x / 640) * b.width, b.y + (y / 610) * b.height);
  }
}

test('place, rotate and run a real rescue; edit preserves the arrangement and records the route', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await place(page, '蹦床');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '蹦床顺时针旋转' }).click();
  await page.getByRole('button', { name: '放手，看看' }).click();
  await page.clock.runFor(4000);
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-phase', 'success');
  await expect(page.getByTestId('workshop-user')).toHaveAttribute('data-caught', 'true');
  await expect(page.getByText('✓ 蹦床救场', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('workshop-trampoline.png'), fullPage: true });
  await page.getByRole('button', { name: '改一点，再试' }).click();
  await expect(page.getByTestId('prop-1')).toHaveAttribute('transform', /rotate\(30\)/);
  await expect(page.getByTestId('workshop-user')).toHaveAttribute(
    'transform',
    'translate(125,118)',
  );
  await page.getByRole('button', { name: '放手，看看' }).click();
  await page.clock.runFor(4000);
  await page.getByRole('button', { name: '完成这次实验' }).click();
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('尝试 2 次');
  expect(errors).toEqual([]);
});

test('campaign completes five distinct goals, awards stars and restores unlocked progress', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, false);
  await expect(page.getByRole('button', { name: '2. 锅替你赶路' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '添加磁铁', exact: true })).toBeDisabled();
  await place(page, '蹦床');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '蹦床顺时针旋转' }).click();
  await page.getByRole('button', { name: '放手，看看' }).click();
  await page.clock.runFor(4000);
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-phase', 'success');
  await expect(page.getByLabel('本关 3 星')).toBeVisible();
  await page.getByRole('button', { name: '下一关 →', exact: true }).click();
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-level', 'magnetic');
  await page.getByRole('button', { name: '1. 先借你一张床' }).click();
  await expect(page.getByTestId('prop-1')).toHaveAttribute('transform', /rotate\(30\)/);
  await page.getByRole('button', { name: '2. 锅替你赶路' }).click();
  await place(page, '锅');
  await place(page, '磁铁', 430, 100);
  await page.getByRole('button', { name: '放手，看看' }).click();
  await page.clock.runFor(3500);
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-phase', 'success');
  await page.getByRole('button', { name: '下一关 →', exact: true }).click();
  await place(page, '锅');
  await place(page, '气球');
  await place(page, '磁铁', 430, 100);
  await page.getByRole('button', { name: '放手，看看' }).click();
  await page.clock.runFor(3500);
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-phase', 'success');
  await page.getByRole('button', { name: '下一关 →', exact: true }).click();
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-level', 'let-go');
  await place(page, '气球');
  await page.getByRole('button', { name: '放手，看看' }).click();
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: '✂ 剪断气球', exact: true }).click();
  await page.clock.runFor(4000);
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-phase', 'success');
  await page.screenshot({ path: info.outputPath('steady-wind-challenge.png'), fullPage: true });
  await page.getByRole('button', { name: '下一关 →', exact: true }).click();
  await expect(page.getByTestId('pot-1')).toBeVisible();
  await expect(page.getByTestId('pot-2')).toBeVisible();
  await place(page, '蹦床');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '蹦床顺时针旋转' }).click();
  await place(page, '磁铁', 470, 350);
  await page.getByRole('button', { name: '放手，看看' }).click();
  await page.clock.runFor(5000);
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-phase', 'success');
  await expect(page.locator('.progress-badge')).toContainText(/救援档案\s*★\s*15\s*\/\s*15/);
  await page.reload();
  await expect(page.getByRole('button', { name: '5. 这两口锅也归你' })).toBeEnabled();
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-level', 'free');
  await expect(page.getByTestId('steady-user-art')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ceiling route uses live buoyancy and magnetism; cut, power and pause controls work', async ({
  page,
}, info) => {
  await open(page);
  await place(page, '锅');
  await place(page, '气球');
  await place(page, '气球');
  await place(page, '磁铁', 500, 100);
  await page.getByRole('button', { name: '↑ 天花板', exact: true }).click();
  await page.getByRole('button', { name: '放手，看看' }).click();
  await page.clock.runFor(200);
  await page.getByRole('button', { name: '磁铁断电', exact: true }).click();
  await expect(page.getByRole('button', { name: '磁铁通电', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '✂ 剪断气球', exact: true }).click();
  await expect(page.getByRole('button', { name: '✂ 剪断气球', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const position = await page.getByTestId('workshop-user').getAttribute('transform');
  await page.clock.runFor(3000);
  await expect(page.getByTestId('workshop-user')).toHaveAttribute('transform', position!);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.getByRole('button', { name: '停下，改布置' }).click();
  await page.getByRole('button', { name: '放手，看看' }).click();
  await page.clock.runFor(4000);
  await expect(page.getByTestId('steady-workshop')).toHaveAttribute('data-phase', 'success');
  await expect(page.getByText('✓ 上天接人', { exact: true })).toBeVisible();
  await expect(page.getByText('✓ 磁力甩锅', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('workshop-ceiling.png'), fullPage: true });
});

test('real touch can reposition a prop, undo and cancel without corrupting placement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await place(page, '蹦床');
  const room = page.getByTestId('workshop-room');
  await room.scrollIntoViewIfNeeded();
  const box = (await room.boundingBox())!;
  const point = (x: number, y: number) => ({
    x: box.x + (x / 640) * box.width,
    y: box.y + (y / 610) * box.height,
  });
  const client = await page.context().newCDPSession(page);
  const original = await page.getByTestId('prop-1').getAttribute('transform');
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point(125, 310)],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [point(180, 260)],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('prop-1')).not.toHaveAttribute('transform', original!);
  await page.getByRole('button', { name: /撤销/ }).click();
  await expect(page.getByTestId('prop-1')).toHaveAttribute('transform', original!);
  await room.scrollIntoViewIfNeeded();
  const box2 = (await room.boundingBox())!;
  const pt = (x: number, y: number) => ({
    x: box2.x + (x / 640) * box2.width,
    y: box2.y + (y / 610) * box2.height,
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [pt(125, 310)],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(190, 250)] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.getByTestId('prop-1')).toHaveAttribute('transform', original!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await client.detach();
});
