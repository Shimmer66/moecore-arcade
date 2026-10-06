import { expect, test, type Page } from '@playwright/test';
import { ENEMY_PROGRESS_KEY } from '../../../games/stardust/src/progress';

async function enter(
  page: Page,
  mode: 'challenge' | 'story' | 'versus' | 'practice',
  boss = 'dio',
  attack = true,
) {
  await page.addInitScript(
    ({ key, attacks }) => {
      localStorage.setItem(key, JSON.stringify({ dio: 30, ice: 30 }));
      Math.random = () => (attacks ? 0 : 0.99);
    },
    { key: ENEMY_PROGRESS_KEY, attacks: attack },
  );
  await page.clock.install();
  await page.goto('/#/games/stardust');
  const names = {
    challenge: /挑战模式/,
    story: /AI伙伴冒险/,
    versus: /双人格斗/,
    practice: /练习模式/,
  };
  await page.getByRole('button', { name: names[mode] }).click();
  if (mode !== 'story') {
    await page.getByTestId(`stardust-choice-p2-${boss}`).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /选择挑战目标|确认选择/ })
      .click();
  }
  await page.getByTestId('stardust-start').click();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await page.clock.runFor(4300);
  await expect(page.getByTestId('stardust-intro')).toBeHidden();
  for (const label of ['角色语音', '打击音效', '待机环境声'])
    await page.getByLabel(label).uncheck();
  await page.getByTestId('stardust-arena').click();
}

for (const boss of ['dio', 'ice']) {
  test(`CPU ${boss} deploys and drives its stand, pauses and damages a distant target`, async ({
    page,
  }, info) => {
    await enter(page, 'challenge', boss);
    const cpu = page.getByTestId('stardust-p2');
    const player = page.getByTestId('stardust-p1');
    await page.keyboard.down('KeyL');
    for (let frame = 0; frame < 24; frame++) {
      if ((await cpu.getAttribute('data-stand-mode')) === 'detached') break;
      await page.clock.runFor(100);
    }
    await expect(cpu).toHaveAttribute('data-stand-mode', 'detached');
    await expect(player).toHaveAttribute('data-stand-mode', 'attached');
    const stand = page.getByTestId('stardust-stand-p2');
    const bodyX = await cpu.evaluate((node) => (node as HTMLElement).style.left);
    await page.clock.runFor(64);
    expect(Number(await stand.getAttribute('data-world-x'))).toBeLessThan(Number.parseFloat(bodyX));
    expect(await cpu.evaluate((node) => (node as HTMLElement).style.left)).toBe(bodyX);
    await page
      .getByTestId('stardust-arena')
      .screenshot({ path: info.outputPath(`${boss}-computer-stand.png`) });
    const hp = Number(await player.getAttribute('data-hp'));
    const worldX = await stand.getAttribute('data-world-x');
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.clock.runFor(2000);
    await expect(cpu).toHaveAttribute('data-stand-mode', 'detached');
    await expect(stand).toHaveAttribute('data-world-x', worldX!);
    await expect(player).toHaveAttribute('data-hp', String(hp));
    await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    await page.keyboard.down('KeyL');
    await page.clock.runFor(1600);
    await page.keyboard.up('KeyL');
    expect(Number(await player.getAttribute('data-hp'))).toBeLessThan(hp);
  });
}

test('AI partner deploys without moving its owner and later recalls on its own', async ({
  page,
}) => {
  await enter(page, 'story', 'dio', false);
  const partner = page.getByTestId('stardust-partner');
  await page.clock.runFor(1000);
  const stand = page.getByTestId('stardust-stand-partner');
  await expect(stand).toBeVisible();
  expect(Number(await stand.getAttribute('data-world-x'))).toBeGreaterThan(14);
  expect(await partner.evaluate((node) => (node as HTMLElement).style.left)).toBe('14%');
  for (let step = 0; step < 80; step++) {
    if ((await stand.count()) === 0) break;
    await page.clock.runFor(100);
  }
  await expect(stand).toHaveCount(0);
  await expect(page.getByTestId('stardust-attached-stand-partner')).toBeVisible();
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-stand-mode', 'attached');
});

test('CPU deployment does not take over human versus controls or the practice dummy', async ({
  page,
}) => {
  await enter(page, 'versus');
  await page.keyboard.press('KeyF');
  await page.clock.runFor(8000);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-stand-mode', 'detached');
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-stand-mode', 'attached');
  await expect(page.getByTestId('stardust-stand-p1')).toHaveAttribute('data-world-x', '25');
  await page.reload();
  await page.getByRole('button', { name: /练习模式/ }).click();
  await page.getByTestId('stardust-choice-p2-dio').click();
  await page.getByRole('dialog').getByRole('button', { name: '确认选择' }).click();
  await page.getByTestId('stardust-start').click();
  await page.clock.runFor(4300);
  await page.clock.runFor(8000);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-stand-mode', 'attached');
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-hp', '500');
});
