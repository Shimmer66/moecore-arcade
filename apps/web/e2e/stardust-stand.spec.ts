import { expect, test, type Page } from '@playwright/test';
import { attackSpecs } from '../../../games/stardust/src/rules';
import { BARRAGE_HIT_INTERVAL_MS } from '../../../games/stardust/src/barrage';

async function enter(page: Page, hero: string, versus = false) {
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: versus ? /双人格斗/ : /练习模式/ }).click();
  await page
    .getByRole('group', { name: '玩家一选择角色' })
    .getByRole('button', { name: new RegExp(hero) })
    .click();
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible())
    await dialog.getByRole('button', { name: /确认|选用|选择角色|使用角色/ }).click();
  await page.getByTestId('stardust-start').click();
  await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByLabel('角色语音').uncheck();
  await page.getByLabel('打击音效').uncheck();
  await page.getByLabel('待机环境声').uncheck();
  await page.getByTestId('stardust-arena').click();
}

const hp = (page: Page, side = 'p2') =>
  page.getByTestId(`stardust-${side}`).getAttribute('data-hp').then(Number);
const distance = (page: Page, side = 'p1') =>
  page.getByTestId(`stardust-stand-${side}`).getAttribute('data-distance-m').then(Number);

async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.clock.runFor(ms);
  await page.keyboard.up(key);
}

async function approachTarget(page: Page) {
  for (let step = 0; step < 40; step++) {
    const positions = await page
      .locator('[data-testid="stardust-p1"], [data-testid="stardust-p2"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => Number.parseFloat((node as HTMLElement).style.left)),
      );
    if (Math.abs(positions[1]! - positions[0]!) <= 1.5) return;
    await hold(page, positions[1]! > positions[0]! ? 'KeyD' : 'KeyA', 16);
  }
  throw new Error('Could not approach the practice target');
}

test('manual A-rank stand waits for input, leaves its owner still, pauses and recalls', async ({
  page,
}) => {
  await enter(page, '花京院典明');
  const owner = page.getByTestId('stardust-p1');
  const ownerArt = await owner.locator(':scope > .fighter-art').boundingBox();
  expect(ownerArt).not.toBeNull();
  expect(ownerArt!.width).toBeLessThanOrEqual(180);
  const bodyPosition = await owner.getAttribute('style');
  const initialHp = await hp(page);
  await page.getByTestId('stardust-detach-p1').click();
  const stand = page.getByTestId('stardust-stand-p1');
  const standArt = stand.locator('.fighter-art');
  await expect(standArt).toHaveCSS('background-image', /kakyoin-stand-motion-v1/);
  const idleFrame = await standArt.evaluate(
    (element) => getComputedStyle(element).backgroundPosition,
  );
  await page.clock.runFor(1200);
  expect(await distance(page)).toBe(0);
  expect(await hp(page)).toBe(initialHp);
  await hold(page, 'KeyD', 2000);
  await expect
    .poll(() => standArt.evaluate((element) => getComputedStyle(element).backgroundPosition))
    .not.toBe(idleFrame);
  expect(await distance(page)).toBeGreaterThan(7.8);
  expect(await distance(page)).toBeLessThan(8.2);
  await expect(stand).toHaveCSS('opacity', '1');
  const stationary = await stand.getAttribute('data-world-x');
  await page.clock.runFor(600);
  await expect(stand).toHaveAttribute('data-world-x', stationary!);
  await expect(owner).toHaveAttribute('style', bodyPosition!);
  await hold(page, 'KeyD', 2800);
  expect(await hp(page)).toBe(initialHp);
  expect(await distance(page)).toBeGreaterThan(15);
  await page
    .locator('.controls section')
    .first()
    .getByRole('button', { name: /替身连打/ })
    .click();
  await page.clock.runFor(320);
  expect(await hp(page)).toBeLessThan(initialHp);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const pausedHp = await hp(page);
  const pausedPosition = await stand.getAttribute('style');
  await page.clock.runFor(1200);
  expect(await hp(page)).toBe(pausedHp);
  await expect(stand).toHaveAttribute('style', pausedPosition!);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.getByTestId('stardust-detach-p1').click();
  await expect(stand).toHaveCount(0);
  await expect(owner).toHaveAttribute('data-stand-mode', 'attached');
  await expect(owner).toHaveAttribute('data-barrage-ms', '0');
  await hold(page, 'KeyA', 64);
  expect(await owner.getAttribute('style')).not.toBe(bodyPosition);
});

