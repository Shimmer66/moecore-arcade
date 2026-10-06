import { expect, test, type Page } from '@playwright/test';
import { attackSpecs } from '../../../games/stardust/src/rules';

async function enter(page: Page, versus = false) {
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: versus ? /双人格斗/ : /练习模式/ }).click();
  for (const group of versus ? ['玩家一选择角色', '玩家二选择角色'] : ['玩家一选择角色']) {
    await page
      .getByRole('group', { name: group })
      .getByRole('button', { name: /空条承太郎/ })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: /确认/ }).click();
  }
  await page.getByTestId('stardust-start').click();
  await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByTestId('stardust-arena').click();
}

async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.clock.runFor(ms);
  await page.keyboard.up(key);
}

test('Star Finger hits beyond heavy range once and pauses during extension', async ({ page }) => {
  await enter(page);
  await hold(page, 'KeyD', 160);
  const target = page.getByTestId('stardust-p2');
  await page.keyboard.press('KeyK');
  await page.clock.runFor(500);
  await expect(target).toHaveAttribute('data-hp', '500');
  await page.getByTestId('stardust-finger-p1').click();
  await page.clock.runFor(180);
  const finger = page.getByTestId('stardust-star-finger');
  await expect(finger).toHaveCount(1);
  await expect(page.getByTestId('stardust-attached-stand-p1')).toBeVisible();
  const length = await finger.getAttribute('data-length');
  await expect(target).toHaveAttribute('data-hp', '500');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.clock.runFor(1000);
  await expect(finger).toHaveAttribute('data-length', length!);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(300);
  await expect(finger).toHaveCount(0);
  await expect(target).toHaveAttribute('data-hp', String(500 - attackSpecs.heavy.damage));
  await expect(page.getByTestId('stardust-damage-feedback').last()).toHaveText(
    `流星指刺−${attackSpecs.heavy.damage}`,
  );
});

test('Star Finger cannot hit outside range and P2 uses zero', async ({ page }) => {
  await enter(page, true);
  await page.keyboard.press('KeyO');
  await page.clock.runFor(600);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '500');
  await hold(page, 'ArrowLeft', 160);
  await page.keyboard.press('Digit0');
  await page.clock.runFor(500);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute(
    'data-hp',
    String(500 - attackSpecs.heavy.damage),
  );
});
