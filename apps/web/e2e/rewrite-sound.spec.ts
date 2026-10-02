import { expect, test, type Page } from '@playwright/test';

async function expandAudio(page: Page) {
  const panel = page.locator('.rewrite-audio');
  if (!(await panel.evaluate((element) => (element as HTMLDetailsElement).open)))
    await panel.locator('summary').click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-10-01T09:00:00Z'));
});

test('music follows simulation time and pause clears active audio immediately', async ({
  page,
}) => {
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  const game = page.locator('.rewrite-game');
  await page.clock.runFor(100);
  const first = await game.getAttribute('data-music-beat');
  expect(first).toMatch(/^0:0:false:/);
  await page.clock.runFor(600);
  expect(await game.getAttribute('data-music-beat')).not.toBe(first);
  expect(Number(await game.getAttribute('data-audio-voices'))).toBeLessThanOrEqual(24);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(game).toHaveAttribute('data-audio-voices', '0');
  await expect(game).toHaveAttribute('data-music-beat', '');
  await page.clock.runFor(1000);
  await expect(game).toHaveAttribute('data-music-beat', '');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(100);
  await expect(game).not.toHaveAttribute('data-music-beat', '');
});

test('rapid fire respects the voice cap and the sound toggle stays silent', async ({ page }) => {
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  const game = page.locator('.rewrite-game');
  await page.keyboard.down('KeyJ');
  for (let i = 0; i < 12; i++) {
    await page.clock.runFor(100);
    expect(Number(await game.getAttribute('data-audio-voices'))).toBeLessThanOrEqual(24);
  }
  await page.keyboard.up('KeyJ');
  await expandAudio(page);
  await page.getByRole('button', { name: '声音 开', exact: true }).click();
  await expect(game).toHaveAttribute('data-audio-voices', '0');
  await expect(game).toHaveAttribute('data-music-beat', '');
  await page.keyboard.down('KeyJ');
  await page.clock.runFor(1000);
  await page.keyboard.up('KeyJ');
  await expect(game).toHaveAttribute('data-audio-voices', '0');
  await expect(game).toHaveAttribute('data-music-beat', '');
});

test('music and effects volumes are independent and survive a host restart', async ({
  page,
}, info) => {
  await expandAudio(page);
  const music = page.getByRole('slider', { name: '音乐音量' });
  const effects = page.getByRole('slider', { name: '效果音量' });
  await expect(music).toHaveValue('0.55');
  await expect(effects).toHaveValue('1');
  await music.fill('0.25');
  await effects.fill('0.4');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const game = page.locator('.rewrite-game');
  await expect(game).toHaveAttribute('data-music-volume', '0.25');
  await expect(game).toHaveAttribute('data-effects-volume', '0.4');
  await page.screenshot({ path: info.outputPath('sound-mixer.png'), fullPage: true });
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(game).toHaveAttribute('data-music-volume', '0.25');
  await expect(game).toHaveAttribute('data-effects-volume', '0.4');
  await expandAudio(page);
  await music.fill('0');
  await effects.fill('0');
  await page.clock.runFor(500);
  await expect(game).toHaveAttribute('data-audio-voices', '0');
});
