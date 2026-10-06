import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await page.getByTestId('stardust-start').click();
  await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  for (const label of ['角色语音', '打击音效', '待机环境声'])
    await page.getByLabel(label).uncheck();
}

async function winRound(page: Page, side: 'p1' | 'p2') {
  await page.getByTestId('stardust-arena').click();
  const opponent = side === 'p1' ? 'p2' : 'p1';
  const x = (who: string) =>
    page
      .getByTestId(`stardust-${who}`)
      .evaluate((node) => Number.parseFloat((node as HTMLElement).style.left));
  for (let hit = 0; hit < 7; hit++) {
    const difference = (await x(opponent)) - (await x(side));
    const key =
      side === 'p1'
        ? difference > 0
          ? 'KeyD'
          : 'KeyA'
        : difference > 0
          ? 'ArrowRight'
          : 'ArrowLeft';
    await page.keyboard.down(key);
    await page.clock.runFor(Math.max(16, Math.floor((Math.abs(difference) - 3) / 0.18 / 16) * 16));
    await page.keyboard.up(key);
    await page.keyboard.press(side === 'p1' ? 'KeyK' : 'Digit2');
    await page.clock.runFor(432);
  }
  await page.getByTestId(`stardust-ultimate-${side}`).click();
  await page.clock.runFor(1000);
  if (side === 'p2') {
    await page.keyboard.down('KeyA');
    await page.clock.runFor(32);
    await page.keyboard.up('KeyA');
  }
  await page.clock.runFor(side === 'p1' ? 4700 : 1300);
}

test('1-1 goes to a decider, P2 wins the match, replay and reselect obey the host contract', async ({
  page,
}) => {
  test.setTimeout(60000);
  await enter(page);
  await winRound(page, 'p1');
  await expect(page.getByTestId('stardust-score')).toContainText('P1 1 : 0 P2');
  await page.clock.runFor(1800);
  await winRound(page, 'p2');
  await expect(page.getByTestId('stardust-score')).toContainText('P1 1 : 1 P2');
  await expect(page.getByRole('region', { name: '对局结算' })).toHaveCount(0);
  await page.clock.runFor(1800);
  await expect(page.getByTestId('stardust-score')).toContainText('第 3 回合');
  await winRound(page, 'p2');
  const result = page.getByRole('region', { name: '对局结算' });
  await expect(result).toContainText('P2 花京院典明获胜 · 1 : 2');
  await page.clock.runFor(5000);
  await expect(result).toHaveCount(1);
  await result.getByRole('button', { name: '再来一局' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-mode', 'versus');
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'fight');
  await expect(page.getByTestId('stardust-score')).toContainText('P1 0 : 0 P2');
  await expect(page.getByTestId('stardust-score')).toContainText('第 1 回合');
  await page.clock.runFor(4300);
  await winRound(page, 'p1');
  await page.clock.runFor(1800);
  await winRound(page, 'p1');
  await expect(result).toContainText('P1 空条承太郎获胜 · 2 : 0');
  await result.getByRole('button', { name: '重新选角' }).click();
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'select');
  await page.clock.runFor(10000);
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'select');
  await page.getByTestId('stardust-start').click();
  await expect(page.getByTestId('stardust-score')).toContainText('P1 0 : 0 P2');
});

test('timeout draws replay and unequal HP awards only one round', async ({ page }) => {
  test.setTimeout(90000);
  await enter(page);
  await page.clock.runFor(75000);
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'round-break');
  await expect(page.getByTestId('stardust-score')).toContainText('P1 0 : 0 P2');
  await expect(page.getByTestId('stardust-round-break')).toContainText('平局加赛');
  await page.clock.runFor(1800);
  await page.getByTestId('stardust-arena').click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(240);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyJ');
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '493');
  await page.clock.runFor(74760);
  await expect(page.getByTestId('stardust-score')).toContainText('P1 1 : 0 P2');
  await expect(page.getByRole('region', { name: '对局结算' })).toHaveCount(0);
});

test('host restart during a round break discards the old round and delayed effects', async ({
  page,
}) => {
  await enter(page);
  await winRound(page, 'p1');
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByTestId('stardust-score')).toContainText('P1 0 : 0 P2');
  await expect(page.getByTestId('stardust-score')).toContainText('第 1 回合');
  await page.clock.runFor(7000);
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'fight');
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-hp', '500');
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '500');
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-barrage-ms', '0');
  await expect(page.getByTestId('stardust-score')).toContainText('第 1 回合');
});
