import { expect, test, type Page } from '@playwright/test';
import {
  enumerateValidSwaps,
  isEffectiveSwap,
  type Board,
  type Position,
} from '@moecore/game-match3/rules';

async function enterGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /AI 娘消消乐/ }).click();
  await expect(page.locator('.match3-tile')).toHaveCount(64);
  await expect(page.getByTestId('moves')).toHaveText('20');
}

async function readBoard(page: Page): Promise<Board> {
  const values = await page
    .locator('.match3-tile')
    .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-character')));
  return Array.from({ length: 8 }, (_, row) => values.slice(row * 8, (row + 1) * 8)) as Board;
}

function tile(page: Page, position: Position) {
  return page.locator(`.match3-tile[data-row="${position.row}"][data-column="${position.column}"]`);
}

async function move(page: Page) {
  const candidate = enumerateValidSwaps(await readBoard(page))[0]!;
  await tile(page, candidate.from).click();
  await tile(page, candidate.to).click();
  await expect(page.locator('.match3-board')).toHaveAttribute('aria-busy', 'false');
}

test('opens the Vue game, renders assets, and fits the viewport', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await enterGame(page);
  await expect(page).toHaveURL(/#\/games\/match3$/);
  await expect(page.getByRole('heading', { name: 'AI 娘消消乐', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) =>
          images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
        ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('match3.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('invalid exchanges preserve moves and hints lead to a valid exchange', async ({ page }) => {
  await enterGame(page);
  const board = await readBoard(page);
  let invalid: { from: Position; to: Position } | undefined;
  for (let row = 0; row < 8 && !invalid; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const from = { row, column };
      const to = { row, column: column + 1 };
      if (!isEffectiveSwap(board, from, to)) {
        invalid = { from, to };
        break;
      }
    }
  }
  await tile(page, invalid!.from).click();
  await tile(page, invalid!.to).click();
  await expect(page.getByTestId('moves')).toHaveText('20');
  expect(await readBoard(page)).toEqual(board);
  await page.getByRole('button', { name: '提示', exact: true }).click();
  await expect(page.locator('.match3-tile.hinted')).toHaveCount(2);
  await move(page);
  await expect(page.getByTestId('moves')).toHaveText('19');
  expect(Number(await page.getByTestId('cleared').textContent())).toBeGreaterThanOrEqual(3);
});

test('pauses an active cascade and resumes without spending a second move', async ({ page }) => {
  await page.clock.install();
  await enterGame(page);
  const candidate = enumerateValidSwaps(await readBoard(page))[0]!;
  await tile(page, candidate.from).click();
  await tile(page, candidate.to).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByRole('region', { name: '暂停菜单' })).toBeVisible();
  const pausedBoard = await readBoard(page);
  await page.clock.runFor(10_000);
  expect(await readBoard(page)).toEqual(pausedBoard);
  await expect(page.getByTestId('moves')).toHaveText('20');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(10_000);
  await expect(page.getByTestId('moves')).toHaveText('19');
});

test('toggles the game host into and out of fullscreen', async ({ page }) => {
  await enterGame(page);
  await page.getByRole('button', { name: '全屏', exact: true }).click();
  await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains('game-host')))
    .toBe(true);

  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await expect(page.getByRole('button', { name: '全屏', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
});

test('restarting during a cascade cancels the old animation', async ({ page }) => {
  await page.clock.install();
  await enterGame(page);
  const candidate = enumerateValidSwaps(await readBoard(page))[0]!;
  await tile(page, candidate.from).click();
  await tile(page, candidate.to).click();
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  const restartedBoard = await readBoard(page);
  await page.clock.runFor(10_000);
  await expect(page.getByTestId('moves')).toHaveText('20');
  await expect(page.getByTestId('cleared')).toHaveText('0');
  expect(await readBoard(page)).toEqual(restartedBoard);
});

test('supports pointer dragging without submitting the following click as a move', async ({
  page,
}, testInfo) => {
  await enterGame(page);
  const candidate = enumerateValidSwaps(await readBoard(page))[0]!;
  const start = (await tile(page, candidate.from).boundingBox())!;
  const end = (await tile(page, candidate.to).boundingBox())!;
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  const endX = end.x + end.width / 2;
  const endY = end.y + end.height / 2;
  if (testInfo.project.name.startsWith('mobile')) {
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: endX, y: endY }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await client.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 4 });
    await page.mouse.up();
  }
  await expect(page.getByTestId('moves')).toHaveText('19');
  await expect(page.locator('.match3-tile.selected')).toHaveCount(0);
});

test('background pause requires explicit resume, and restart and exit replace the session', async ({
  page,
}) => {
  await enterGame(page);
  await move(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('region', { name: '暂停菜单' })).toBeVisible();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '继续本局', exact: true }).click();
  await expect(page.getByTestId('moves')).toHaveText('19');
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByTestId('moves')).toHaveText('20');
  await page.getByRole('button', { name: '返回游戏列表', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.match3-tile')).toHaveCount(0);
  await page.getByRole('button', { name: /AI 娘消消乐/ }).click();
  await expect(page.locator('.match3-tile')).toHaveCount(64);
  await expect(page.getByTestId('moves')).toHaveText('20');
  await page.reload();
  await expect(page.locator('.match3-tile')).toHaveCount(64);
});

test('finishes a full game and can start a fresh one', async ({ page }) => {
  await enterGame(page);
  await page.getByRole('checkbox', { name: '减少动态效果' }).check();
  for (let turn = 0; turn < 20; turn += 1) {
    if (await page.getByRole('region', { name: '对局结算' }).isVisible()) break;
    await move(page);
  }
  await expect(page.getByRole('region', { name: '对局结算' })).toBeVisible();
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.getByRole('region', { name: '对局结算' })).toHaveCount(0);
  await expect(page.getByTestId('moves')).toHaveText('20');
});

test('leaving while a game chunk loads cannot mount a stale game', async ({ page }) => {
  await page.goto('/');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole('button', { name: /AI 娘消消乐/ }).click();
  await expect(page.getByText('正在加载游戏…')).toBeVisible();
  await page.getByRole('button', { name: '返回游戏列表', exact: true }).click();
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  release();
  await page.getByRole('button', { name: /AI 娘消消乐/ }).click();
  await expect(page.locator('.match3-tile')).toHaveCount(64);
  await page.unroute('**/*.js');
});

test('a failed game load offers a working retry', async ({ page }) => {
  await page.goto('/');
  await page.route('**/*.js', (route) => route.abort());
  await page.getByRole('button', { name: /AI 娘消消乐/ }).click();
  await expect(page.getByRole('alert')).toContainText('游戏加载失败');
  await page.unroute('**/*.js');
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect(page.locator('.match3-tile')).toHaveCount(64);
});
