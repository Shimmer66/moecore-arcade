import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: /双人格斗/ }).click();
  await page
    .getByRole('group', { name: '玩家一选择角色' })
    .getByRole('button', { name: /花京院典明/ })
    .click();
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: '确认选择' }).click();
  await page.getByTestId('stardust-start').click();
  await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  for (const name of ['打击音效', '角色语音', '待机环境声']) await page.getByLabel(name).uncheck();
  await page.getByTestId('stardust-arena').click();
}

const x = (page: Page, side: string) =>
  page.getByTestId(`stardust-${side}`).evaluate((node) => (node as HTMLElement).style.left);

test('light fires one gem and heavy fires three, with real travel and paused flight', async ({
  page,
}, info) => {
  await enter(page);
  const gems = page.getByTestId('stardust-emerald-projectile');
  const target = page.getByTestId('stardust-p2');
  await page.keyboard.press('KeyJ');
  await expect(gems).toHaveCount(1);
  await expect(target).toHaveAttribute('data-hp', '500');
  await page.clock.runFor(240);
  await expect(target).toHaveAttribute('data-hp', '500');
  expect(Number(await gems.getAttribute('data-world-x'))).toBeGreaterThan(25);
  await page.clock.runFor(500);
  await expect(target).toHaveAttribute('data-hp', '493');
  await expect(gems).toHaveCount(0);
  await page.keyboard.press('KeyK');
  await expect(gems).toHaveCount(3);
  await page.clock.runFor(240);
  await page
    .getByTestId('stardust-arena')
    .screenshot({ path: info.outputPath('three-emeralds.png') });
  const positions = await gems.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('style')),
  );
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.clock.runFor(2000);
  expect(
    await gems.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('style'))),
  ).toEqual(positions);
  await expect(target).toHaveAttribute('data-hp', '493');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(500);
  await expect(target).toHaveAttribute('data-hp', '480');
  await expect(gems).toHaveCount(0);
  expect(await x(page, 'p1')).toBe('25%');
  expect(await x(page, 'p2')).toBe('82%');
});

test('ranged barrage repeatedly emits gems, caps at 250 damage, and resets after a round', async ({
  page,
}) => {
  await enter(page);
  await page.evaluate(() => {
    const audit = { count: 0, observer: null as MutationObserver | null };
    audit.observer = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            node.matches('[data-testid="stardust-emerald-projectile"]')
          )
            audit.count++;
        }
    });
    audit.observer.observe(document.querySelector('[data-testid="stardust-arena"]')!, {
      childList: true,
      subtree: true,
    });
    Object.assign(window, { emeraldAudit: audit });
  });
  await page.keyboard.press('KeyU');
  await expect(page.getByTestId('stardust-emerald-projectile')).toHaveCount(3);
  await page.clock.runFor(320);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '500');
  await page.clock.runFor(400);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '487');
  await expect(page.getByTestId('stardust-emerald-projectile')).toHaveCount(3);
  await page.clock.runFor(10500);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '250');
  await expect(page.getByTestId('stardust-emerald-projectile')).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const audit = (
        window as unknown as { emeraldAudit: { count: number; observer: MutationObserver } }
      ).emeraldAudit;
      audit.observer.disconnect();
      return audit.count;
    }),
  ).toBe(60);
  await page.keyboard.press('KeyU');
  await page.clock.runFor(10500);
  await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'round-break');
  await expect(page.getByTestId('stardust-score')).toContainText('P1 1 : 0 P2');
  await expect(page.getByTestId('stardust-emerald-projectile')).toHaveCount(0);
  await page.clock.runFor(1800);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '500');
  await page.clock.runFor(1000);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '500');
});

test('P2 can fire left and guarding reduces remote damage', async ({ page }) => {
  await enter(page);
  await page.keyboard.press('Digit1');
  await expect(page.getByTestId('stardust-emerald-projectile')).toHaveAttribute(
    'data-direction',
    '-1',
  );
  await page.clock.runFor(720);
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-hp', '493');
  await page.clock.runFor(240);
  await page.keyboard.down('Digit3');
  await page.clock.runFor(32);
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(720);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '499');
  await page.keyboard.press('KeyK');
  await page.clock.runFor(720);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '496');
  await page.keyboard.up('Digit3');
});

test('host restart discards in-flight emeralds', async ({ page }) => {
  await enter(page);
  await page.keyboard.press('KeyK');
  await page.clock.runFor(240);
  await expect(page.getByTestId('stardust-emerald-projectile')).toHaveCount(3);
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByTestId('stardust-emerald-projectile')).toHaveCount(0);
  await page.clock.runFor(6500);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '500');
  await expect(page.getByTestId('stardust-score')).toContainText('P1 0 : 0 P2');
});

test('a detached Hierophant fires from its own position without moving its owner', async ({
  page,
}) => {
  await enter(page);
  await page.keyboard.press('KeyF');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(1000);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyJ');
  const projectile = page.getByTestId('stardust-emerald-projectile');
  expect(Number(await projectile.getAttribute('data-world-x'))).toBeGreaterThan(30);
  expect(await x(page, 'p1')).toBe('25%');
  await page.clock.runFor(720);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '493');
  await page.keyboard.down('KeyA');
  await page.clock.runFor(16);
  await page.keyboard.up('KeyA');
  await page.keyboard.press('KeyJ');
  await expect(projectile).toHaveAttribute('data-direction', '-1');
});