test('attached barrage only damages inside one meter and stops after moving out', async ({
  page,
}) => {
  await enter(page, '空条承太郎');
  await hold(page, 'KeyD', 256);
  const initialHp = await hp(page);
  await page.keyboard.press('KeyU');
  await page.clock.runFor(640);
  expect(await hp(page)).toBe(initialHp);
  await approachTarget(page);
  await page.clock.runFor(640);
  expect(await hp(page)).toBeLessThan(initialHp);
  await hold(page, 'KeyA', 64);
  const outsideHp = await hp(page);
  await page.clock.runFor(1280);
  expect(await hp(page)).toBe(outsideHp);
});

test('C-rank distance buttons and movement keys move only the stand and respect two meters', async ({
  page,
}) => {
  await enter(page, '空条承太郎');
  const owner = page.getByTestId('stardust-p1');
  const bodyPosition = await owner.getAttribute('style');
  await page.getByTestId('stardust-detach-p1').click();
  const stand = page.getByTestId('stardust-stand-p1');
  await page.clock.runFor(600);
  expect(await distance(page)).toBe(0);
  await page.getByLabel('角色语音').focus();
  await page.keyboard.press('KeyE');
  expect(await distance(page)).toBe(0.5);
  await page.getByTestId('stardust-distance-far-p1').click();
  expect(await distance(page)).toBe(1);
  const farther = Number(await stand.getAttribute('data-display-x'));
  await page.getByTestId('stardust-distance-near-p1').click();
  expect(await distance(page)).toBe(0.5);
  expect(Number(await stand.getAttribute('data-display-x'))).toBeLessThan(farther);
  await page.keyboard.press('KeyQ');
  expect(await distance(page)).toBe(0);
  await hold(page, 'KeyD', 1000);
  expect(await distance(page)).toBe(2);
  await expect(stand).toHaveCSS('opacity', '0.2');
  await page.keyboard.press('KeyE');
  expect(await distance(page)).toBe(2);
  const bodyArt = await owner.locator('.fighter-art').boundingBox();
  const standArt = await stand.locator('.fighter-art').boundingBox();
  expect(standArt!.x - bodyArt!.x - bodyArt!.width).toBeGreaterThan(68);
  const left = page.getByRole('button', { name: '玩家一向左移动' });
  await left.scrollIntoViewIfNeeded();
  const box = await left.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.clock.runFor(64);
  await page.mouse.up();
  expect(await distance(page)).toBeLessThan(2);
  await expect(owner).toHaveAttribute('style', bodyPosition!);
  await page.keyboard.press('KeyF');
  await expect(stand).toHaveCount(0);
});

test('half damage remains and P2 can adjust its own stand with 8 and 9', async ({ page }) => {
  await enter(page, '花京院典明', true);
  const initialHp = await hp(page, 'p1');
  const owner = page.getByTestId('stardust-p1');
  const bodyPosition = await owner.getAttribute('style');
  await page.getByTestId('stardust-detach-p1').click();
  await hold(page, 'KeyD', 4000);
  await page.locator('.controls section').nth(1).getByRole('button', { name: /轻拳/ }).click();
  await page.clock.runFor(160);
  expect(await hp(page, 'p1')).toBe(initialHp - attackSpecs.light.damage / 2);
  await expect(page.getByTestId('stardust-damage-feedback').last()).toHaveText(
    `替身返还50%普通攻击−${attackSpecs.light.damage / 2}`,
  );
  await expect(owner).toHaveAttribute('style', bodyPosition!);
  const p2 = page.getByTestId('stardust-p2');
  const p2Position = await p2.getAttribute('style');
  await page.keyboard.press('Digit7');
  await page.keyboard.press('Digit9');
  expect(await distance(page, 'p2')).toBe(0.5);
  await page.getByTestId('stardust-distance-near-p2').click();
  expect(await distance(page, 'p2')).toBe(0);
  await page.getByTestId('stardust-distance-far-p2').click();
  await page.keyboard.press('Digit8');
  expect(await distance(page, 'p2')).toBe(0);
  await expect(p2).toHaveAttribute('style', p2Position!);
});

