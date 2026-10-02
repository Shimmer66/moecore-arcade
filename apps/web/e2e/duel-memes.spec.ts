import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, player: string, opponent: string, practice = true) {
  await page.goto('/#/games/duel');
  await expect(page.getByRole('button', { name: /练招房/ })).toBeVisible();
  await page.clock.install({ time: new Date('2026-09-26T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-26T00:00:01Z'));
  if (practice) await page.getByRole('button', { name: /练招房/ }).click();
  await page.getByRole('button', { name: '选择' + player }).click();
  await page.getByLabel('选择对手').selectOption(opponent);
  await page.getByRole('button', { name: practice ? '开始练招 →' : '开打 →', exact: true }).click();
  await page.clock.runFor(3100);
}
async function decoded(page: Page, selector: string) {
  await expect
    .poll(() =>
      page.locator(selector).evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
}

test('repeated real parries produce a cache replay and load the new art', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await open(page, 'DeepSeek 娘', 'gpt');
  await page.getByLabel('木桩行为').selectOption('repeat-heavy');
  await page.locator('.duel-arena').focus();
  let direction = '';
  let found = false;
  for (let i = 0; i < 1500; i++) {
    if (await page.getByTestId('meme-card-cache-hit').count()) {
      found = true;
      break;
    }
    const a = page.getByTestId('duel-fighter-0'),
      b = page.getByTestId('duel-fighter-1');
    const x = Number(await a.getAttribute('data-x')),
      bx = Number(await b.getAttribute('data-x')),
      distance = Math.abs(x - bx);
    const next = distance > 62 ? (x < bx ? 'KeyD' : 'KeyA') : '';
    if (next !== direction) {
      if (direction) await page.keyboard.up(direction);
      if (next) await page.keyboard.down(next);
      direction = next;
    }
    const ready = await page
      .getByRole('button', { name: '特色技能', exact: true })
      .getAttribute('aria-description');
    if (distance <= 78 && (await b.getAttribute('data-action')) === 'heavy' && ready === '就绪') {
      await page.keyboard.up('KeyL');
      await page.keyboard.press('KeyU');
    } else if (distance <= 78) await page.keyboard.down('KeyL');
    else await page.keyboard.up('KeyL');
    await page.clock.runFor(33);
  }
  if (direction) await page.keyboard.up(direction);
  await page.keyboard.up('KeyL');
  expect(found).toBe(true);
  await expect(page.getByTestId('cache-replay-prop')).toBeVisible();
  await decoded(page, '[data-testid="meme-card-cache-hit"] img');
  await page.screenshot({ path: info.outputPath('cache-hit.png'), fullPage: true });
  await page.getByRole('button', { name: '重置站位', exact: true }).click();
  await expect(page.getByTestId('meme-card-cache-hit')).toHaveCount(0);
});

test('a real Doubao bubble muffles GPT while a failed GPT variant rewinds only its visual echo', async ({
  page,
}, info) => {
  await open(page, '豆包娘', 'gpt');
  await page.keyboard.press('KeyU');
  await page.clock.runFor(1250);
  await expect(page.getByTestId('muffled-mouth-prop')).toBeVisible();
  await decoded(page, '[data-testid="meme-card-gpt-muffled"] img');
  await expect(page.getByTestId('duel-fighter-1')).toHaveAttribute('data-hp', '900');
  await page.screenshot({ path: info.outputPath('gpt-muffled.png'), fullPage: true });
  await page.getByRole('button', { name: '结束练习', exact: true }).click();
  await page.getByRole('button', { name: '换角色', exact: true }).click();
  await page.getByRole('button', { name: '选择GPT 娘' }).click();
  await page.getByLabel('选择对手').selectOption('deepseek');
  await page.getByRole('button', { name: '开始练招 →', exact: true }).click();
  await page.clock.runFor(3100);
  await page.getByLabel('无限能量').uncheck();
  await page.locator('.duel-arena').focus();
  await page.keyboard.press('KeyV');
  await page.clock.runFor(700);
  await expect(page.getByTestId('rollback-ghost')).toBeVisible();
  await decoded(page, '[data-testid="meme-card-gpt-rollback"] img');
  await expect(page.getByTestId('duel-fighter-0')).toHaveAttribute('data-x', '340.0');
  await expect(page.getByTestId('duel-fighter-0')).toHaveAttribute('data-energy', '75');
  await page.screenshot({ path: info.outputPath('gpt-rollback.png'), fullPage: true });
  await page.clock.runFor(1500);
  await expect(page.getByTestId('rollback-ghost')).toHaveCount(0);
  await expect(page.getByTestId('duel-fighter-0')).toHaveAttribute('data-x', '340.0');
});

test('the loser flips their sign while the real round score remains visible', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await open(page, '豆包娘', 'gpt', false);
  for (let i = 0; i < 500; i++) {
    if ((await page.locator('.duel').getAttribute('data-phase')) === 'round-end') break;
    await page.clock.runFor(250);
  }
  await expect(page.getByTestId('sore-loser')).toHaveAttribute('data-loser', 'doubao');
  await decoded(page, '[data-testid="sore-loser"] img');
  await page.clock.runFor(500);
  await expect(page.locator('.duel-loser-placard')).toHaveText('战略性休息');
  await expect(page.locator('.duel-round>p')).toContainText('0 : 1');
  await page.screenshot({ path: info.outputPath('sore-loser.png'), fullPage: true });
  for (let i = 0; i < 30; i++) {
    if (await page.getByRole('region', { name: '对局结算' }).count()) break;
    await page.clock.runFor(5000);
  }
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('战略性休息');
  await expect(page.locator('.story-ending-image')).toHaveAttribute(
    'src',
    /duel_doubao_sore_loser/,
  );
});

test('an unavailable meme picture keeps its native effect and title working', async ({ page }) => {
  await page.route(/\/duel_gpt_muffled[^/]*\.(?:png|webp)$/, (route) => route.abort());
  await open(page, '豆包娘', 'gpt');
  await page.keyboard.press('KeyU');
  await page.clock.runFor(1250);
  await expect(page.getByTestId('meme-card-gpt-muffled')).toContainText('已读已堵');
  await expect(page.getByTestId('muffled-mouth-prop')).toBeVisible();
  await expect(page.getByTestId('meme-card-gpt-muffled').locator('img')).toHaveCount(0);
});
