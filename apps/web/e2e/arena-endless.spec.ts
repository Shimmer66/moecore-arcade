import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../../games/arena/src/campaign';
import { RoomRunner } from '../../../games/arena/src/runner';
import { generateEndlessRoom } from '../../../games/arena/src/endless';

test('plays generated rooms, resumes the next stage and settles an independent score', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('textbox', { name: '生成种子' }).fill('73');
  await page.getByRole('button', { name: '无尽生成', exact: true }).click();
  for (let stage = 0; stage < 4; stage++) {
    const run = new RoomRunner(generateEndlessRoom(73, stage));
    const inputs: { horizontal: number; jump: boolean }[] = [];
    const jumped = new Set<string>();
    let hop = 0;
    for (let tick = 0; tick < 1400 && run.phase === 'playing'; tick++) {
      let horizontal = 1,
        jump = false;
      if (run.rect.x >= 120 && hop < 70) {
        horizontal = 0;
        jump = hop === 0;
        hop++;
      } else
        for (const hazard of run.traps) {
          const gap = hazard.body.x - run.rect.x;
          if (hazard.trap.effect === 'gate' && hazard.phase === 'active' && gap > 32 && gap < 90)
            horizontal = 0;
          if (
            ['pit', 'spikes'].includes(hazard.trap.effect) &&
            gap < 65 &&
            gap > 0 &&
            run.grounded &&
            !jumped.has(hazard.trap.id)
          ) {
            jump = true;
            jumped.add(hazard.trap.id);
          }
          if (hazard.trap.effect === 'saw' && gap < 100 && gap > 0 && run.grounded) jump = true;
        }
      inputs.push({ horizontal, jump });
      run.step(horizontal, jump);
    }
    expect(run.phase, `generated stage ${stage}`).toBe('clear');
    expect(run.secret).toBe(true);
    run.dispose();
    let held = false;
    for (let offset = 0; offset < inputs.length;) {
      const input = inputs[offset]!;
      if (Boolean(input.horizontal) !== held) {
        if (input.horizontal) await page.keyboard.down('KeyD');
        else await page.keyboard.up('KeyD');
        held = Boolean(input.horizontal);
      }
      if (input.jump) await page.keyboard.press('Space');
      let end = offset + 1;
      while (
        end < inputs.length &&
        !inputs[end]!.jump &&
        inputs[end]!.horizontal === input.horizontal
      )
        end++;
      for (let i = 0; i < 30; i++) {
        const actual = Number(await page.locator('.campaign-game').getAttribute('data-tick'));
        if (actual >= end) {
          expect(actual).toBe(end);
          break;
        }
        await page.clock.runFor(Math.max(1, (end - actual) * 16));
      }
      offset = end;
    }
    if (held) await page.keyboard.up('KeyD');
    await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'clear');
    await expect(page.locator('.run-record')).toContainText(`已通过 ${stage + 1} 局`);
    await expect(page.locator('.run-record')).toContainText(`秘密 ${stage + 1}`);
    await page.getByRole('button', { name: '继续生成', exact: true }).click();
  }
  await page.reload();
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await expect(page.locator('.map-heading')).toContainText(`0/${CAMPAIGN.length}`);
  await page.getByRole('button', { name: '继续无尽', exact: true }).click();
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-room', 'endless-73-4');
  await page.getByRole('button', { name: '重试本关', exact: true }).click();
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-room', 'endless-73-4');
  await page.screenshot({ path: info.outputPath('endless-stage.png'), fullPage: true });
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: '结束挑战', exact: true }).click();
  await expect(page.getByText('这次由你停止生成', { exact: true })).toBeVisible();
  await expect(page.getByText(/无尽生成 · 通过 4 局 · 秘密 4/)).toBeVisible();
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-mode', 'endless');
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-room', 'endless-73-0');
});
