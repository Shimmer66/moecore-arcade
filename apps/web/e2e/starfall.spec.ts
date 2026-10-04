import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/#/games/starfall');
  await expect(page.locator('.starfall')).toBeVisible();
  await expect(page.locator('.starfall')).toHaveAttribute('data-phase', 'fight', {
    timeout: 4_000,
  });
}

test('supports local movement, attacks, guarding, and restart', async ({ page }) => {
  await enter(page);
  const p1 = page.getByTestId('starfall-fighter-0');
  const p2 = page.getByTestId('starfall-fighter-1');
  const start = Number(
    await p1.getAttribute('style').then((value) => value?.match(/left: ([\d.]+)/)?.[1]),
  );
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');
  const moved = Number(
    await p1.getAttribute('style').then((value) => value?.match(/left: ([\d.]+)/)?.[1]),
  );
  expect(moved).toBeGreaterThan(start);

  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(async () => {
      const left = Number(await p1.getAttribute('data-x'));
      const right = Number(await p2.getAttribute('data-x'));
      return right - left;
    })
    .toBeLessThan(84);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('KeyF');
  await expect.poll(async () => Number(await p2.getAttribute('data-hp'))).toBeLessThan(1000);

  await page.keyboard.down('ArrowDown');
  const guardedHp = Number(await p2.getAttribute('data-hp'));
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowDown');
  expect(guardedHp - Number(await p2.getAttribute('data-hp'))).toBeLessThan(40);

  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByTestId('starfall-fighter-0')).toHaveAttribute('data-hp', '1000');
});

test('renders without overflow at a narrow desktop viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await enter(page);
  await expect(page.getByText('P1 琥珀')).toBeVisible();
  await expect(page.getByText('P2 靛青')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('starfall-narrow.png'), fullPage: true });
});