test('barrage misses hidden-coordinate contact and damages only after visible manual contact', async ({
  page,
}) => {
  await enter(page, '空条承太郎', true);
  const initialHp = await hp(page);
  await page.getByTestId('stardust-detach-p1').click();
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyE');
  await hold(page, 'ArrowLeft', 240);
  await page
    .locator('.controls section')
    .first()
    .getByRole('button', { name: /替身连打/ })
    .click();
  await page.clock.runFor(BARRAGE_HIT_INTERVAL_MS * 2 + 32);
  expect(await hp(page)).toBe(initialHp);
  const stand = page.getByTestId('stardust-stand-p1');
  const enemyX = await page
    .getByTestId('stardust-p2')
    .evaluate((node) => Number.parseFloat((node as HTMLElement).style.left));
  for (let frame = 0; frame < 40; frame++) {
    const displayX = Number(await stand.getAttribute('data-display-x'));
    if (displayX - enemyX <= 2.4) break;
    await hold(page, 'KeyA', 16);
  }
  const contactX = Number(await stand.getAttribute('data-display-x'));
  expect(contactX - enemyX).toBeGreaterThanOrEqual(0);
  expect(contactX - enemyX).toBeLessThanOrEqual(2.4);
  await page.clock.runFor(BARRAGE_HIT_INTERVAL_MS + 32);
  expect(await hp(page)).toBeLessThan(initialHp);
  for (let step = 0; step < 4; step++) await page.keyboard.press('KeyE');
  await page.clock.runFor(3200);
  const afterStatuses = await hp(page);
  await page.clock.runFor(BARRAGE_HIT_INTERVAL_MS * 2);
  expect(await hp(page)).toBe(afterStatuses);
});

test('forced body knockback beyond C range still makes the stand vanish', async ({ page }) => {
  await enter(page, '空条承太郎', true);
  await page.getByTestId('stardust-detach-p1').click();
  for (let step = 0; step < 4; step++) await page.keyboard.press('KeyE');
  await hold(page, 'ArrowLeft', 256);
  await page.locator('.controls section').nth(1).getByRole('button', { name: /重击/ }).click();
  await page.clock.runFor(128);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-stand-mode', 'vanished');
  await expect(page.getByTestId('stardust-stand-p1')).toHaveCount(0);
});

for (const [hero, effect] of [
  ['空条承太郎', 'bleed'],
  ['简·皮耶尔·波鲁那雷夫', 'bleed'],
  ['花京院典明', 'emerald'],
  ['穆罕默德·阿布德尔', 'burn'],
]) {
  test(`${hero} manual stand hits apply ${effect} for two HP per second`, async ({ page }) => {
    await enter(page, hero!);
    const initialHp = await hp(page);
    await approachTarget(page);
    await page.getByTestId('stardust-detach-p1').click();
    await page
      .locator('.controls section')
      .first()
      .getByRole('button', { name: /轻拳|火焰弹/ })
      .click();
    if (effect === 'burn' || effect === 'emerald') await page.clock.runFor(48);
    const hitDamage = effect === 'burn' ? 12 : attackSpecs.light.damage;
    const afterHit = initialHp - hitDamage;
    expect(await hp(page)).toBe(afterHit);
    await expect(page.getByTestId('stardust-damage-feedback').last()).toHaveText(
      `${effect === 'burn' ? '火焰弹' : '普通攻击'}−${hitDamage}`,
    );
    await expect(page.getByTestId(`stardust-status-p2-${effect}`)).toBeVisible();
    await page.getByTestId('stardust-detach-p1').click();
    await hold(page, 'KeyA', 96);
    await page.clock.runFor(928);
    expect(await hp(page)).toBe(afterHit - 2);
    const source = effect === 'burn' ? '燃烧' : effect === 'emerald' ? '绿宝石流血' : '流血';
    await expect(page.getByTestId('stardust-damage-feedback').last()).toHaveText(`${source}−2`);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.clock.runFor(1500);
    expect(await hp(page)).toBe(afterHit - 2);
    await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    await page.clock.runFor(2000);
    expect(await hp(page)).toBe(afterHit - 6);
    await expect(page.getByTestId(`stardust-status-p2-${effect}`)).toHaveCount(0);
  });
}

test('Avdol fires one travelling flame, pauses in flight and deals 12 only on impact', async ({
  page,
}) => {
  await enter(page, '穆罕默德·阿布德尔');
  await hold(page, 'KeyD', 160);
  const initialHp = await hp(page);
  await page
    .locator('.controls section')
    .first()
    .getByRole('button', { name: /火焰弹/ })
    .click();
  const ball = page.getByTestId('stardust-fireball');
  await expect(ball).toHaveCount(1);
  expect(await hp(page)).toBe(initialHp);
  await page.clock.runFor(150);
  const position = await ball.getAttribute('data-x');
  expect(await hp(page)).toBe(initialHp);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.clock.runFor(2000);
  await expect(ball).toHaveAttribute('data-x', position!);
  expect(await hp(page)).toBe(initialHp);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(900);
  await expect(ball).toHaveCount(0);
  expect(await hp(page)).toBe(initialHp - 12);
  await expect(page.getByTestId('stardust-damage-feedback').last()).toHaveText('火焰弹−12');
  await page.clock.runFor(1000);
  expect(await hp(page)).toBe(initialHp - 14);
});
