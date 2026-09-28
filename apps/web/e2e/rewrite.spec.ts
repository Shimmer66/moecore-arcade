import { expect, test } from '@playwright/test';

test('opens the AI action game and responds to jump, fire and pause', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('region', { name: 'AI 娘闯关游戏' })).toBeVisible();
  const selectionFits = await page.getByRole('button', { name: /Claude 娘/ }).evaluate((button) => {
    const card = button.getBoundingClientRect();
    const stage = button.closest('.rewrite-stage')!.getBoundingClientRect();
    return card.top >= stage.top && card.bottom <= stage.bottom;
  });
  expect(selectionFits).toBe(true);
  await expect
    .poll(() =>
      page
        .locator('.rewrite-personas img')
        .evaluateAll((images) =>
          images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('rewrite-select.png'), fullPage: true });
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  await expect(page.getByText('不语，只是一味地开火。')).toBeVisible();
  const player = page.getByTestId('rewrite-player');
  await expect(player).toBeVisible();
  if (testInfo.project.name.startsWith('mobile'))
    await expect(page.locator('.rewrite-world')).not.toHaveAttribute('viewBox', '0 0 800 360');
  const artLoaded = await page.locator('.rewrite-world').evaluate(async (world) => {
    const urls = [...world.querySelectorAll('image')].map((image) => image.href.baseVal);
    return Promise.all(
      urls.slice(0, 3).map(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image.naturalWidth > 0;
      }),
    );
  });
  expect(artLoaded.every(Boolean)).toBe(true);
  if (testInfo.project.name.startsWith('mobile')) {
    const ratioError = await page.locator('.rewrite-world').evaluate((world) => {
      const rect = world.getBoundingClientRect();
      const box = (world as SVGSVGElement).viewBox.baseVal;
      return Math.abs(rect.width / rect.height - box.width / box.height);
    });
    expect(ratioError).toBeLessThan(0.03);
  }
  await page.screenshot({ path: testInfo.outputPath('rewrite-playing.png'), fullPage: true });
  const initial = await player.getAttribute('transform');
  if (testInfo.project.name.startsWith('mobile'))
    await page.getByRole('button', { name: '跳跃' }).click();
  else await page.keyboard.press('Space');
  await page.clock.runFor(200);
  expect(await player.getAttribute('transform')).not.toBe(initial);
  if (testInfo.project.name.startsWith('mobile'))
    await page.getByRole('button', { name: '射击' }).click();
  else await page.keyboard.press('KeyJ');
  await page.clock.runFor(100);
  await expect(page.locator('.rewrite-world circle[fill="#fff3a9"]')).not.toHaveCount(0);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const frozen = await player.getAttribute('transform');
  await page.clock.runFor(1000);
  expect(await player.getAttribute('transform')).toBe(frozen);
  expect(errors).toEqual([]);
});

test('completing the first stage opens the second stage', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.goto('/#/games/rewrite');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const player = page.getByTestId('rewrite-player');
  async function reach(target: number) {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const transform = await player.getAttribute('transform');
      const x = Number(transform?.match(/translate\(([-\d.]+)/)?.[1]) / 40;
      if (x >= target) return;
      await page.clock.runFor(50);
    }
    throw new Error(`Could not reach x=${target}`);
  }
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyJ');
  await reach(9.2);
  await page.keyboard.press('Space');
  await page.clock.runFor(550);
  await expect(page.getByRole('dialog', { name: '选择新能力' })).toBeVisible();
  await page.getByRole('button', { name: /三发子弹/ }).click();
  await reach(19.2);
  await page.keyboard.press('Space');
  await page.clock.runFor(550);
  await expect(page.getByRole('dialog', { name: '选择新能力' })).toBeVisible();
  await page.getByRole('button', { name: /快速射击/ }).click();
  await reach(32.6);
  await expect(page.getByRole('dialog', { name: '关卡完成' })).toBeVisible();
  await page.getByRole('button', { name: /进入第 2 关/ }).click();
  await expect(page.locator('.rewrite-heading p')).toContainText('第二关 · 已读走廊');
  await expect(page.locator('.rewrite-world > image')).toHaveAttribute(
    'href',
    /level-2-background/,
  );
  await expect(page.locator('.rewrite-world text').filter({ hasText: '已读不回' })).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('rewrite-level-2.png'), fullPage: true });
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyJ');
});

for (const [name, file] of [
  ['GPT 娘', 'gpt-shoot'],
  ['Claude 娘', 'claude-shoot'],
] as const) {
  test(`${name} uses their own action art`, async ({ page }) => {
    await page.clock.install();
    await page.goto('/#/games/rewrite');
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await page.keyboard.down('KeyJ');
    await page.clock.runFor(80);
    await expect(page.getByTestId('rewrite-player').locator('image')).toHaveAttribute(
      'href',
      new RegExp(file),
    );
    await page.keyboard.up('KeyJ');
  });
}

test('character selection and controls fit a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/#/games/rewrite');
  const fits = await page.locator('.rewrite-personas').evaluate((dialog) => {
    const container = dialog.getBoundingClientRect();
    return [...dialog.querySelectorAll('button')].every((button) => {
      const rect = button.getBoundingClientRect();
      return (
        rect.left >= container.left &&
        rect.right <= container.right &&
        rect.bottom <= container.bottom
      );
    });
  });
  expect(fits).toBe(true);
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: '射击' })).toBeVisible();
});
