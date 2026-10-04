import { expect, test, type Page } from '@playwright/test';
import { openRoom, RoomRunner } from '../../../games/arena/src/runner';
import { HIDDEN_ROOM } from '../../../games/arena/src/hidden';
import { move, type RouteDriver } from '../../../games/arena/tests/routes';
import { CAMPAIGN } from '../../../games/arena/src/campaign';

test('warns after landing before collapsing and visibly predicts a jump with moving spikes', async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date('2026-09-29T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-29T00:00:01Z'));
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /一次性回答/ }).click();
  await expect(page.getByTestId('collapse-warning')).toHaveCount(0);
  await replay(
    page,
    new RoomRunner(CAMPAIGN.find((room) => room.id === 'ephemeral-answer')!),
    (r) => {
      move(r, 200);
      move(r, 410, true);
      for (let i = 0; i < 100 && !r.traps.some((view) => view.phase === 'warning'); i++)
        r.step(0, false);
    },
  );
  await expect(page.getByTestId('collapse-warning')).toBeVisible();
  await expect(page.locator('.speech')).toContainText('缓存即将释放');
  await page.screenshot({ path: info.outputPath('land-trigger-warning.png'), fullPage: true });
  await page.clock.runFor(900);
  await expect(page.locator('.deaths')).toContainText('1');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /预测你的下一个落点/ }).click();
  const spike = page.getByTestId('spike-hazard');
  await expect(spike).toHaveAttribute('d', /^M470,/);
  await replay(
    page,
    new RoomRunner(CAMPAIGN.find((room) => room.id === 'landing-prediction')!),
    (r) => move(r, 330),
  );
  await page.keyboard.press('Space');
  await page.clock.runFor(500);
  await expect(spike).toHaveAttribute('d', /^M590,/);
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'playing');
});

test('announces the current gravity change even while an earlier fake exit remains active', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /突破能力上限/ }).click();
  await page.clock.runFor(20);
  await expect(page.locator('.speech')).toContainText('落地后也不要急着相信');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(750);
  await page.keyboard.up('KeyD');
  await expect(page.locator('.speech')).toContainText('继续向上');
  await expect(page.getByTestId('campaign-player')).toHaveAttribute('transform', /,-1\)/);
});

test('shows a poisoned collectible warning and a moving homing projectile', async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /这条引用有毒/ }).click();
  await expect(page.getByTestId('poison-token').locator('text')).toHaveAttribute('fill', '#9072b4');
  await page.keyboard.down('KeyD');
  await page.clock.runFor(900);
  await page.keyboard.up('KeyD');
  await expect(page.getByTestId('poison-token').locator('text')).toHaveAttribute('fill', '#ff536c');
  await page.clock.runFor(500);
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-phase', 'dead');
  await expect(page.locator('.speech')).toContainText('爆炸');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /它还在追问/ }).click();
  await page.keyboard.down('KeyD');
  await page.clock.runFor(1500);
  await page.keyboard.up('KeyD');
  const seeker = page.getByTestId('seeker');
  const before = await seeker.getAttribute('transform');
  await page.clock.runFor(200);
  expect(await seeker.getAttribute('transform')).not.toBe(before);
  await page.screenshot({ path: info.outputPath('homing-projectile.png'), fullPage: true });
});

async function replay(page: Page, run: RoomRunner, route: (driver: RouteDriver) => void) {
  const inputs: { horizontal: number; jump: boolean }[] = [];
  route({
    get rect() {
      return run.rect;
    },
    get phase() {
      return run.phase;
    },
    get traps() {
      return run.traps;
    },
    get grounded() {
      return run.grounded;
    },
    step(horizontal, jump) {
      if (run.phase !== 'playing') return;
      inputs.push({ horizontal, jump });
      run.step(horizontal, jump);
    },
  });
  run.dispose();
  let held = '';
  for (let offset = 0; offset < inputs.length;) {
    const input = inputs[offset]!;
    const key = input.horizontal > 0 ? 'KeyD' : input.horizontal < 0 ? 'KeyA' : '';
    if (key !== held) {
      if (held) await page.keyboard.up(held);
      if (key) await page.keyboard.down(key);
      held = key;
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
  if (held) await page.keyboard.up(held);
}
function wait(driver: RouteDriver, n: number) {
  for (let i = 0; i < n; i++) driver.step(0, false);
}

test('discovers all keys through play, restores them and finishes the clone protocol', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.clock.install({ time: new Date('2026-09-28T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-28T00:00:01Z'));
  await page.goto('/#/games/arena');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await expect(page.getByRole('button', { name: '进入隐藏协议', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /来源：我自己/ }).click();
  await replay(page, openRoom(0), (r) => {
    move(r, 250);
    move(r, 480, true);
    wait(r, 60);
    r.step(0, true);
    wait(r, 65);
    move(r, 350);
    wait(r, 90);
  });
  await expect(page.locator('.speech')).toContainText('回溯密钥');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /向上发展/ }).click();
  await replay(page, openRoom(10), (r) => {
    move(r, 200);
    move(r, 0);
    wait(r, 100);
  });
  await expect(page.locator('.speech')).toContainText('越界密钥');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await page.getByRole('button', { name: /这个链接绝对能用/ }).click();
  await replay(page, openRoom(16), (r) => {
    move(r, 410);
    move(r, 485, true);
    wait(r, 90);
  });
  await expect(page.locator('.speech')).toContainText('置信密钥');
  await page.reload();
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  await expect(page.locator('.hidden-menu')).toContainText('3/3 密钥');
  await page.getByRole('button', { name: '进入隐藏协议', exact: true }).click();
  await expect(page.getByTestId('controlled-clone')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('hidden-clones.png'), fullPage: true });
  const finishProtocol = (r: RouteDriver) => {
    move(r, 230);
    move(r, 480, true);
    wait(r, 60);
    r.step(0, true);
    wait(r, 65);
    move(r, 650);
    for (let i = 0; i < 300; i++) {
      if (r.traps.find((view) => view.trap.id === 'consensus-gate')?.phase === 'spent') break;
      r.step(0, false);
    }
    move(r, 950);
  };
  await replay(page, new RoomRunner(HIDDEN_ROOM), finishProtocol);
  await expect(page.getByText('全部副本已抵达', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '确认隐藏协议', exact: true }).click();
  await expect(page.getByText('她没有写进回答的那一页', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.campaign-game')).toHaveAttribute('data-mode', 'hidden');
  await expect(page.getByTestId('controlled-clone')).toHaveCount(1);
  await replay(page, new RoomRunner(HIDDEN_ROOM), finishProtocol);
  await page.getByRole('button', { name: '确认隐藏协议', exact: true }).click();
  await page.getByRole('button', { name: '重返关卡地图', exact: true }).click();
  await expect(page.getByText('已完成隐藏结局', { exact: true })).toBeVisible();
});
