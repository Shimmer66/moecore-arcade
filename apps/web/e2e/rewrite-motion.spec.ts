import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
});
for (const [name, id] of [
  ['DeepSeek 娘', 'deepseek'],
  ['GPT 娘', 'gpt'],
  ['Claude 娘', 'claude'],
] as const) {
  test(`${name} animates run, somersault, prone and aiming with aligned sprite cells`, async ({
    page,
  }, info) => {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    const actor = page.getByTestId('rewrite-player').locator('.actor-sprite');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyJ');
    await page.clock.runFor(80);
    await expect(actor).toHaveAttribute('data-pose', 'run');
    await expect(actor).toHaveAttribute('data-ready', 'true');
    await expect(actor).toHaveAttribute('data-persona', id);
    await expect(actor.locator('.sprite-atlas')).toHaveAttribute(
      'href',
      new RegExp(`${id}-motion`),
    );
    const frame = await actor.getAttribute('data-frame');
    await page.clock.runFor(120);
    expect(await actor.getAttribute('data-frame')).not.toBe(frame);
    await page.screenshot({ path: info.outputPath('run.png'), fullPage: true });
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyJ');
    await page.keyboard.press('Space');
    await page.clock.runFor(200);
    await expect(actor).toHaveAttribute('data-pose', 'jump');
    expect(Number(await actor.getAttribute('data-spin'))).toBeGreaterThan(20);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    const frozen = await actor.getAttribute('data-spin');
    await page.clock.runFor(700);
    await expect(actor).toHaveAttribute('data-spin', frozen!);
    await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    await page.clock.runFor(100);
    await page.keyboard.down('KeyJ');
    await page.clock.runFor(50);
    await expect(actor).toHaveAttribute('data-spin', '0.0');
    await page.keyboard.up('KeyJ');
    await page.clock.runFor(750);
    await page.keyboard.down('KeyS');
    await page.keyboard.down('KeyJ');
    await page.clock.runFor(50);
    await expect(actor).toHaveAttribute('data-pose', 'prone');
    const height = Number(await actor.locator('.sprite-cell').getAttribute('height'));
    expect(height).toBeGreaterThan(30);
    expect(height).toBeLessThan(40);
    await page.screenshot({ path: info.outputPath('prone.png'), fullPage: true });
    await page.keyboard.up('KeyS');
    await page.keyboard.down('KeyW');
    await page.clock.runFor(50);
    await expect(actor).toHaveAttribute('data-pose', 'aim-up');
    await expect(actor).toHaveAttribute('data-ready', 'true');
    await expect(actor.locator('.sprite-atlas')).toHaveAttribute('href', /aim-motion/);
    await page.screenshot({ path: info.outputPath('aim-up.png'), fullPage: true });
    await page.keyboard.up('KeyW');
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyW');
    await page.clock.runFor(50);
    await expect(actor).toHaveAttribute('data-pose', 'aim-up-diagonal');
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Space');
    await page.keyboard.down('KeyS');
    await page.clock.runFor(100);
    await expect(actor).toHaveAttribute('data-pose', 'aim-down-diagonal');
    await page.keyboard.up('KeyD');
    await page.clock.runFor(50);
    await expect(actor).toHaveAttribute('data-pose', 'aim-down');
    await page.screenshot({ path: info.outputPath('aim-down.png'), fullPage: true });
    await page.keyboard.up('KeyS');
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyJ');
  });
}

test('reduced motion keeps essential poses but stops cycling, spinning and recoil', async ({
  page,
}) => {
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(100);
  const actor = page.getByTestId('rewrite-player').locator('.actor-sprite');
  await expect(actor).toHaveAttribute('data-ready', 'true');
  await page.getByRole('checkbox', { name: '减少动态效果', exact: true }).check();
  await page.clock.runFor(100);
  const frame = await actor.getAttribute('data-frame');
  await page.clock.runFor(250);
  await expect(actor).toHaveAttribute('data-frame', frame!);
  await page.keyboard.up('KeyD');
  await page.locator('.rewrite-stage').focus();
  await page.keyboard.press('Space');
  await page.keyboard.down('KeyJ');
  await page.clock.runFor(180);
  await expect(actor).toHaveAttribute('data-pose', 'jump');
  await expect(actor).toHaveAttribute('data-spin', '0.0');
  await expect(actor).toHaveAttribute('data-recoil', '0.00');
  await page.keyboard.up('KeyJ');
});

test('depth movement uses rear-view steps and an actual low pose', async ({ page }, info) => {
  await page.getByRole('button', { name: '关卡演练', exact: true }).click();
  await page.getByLabel('演练目标', { exact: true }).selectOption('1');
  await page.getByLabel('演练起始位置', { exact: true }).selectOption('entry');
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const actor = page.getByTestId('rewrite-player').locator('.actor-sprite');
  await expect(actor).toHaveAttribute('data-ready', 'true');
  await expect(actor.locator('.sprite-atlas')).toHaveAttribute('href', /depth-motion/);
  await page.keyboard.down('KeyD');
  await page.clock.runFor(180);
  const frame = await actor.getAttribute('data-frame');
  await page.clock.runFor(100);
  expect(await actor.getAttribute('data-frame')).not.toBe(frame);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS');
  await page.clock.runFor(50);
  await expect(actor).toHaveAttribute('data-pose', 'prone');
  await expect(actor).toHaveAttribute('data-frame', '11');
  expect(Number(await actor.locator('.sprite-cell').getAttribute('height'))).toBeLessThan(40);
  await page.screenshot({ path: info.outputPath('depth-low-pose.png'), fullPage: true });
  await page.keyboard.up('KeyS');
});
