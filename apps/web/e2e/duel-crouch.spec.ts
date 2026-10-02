import { expect, test, type Page } from '@playwright/test';
async function open(page: Page, name: string) {
  await page.goto('/#/games/duel');
  await page.getByRole('button', { name: /练招房/ }).click();
  await page.getByRole('button', { name: '选择' + name }).click();
  await page.getByLabel('选择对手').selectOption('gpt');
  await page.clock.install({ time: new Date('2026-09-27T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-27T00:00:01Z'));
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await page.clock.runFor(3100);
}
for (const name of ['DeepSeek 娘', 'GPT 娘', '豆包娘'])
  test(
    name + ' crouches, low punches, sweeps and cycles running frames',
    async ({ page }, info) => {
      await open(page, name);
      const f = page.getByTestId('duel-fighter-0'),
        sprite = f.locator('[data-renderer="raster"]');
      await page.keyboard.down('KeyS');
      await page.clock.runFor(34);
      await expect(f).toHaveAttribute('data-crouched', 'true');
      await expect(sprite).toHaveAttribute('data-pose', 'crouch');
      await page.locator('image').evaluateAll((nodes) =>
        Promise.all(
          nodes.map((n) => {
            const i = new Image();
            i.src = n.getAttribute('href')!;
            return i.decode();
          }),
        ),
      );
      await page.screenshot({ path: info.outputPath('crouch.png'), fullPage: true });
      await page.keyboard.down('KeyL');
      await page.clock.runFor(34);
      await expect(f).toHaveAttribute('data-action', 'guard');
      await expect(sprite).toHaveAttribute('data-pose', 'crouch');
      await page.keyboard.up('KeyL');
      await page.keyboard.press('KeyJ');
      await page.clock.runFor(150);
      await expect(sprite).toHaveAttribute('data-pose', 'low_hit');
      await page.clock.runFor(400);
      await page.keyboard.press('KeyN');
      await page.clock.runFor(210);
      await expect(f).toHaveAttribute('data-action', 'sweep');
      await expect(sprite).toHaveAttribute('data-pose', 'sweep_hit');
      await page.screenshot({ path: info.outputPath('sweep.png'), fullPage: true });
      await page.keyboard.up('KeyS');
      await page.clock.runFor(600);
      await expect(f).toHaveAttribute('data-crouched', 'false');
      await page.keyboard.down('KeyD');
      const seen = new Set();
      for (let n = 0; n < 12; n++) {
        await page.clock.runFor(34);
        seen.add(await sprite.getAttribute('data-motion-frame'));
      }
      await page.keyboard.up('KeyD');
      expect(seen.size).toBeGreaterThanOrEqual(3);
      await page.keyboard.press('KeyN');
      await page.clock.runFor(170);
      await expect(f).toHaveAttribute('data-action', 'kick');
      await expect(sprite).toHaveAttribute('data-motion-frame', /1[34]/);
    },
  );
test('touch crouch and leg buttons work with independent pointers on a narrow screen', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Touch surface on mobile.');
  await open(page, '豆包娘');
  await page.setViewportSize({ width: 320, height: 844 });
  const crouch = page.getByRole('button', { name: '蹲下', exact: true }),
    kick = page.getByRole('button', { name: '腿法', exact: true });
  await kick.scrollIntoViewIfNeeded();
  const c = (await crouch.boundingBox())!,
    k = (await kick.boundingBox())!;
  const client = await page.context().newCDPSession(page);
  const first = { id: 1, x: c.x + c.width / 2, y: c.y + c.height / 2 },
    second = { id: 2, x: k.x + k.width / 2, y: k.y + k.height / 2 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [first, second],
  });
  await page.clock.runFor(220);
  await expect(page.getByTestId('duel-fighter-0')).toHaveAttribute('data-action', 'sweep');
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
