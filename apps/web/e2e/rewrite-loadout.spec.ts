import { expect, test, type Page } from '@playwright/test';
async function expandLoadout(page: Page) {
  const panel = page.locator('.rewrite-loadout-panel');
  if (!(await panel.evaluate((element) => (element as HTMLDetailsElement).open)))
    await panel.locator('summary').click();
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
});
test('manual selection works by keyboard and touch without mixing player inventories', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
  await page.getByRole('button', { name: '双人协作', exact: true }).click();
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  await expandLoadout(page);
  const p1 = page.getByTestId('rewrite-player'),
    p2 = page.getByTestId('rewrite-partner');
  await page.keyboard.press('Digit4');
  await page.clock.runFor(50);
  await expect(p1).toHaveAttribute('data-weapon', 'laser');
  await expect(p2).toHaveAttribute('data-weapon', 'spread');
  await page.keyboard.press('BracketRight');
  await page.clock.runFor(50);
  await expect(p2).toHaveAttribute('data-weapon', 'rapid');
  await page.getByRole('button', { name: 'P1 装备温度拉满', exact: true }).click();
  await page.clock.runFor(50);
  await expect(p1).toHaveAttribute('data-weapon', 'flame');
  await expect(page.getByRole('button', { name: 'P1 装备温度拉满', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('KeyQ');
  await page.clock.runFor(50);
  await expect(p1).toHaveAttribute('data-weapon', 'laser');
  await page.getByRole('button', { name: 'P2 切换下一把武器', exact: true }).click();
  await page.clock.runFor(50);
  await expect(p2).toHaveAttribute('data-weapon', 'laser');
  await expect(page.locator('.buff-rack').first()).toContainText('护盾');
  await expect(page.locator('.buff-rack').first()).toContainText('手雷');
  const urls = await page
    .locator('.weapon-rack image,.buff-rack image')
    .evaluateAll((images) => images.map((i) => (i as SVGImageElement).href.baseVal));
  expect(urls.length).toBe(18);
  expect(
    await page.evaluate(
      async (urls) =>
        Promise.all(
          urls.map(async (url) => {
            const image = new Image();
            image.src = url;
            await image.decode();
            return image.naturalWidth;
          }),
        ),
      urls,
    ),
  ).toEqual(Array(18).fill(1254));
  await page.screenshot({ path: info.outputPath('weapon-rack-duo.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
test('locked weapons cannot be selected and the battlefield uses distinct loot and enemy images', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  const panel = page.locator('.rewrite-loadout-panel');
  const compact = (await page.viewportSize())!.width < 760;
  expect(await panel.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(!compact);
  await expandLoadout(page);
  await expect(page.getByRole('button', { name: 'P1 装备思维链激光', exact: true })).toBeDisabled();
  await page.keyboard.press('Digit4');
  await page.clock.runFor(50);
  await expect(page.getByTestId('rewrite-player')).toHaveAttribute('data-weapon', 'homing');
  await page.keyboard.press('KeyE');
  await page.clock.runFor(50);
  await expect(page.getByTestId('rewrite-player')).toHaveAttribute('data-weapon', 'pulse');
  await expect(page.locator('[data-supply] [data-art]').first()).toBeVisible();
  const images = page.locator('.rewrite-world [data-enemy] svg[data-art] image');
  expect(await images.count()).toBeGreaterThan(0);
  await expect(images.first()).toHaveAttribute('href', /enemy-atlas-v1/);
  await page.keyboard.down('KeyD');
  await page.clock.runFor(420);
  await page.keyboard.up('KeyD');
  await expect(page.getByRole('button', { name: 'P1 装备发散思维', exact: true })).toBeEnabled();
  await expect(page.getByTestId('rewrite-player')).toHaveAttribute('data-weapon', 'pulse');
  await page.getByRole('button', { name: 'P1 装备发散思维', exact: true }).click();
  await page.clock.runFor(50);
  await expect(page.getByTestId('rewrite-player')).toHaveAttribute('data-weapon', 'spread');
  await page.screenshot({ path: info.outputPath('weapon-rack-solo.png'), fullPage: true });
});
