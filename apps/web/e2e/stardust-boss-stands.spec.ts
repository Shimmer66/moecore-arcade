import { expect, test, type Page } from '@playwright/test';
import { ENEMY_PROGRESS_KEY } from '../../../games/stardust/src/progress';

async function enter(page: Page, first: 'dio' | 'ice', second = 'jotaro') {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ dio: 30, ice: 30 }));
  }, ENEMY_PROGRESS_KEY);
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /双人格斗/ }).click();
  for (const [side, id] of [
    ['p1', first],
    ['p2', second],
  ]) {
    await page.getByTestId(`stardust-choice-${side}-${id}`).click();
    await page.getByRole('dialog').getByRole('button', { name: '确认选择' }).click();
  }
  await page.getByTestId('stardust-start').click();
  await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  for (const label of ['角色语音', '打击音效', '待机环境声'])
    await page.getByLabel(label).uncheck();
  await page.getByTestId('stardust-arena').click();
}

for (const id of ['dio', 'ice'] as const) {
  test(`${id} has independent body and stand art with the complete basic animation set`, async ({
    page,
  }, info) => {
    await enter(page, id);
    const body = page.getByTestId('stardust-p1');
    const initialHp = Number(await body.getAttribute('data-hp'));
    const attached = page.getByTestId('stardust-attached-stand-p1');
    await expect(attached).toBeVisible();
    await expect(attached).toHaveAttribute('data-stand-character', id);
    await expect(attached).toHaveAttribute('data-stand-pose', 'idle');
    await expect(attached.locator('.fighter-art')).toHaveCSS(
      'background-image',
      id === 'dio' ? /dio-the-world-entity/ : /ice-cream-entity/,
    );
    await expect(body.locator('.fighter-art')).toHaveCSS(
      'background-image',
      new RegExp(`${id}-body-only-motion`),
    );
    await expect(page.getByTestId('stardust-detach-p1')).toBeEnabled();
    await page
      .getByTestId('stardust-arena')
      .screenshot({ path: info.outputPath(`${id}-attached.png`) });

    await page.keyboard.press('KeyJ');
    await expect(attached).toHaveAttribute('data-stand-pose', 'light');
    await expect(attached.locator('.fighter-art')).toHaveCSS('background-position', '66.6667% 0%');
    await page.clock.runFor(272);
    await page.keyboard.press('KeyK');
    await expect(attached).toHaveAttribute('data-stand-pose', 'heavy');
    await expect(attached.locator('.fighter-art')).toHaveCSS('background-position', '100% 0%');
    await page.clock.runFor(432);
    await page.keyboard.press('KeyU');
    await expect(attached).toHaveAttribute('data-stand-pose', 'barrage');
    const frames = new Set<string>();
    for (let step = 0; step < 4; step++) {
      await page.clock.runFor(80);
      frames.add(
        await attached
          .locator('.fighter-art')
          .evaluate((node) => getComputedStyle(node).backgroundPosition),
      );
    }
    expect(frames.size).toBe(2);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    const pausedFrame = await attached.locator('.fighter-art').getAttribute('style');
    await page.clock.runFor(1000);
    await expect(attached.locator('.fighter-art')).toHaveAttribute('style', pausedFrame!);
    await page.getByRole('button', { name: '继续游戏', exact: true }).click();

    await page.keyboard.press('KeyF');
    const detached = page.getByTestId('stardust-stand-p1');
    await expect(detached).toBeVisible();
    await expect(body).toHaveAttribute('data-stand-mode', 'detached');
    await page.keyboard.press('KeyF');
    await expect(attached).toHaveAttribute('data-stand-pose', 'recall');
    await expect(body).toHaveAttribute('data-barrage-ms', '0');
    await page.clock.runFor(192);
    await expect(attached).toHaveAttribute('data-stand-pose', 'idle');
    await page.keyboard.press('KeyF');
    const ownerX = await body.evaluate((node) => (node as HTMLElement).style.left);
    await page.keyboard.down('KeyD');
    await page.clock.runFor(64);
    await page.keyboard.up('KeyD');
    await expect(detached).toHaveAttribute('data-stand-pose', 'move');
    expect(Number(await detached.getAttribute('data-world-x'))).toBeGreaterThan(25);
    expect(await body.evaluate((node) => (node as HTMLElement).style.left)).toBe(ownerX);
    await page.clock.runFor(160);
    await page.keyboard.down('KeyL');
    await page.clock.runFor(32);
    await expect(detached).toHaveAttribute('data-stand-pose', 'guard');
    await expect(detached.locator('.fighter-art')).toHaveCSS(
      'background-position',
      '33.3333% 100%',
    );
    await page
      .getByTestId('stardust-arena')
      .screenshot({ path: info.outputPath(`${id}-detached-guard.png`) });
    await page.keyboard.up('KeyL');
    await page.keyboard.press('KeyF');
    await page.clock.runFor(240);
    await page.keyboard.press('KeyW');
    await expect(body.locator('.fighter-art')).toHaveCSS(
      'background-image',
      new RegExp(`${id}-body-only-motion`),
    );
    await page.clock.runFor(600);
    await page.keyboard.down('ArrowLeft');
    await page.clock.runFor(240);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.press('Digit1');
    await expect(body).toHaveAttribute('data-hp', String(initialHp - 7));
    await expect(attached).toHaveAttribute('data-stand-pose', 'hurt');
    await expect(attached.locator('.fighter-art')).toHaveCSS(
      'background-position',
      '66.6667% 100%',
    );
  });
}

test('both boss stands support P2 controls, mirroring and host restart', async ({ page }) => {
  await enter(page, 'ice', 'dio');
  await expect(page.getByTestId('stardust-attached-stand-p1')).toHaveAttribute(
    'data-stand-character',
    'ice',
  );
  await expect(page.getByTestId('stardust-attached-stand-p2')).toHaveAttribute(
    'data-stand-character',
    'dio',
  );
  await expect(page.getByTestId('stardust-detach-p2')).toBeEnabled();
  await page.keyboard.press('Digit7');
  await page.keyboard.down('ArrowLeft');
  await page.clock.runFor(64);
  await page.keyboard.up('ArrowLeft');
  const stand = page.getByTestId('stardust-stand-p2');
  expect(Number(await stand.getAttribute('data-world-x'))).toBeLessThan(75);
  await expect(stand.locator('.fighter-art')).toHaveCSS('--stand-flip', '-1');
  expect(
    await page.getByTestId('stardust-p2').evaluate((node) => (node as HTMLElement).style.left),
  ).toBe('75%');
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await page.clock.runFor(4300);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-character', 'ice');
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-character', 'dio');
  await expect(page.getByTestId('stardust-attached-stand-p2')).toHaveAttribute(
    'data-stand-pose',
    'idle',
  );
  await expect(page.getByTestId('stardust-stand-p2')).toHaveCount(0);
});
