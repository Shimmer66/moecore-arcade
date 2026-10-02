import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
interface Replay {
  schema: number;
  difficulty: 'normal' | 'classic' | 'hard';
  duo: boolean;
  expectation: { ticks: number; deaths: number; continuesRemaining: number; levels: number };
  tape: [number, number, number][];
}
const p1Keys = [
  'KeyA',
  'KeyD',
  'KeyW',
  'KeyS',
  'KeyJ',
  'KeyK',
  'KeyL',
  'ShiftLeft',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
];
const p2Keys = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Comma',
  'Period',
  'Slash',
  'ShiftRight',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',
];
function keys(mask: number, mapping: string[]) {
  return mapping.filter((_, i) => !!(mask & (1 << i)));
}

async function playReplay(page: Page, replay: Replay, onStage: (stage: number) => Promise<void>) {
  const world = page.locator('.rewrite-world');
  const held = new Set<string>();
  let targetTick = 0,
    stage = 1;
  async function setKeys(next: string[]) {
    const removed = [...held].filter((key) => !next.includes(key));
    await Promise.all(removed.map((key) => page.keyboard.up(key)));
    removed.forEach((key) => held.delete(key));
    const added = next.filter((key) => !held.has(key));
    await Promise.all(added.map((key) => page.keyboard.down(key)));
    added.forEach((key) => held.add(key));
  }
  for (const [count, a, b] of replay.tape) {
    if (a < 0) {
      await setKeys([]);
      if (a === -1) {
        await expect(page.getByRole('dialog', { name: '关卡完成' })).toBeVisible();
        await onStage(stage);
        await page.getByRole('button', { name: new RegExp(`进入第 ${stage + 1} 关`) }).click();
        stage++;
        await expect(world).toHaveAttribute('data-stage', String(stage));
      } else if (a === -2) {
        await page.getByRole('button', { name: /续关 · 重新连接/ }).click();
      } else {
        await page
          .getByRole('button', { name: `为 P${a === -3 ? 1 : 2} 分出一命`, exact: true })
          .click();
      }
      continue;
    }
    await setKeys([...keys(a, p1Keys), ...(replay.duo ? keys(b, p2Keys) : [])]);
    targetTick += count;
    let current = targetTick - count;
    while (current < targetTick) {
      const remaining = targetTick - current;
      // The installed Playwright clock schedules RAF on 16 ms boundaries. One
      // final RAF advances at most one 60 Hz physics tick; no game state is set.
      await page.clock.runFor(remaining > 1 ? Math.floor(((remaining - 1) * 1000) / 60) : 16);
      const { tick: next, phase } = await world.evaluate((el) => ({
        tick: Number(el.getAttribute('data-tick')),
        phase: el.getAttribute('data-phase'),
      }));
      if (next > targetTick)
        throw Error(`Clock overshot at stage ${stage}: ${next} > ${targetTick}`);
      if (next < targetTick && phase !== 'running')
        throw Error(
          `Replay diverged at stage ${stage}, tick ${next}/${targetTick}, phase ${phase}`,
        );
      current = next;
    }
  }
  await setKeys([]);
  expect(targetTick).toBe(replay.expectation.ticks);
}

for (const difficulty of ['normal', 'classic', 'hard'] as const)
  for (const duo of [false, true]) {
    const name = `${difficulty}-${duo ? 'duo' : 'solo'}`;
    test(`full campaign ${name} reaches the host ending through keyboard inputs`, async ({
      page,
    }, info) => {
      test.setTimeout(600000);
      const replay = JSON.parse(
        readFileSync(
          new URL(`../../../games/rewrite/tests/replays/${name}.json`, import.meta.url),
          'utf8',
        ),
      ) as Replay;
      expect(replay.schema).toBe(2);
      await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
      await page.goto('/#/games/rewrite');
      await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
      await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
      await page.getByRole('button', { name: '声音 开', exact: true }).click();
      if (difficulty === 'classic') await page.getByRole('button', { name: /经典/ }).click();
      if (difficulty === 'hard') await page.getByRole('button', { name: /硬核/ }).click();
      if (duo) {
        await page.getByRole('button', { name: '双人协作', exact: true }).click();
        await page.getByLabel('P2 角色', { exact: true }).selectOption('deepseek');
      }
      await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
      await playReplay(page, replay, async (stage) => {
        console.log(`${info.project.name} ${name}: cleared ${stage}/8`);
        await page.screenshot({
          path: info.outputPath(`stage-${stage}-clear.png`),
          fullPage: true,
        });
      });
      const ending = page.getByRole('region', { name: '对局结算' });
      await expect(ending).toBeVisible();
      await expect(ending.getByRole('heading', { name: '最终生成：一个真实的结局' })).toBeVisible();
      await expect(ending).toContainText(
        `八关通关 · ${duo ? '双人协作' : '单人'} · ${
          difficulty === 'hard' ? '硬核' : difficulty === 'classic' ? '经典' : '街机'
        }`,
      );
      await page.screenshot({ path: info.outputPath('campaign-ending.png'), fullPage: true });
      if (duo) {
        await ending.getByRole('button', { name: '重新选角', exact: true }).click();
        await expect(page.getByRole('button', { name: '双人协作', exact: true })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
      } else await ending.locator('button.primary-button').click();
      await expect(page.locator('.rewrite-world')).toHaveAttribute('data-stage', '1');
      await expect(page.locator('.rewrite-world')).toHaveAttribute('data-tick', '0');
      await expect(page.locator('.rewrite-world')).toHaveAttribute('data-players', duo ? '2' : '1');
      await expect(
        page.getByRole('button', { name: duo ? 'P1 射击' : '射击', exact: true }),
      ).toBeEnabled();
    });
  }
