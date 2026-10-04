import { expect, test, type Page } from '@playwright/test';
async function enter(page: Page) {
  await page.clock.install({ time: new Date('2026-09-28T08:00:00Z') });
  await page.goto('/#/games/parkour');
  await expect(page.getByRole('heading', { name: '三分钟送答行动', exact: true })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-09-28T09:00:00Z'));
  await page.getByRole('button', { name: '开始冒险', exact: true }).click();
}
test('adventure preparation fits a narrow screen and practice can return to it', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => {
    localStorage.setItem('moecore:parkour:journey:best:v1:standard', '12345');
    localStorage.setItem('moecore:parkour:journey:best:v1:assisted', '23456');
  });
  await page.goto('/#/games/parkour');
  await expect(page.getByRole('heading', { name: '三分钟送答行动', exact: true })).toBeVisible();
  expect(
    (await page.getByRole('heading', { name: '三分钟送答行动', exact: true }).boundingBox())!
      .height,
  ).toBeLessThan(35);
  await expect
    .poll(() =>
      page.locator('.journey-hero img').evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.journey-records')).toContainText('标准路线最高 12,345 分');
  await expect(page.locator('.journey-records')).toContainText('援助路线最高 23,456 分');
  await page.screenshot({ path: info.outputPath('journey-ready.png'), fullPage: true });
  await page.getByRole('button', { name: '单项练习', exact: true }).click();
  await expect(page.getByRole('region', { name: '开场故事' })).toBeVisible();
  await page.getByRole('button', { name: '返回三分钟冒险', exact: false }).click();
  await expect(page.getByRole('heading', { name: '三分钟送答行动', exact: true })).toBeVisible();
});
async function snapshot(page: Page) {
  return page.locator('.journey').evaluate((root) => {
    const run = root.querySelector<HTMLElement>('.office-world');
    const flight = root.querySelector<HTMLElement>('.flight-world');
    const rhythm = root.querySelector<HTMLElement>('.rhythm-world');
    const d = Number(run?.dataset.distance);
    const player = run?.querySelector<HTMLElement>('.office-player');
    return {
      phase: root.getAttribute('data-phase'),
      stage: Number(root.getAttribute('data-stage')),
      time: Number(root.getAttribute('data-time')),
      score: Number(root.getAttribute('data-score')),
      completed: Number(root.getAttribute('data-completed')),
      run: run
        ? {
            distance: d,
            speed: Number(run.dataset.speed),
            grounded: Number(player?.dataset.y) === 0,
            energy: Number(run.dataset.energy),
            cooldown: Number(run.dataset.cooldown),
            tail: Number(run.dataset.tail),
            answer: run.dataset.answer === 'true',
            dash: Number(run.dataset.dash),
            next: [...run.querySelectorAll<HTMLElement>('.office-obstacle,.office-queue')]
              .map((o) => ({ x: Number(o.dataset.x), kind: o.dataset.kind }))
              .filter((o) => o.x + 1.2 > d)
              .sort((a, b) => a.x - b.x)[0],
            paper: [...run.querySelectorAll<HTMLElement>('.office-paper[data-returned="false"]')]
              .map((p) => Number(p.dataset.x))
              .find((x) => x + 0.45 > d),
            fake: [...run.querySelectorAll<HTMLElement>('.office-hallucination')]
              .map((p) => Number(p.dataset.x))
              .find((x) => x + 0.35 > d),
          }
        : null,
      flight: flight
        ? {
            d: Number(flight.dataset.distance),
            y: Number(flight.dataset.y),
            vy: Number(flight.dataset.vy),
            gates: [...flight.querySelectorAll<HTMLElement>('.flight-gate')].map((g) => ({
              x: Number(g.dataset.x),
              center: Number(g.dataset.center),
            })),
            missiles: [
              ...flight.querySelectorAll<HTMLElement>('.flight-warning,.flight-missile'),
            ].map((m) => ({ x: Number(m.dataset.x), y: Number(m.dataset.y) })),
          }
        : null,
      rhythm: rhythm
        ? {
            elapsed: Number(rhythm.dataset.elapsed),
            note: [...rhythm.querySelectorAll<HTMLElement>('.rhythm-note')].map((n) => ({
              at: Number(n.dataset.at),
              action: n.dataset.action,
            }))[0],
          }
        : null,
    };
  });
}
async function drive(page: Page, stopAtFlight = false, pauseAtHandoff = false) {
  let crouch = false,
    thrust = false,
    paused = false;
  const stages = new Set<number>();
  for (let i = 0; i < 4400; i++) {
    const s = await snapshot(page);
    stages.add(s.stage);
    if (s.phase === 'won' || (stopAtFlight && s.stage === 1 && s.phase === 'playing')) {
      if (crouch) await page.keyboard.up('ArrowDown');
      if (thrust) await page.keyboard.up('Space');
      return { ...s, visited: [...stages] };
    }
    expect(s.phase, `stage ${s.stage} failed`).not.toBe('failed');
    if (!s.flight && thrust) {
      await page.keyboard.up('Space');
      thrust = false;
    }
    if (!s.run && crouch) {
      await page.keyboard.up('ArrowDown');
      crouch = false;
    }
    if (s.phase === 'handoff' && pauseAtHandoff && !paused) {
      paused = true;
      await page.getByRole('button', { name: '暂停', exact: true }).click();
      const before = await snapshot(page);
      await page.clock.runFor(5000);
      expect((await snapshot(page)).time).toBe(before.time);
      expect((await snapshot(page)).phase).toBe('handoff');
      await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    }
    if (s.run) {
      const r = s.run;
      const lead = r.next ? r.next.x - r.distance - 0.6 : Infinity;
      const low = r.next?.kind === 'air' && lead < r.speed * 0.5;
      const duck = low || Boolean(r.paper && r.paper - r.distance < 1 && r.cooldown && !r.tail);
      if (duck !== crouch) {
        if (duck) await page.keyboard.down('ArrowDown');
        else await page.keyboard.up('ArrowDown');
        crouch = duck;
      }
      if (!low && r.next?.kind === 'ground' && r.grounded && lead < r.speed * 0.25)
        await page.keyboard.press('Space');
      if (
        !r.cooldown &&
        !r.dash &&
        ((r.paper !== undefined && r.paper - r.distance < 3.1) ||
          (r.fake !== undefined && r.fake - r.distance < 3.1) ||
          (r.answer && r.energy === 100))
      )
        await page.keyboard.press('KeyX');
    } else if (s.flight) {
      const f = s.flight;
      let target = f.gates.find((g) => g.x > f.d - 1)?.center ?? 5;
      const missile = f.missiles.find((m) => m.x > f.d - 1);
      if (missile && Math.abs(target - missile.y) < 1.4)
        target = Math.max(1, Math.min(9, missile.y + (missile.y > 5 ? -2 : 2)));
      const next = f.y + f.vy * 0.35 < target;
      if (next !== thrust) {
        if (next) await page.keyboard.down('Space');
        else await page.keyboard.up('Space');
        thrust = next;
      }
    } else if (s.rhythm?.note && s.rhythm.elapsed >= s.rhythm.note.at - 18) {
      await page.keyboard.press(
        s.rhythm.note.action === 'jump'
          ? 'Space'
          : s.rhythm.note.action === 'slide'
            ? 'ArrowDown'
            : 'KeyX',
      );
    }
    await page.clock.runFor(50);
  }
  throw new Error('Journey did not complete within the playthrough limit.');
}

test('one continuous three-minute journey hands off all four stages and settles only at the end', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await enter(page);
  const result = await drive(page, false, true);
  expect(result.visited).toEqual([0, 1, 2, 3]);
  expect(result.completed).toBe(4);
  expect(result.time).toBeGreaterThanOrEqual(160000);
  expect(result.time).toBeLessThanOrEqual(195000);
  await info.attach('journey-duration', {
    body: JSON.stringify({ durationMs: result.time, visited: result.visited }),
    contentType: 'application/json',
  });
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('四段交付');
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('检查点重试 0 次');
  const records = await page.evaluate(() => ({
    journey: localStorage.getItem('moecore:parkour:journey:best:v1:standard'),
    runner: localStorage.getItem('moecore:parkour:best-score:v2:0'),
    flight: localStorage.getItem('moecore:parkour:flight:best:v1'),
    rhythm: localStorage.getItem('moecore:parkour:rhythm:best:v1'),
  }));
  expect(Number(records.journey)).toBeGreaterThan(0);
  expect([records.runner, records.flight, records.rhythm]).toEqual([null, null, null]);
  await page.screenshot({ path: info.outputPath('journey-complete.png'), fullPage: true });
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.locator('.journey')).toHaveAttribute('data-stage', '0');
  await expect(page.locator('.journey')).toHaveAttribute('data-completed', '0');
});

test('small-screen adventure keeps the stage and controls visible', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await enter(page);
  await page.clock.runFor(800);
  const world = (await page.locator('.office-world').boundingBox())!;
  const controls = (await page.locator('.whale-controls').boundingBox())!;
  expect(world.y).toBeGreaterThanOrEqual(0);
  expect(controls.y + controls.height).toBeLessThanOrEqual(640);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('journey-320.png'), fullPage: false });
});

test('failure resumes the current checkpoint with visible aid and preserves completed legs', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await enter(page);
  await page.evaluate(() =>
    localStorage.setItem('moecore:parkour:journey:best:v1:standard', '12345'),
  );
  const first = await drive(page, true);
  expect(first.completed).toBe(1);
  await page.clock.runFor(25000);
  await expect(page.getByRole('region', { name: '检查点重试' })).toBeVisible();
  expect((await snapshot(page)).stage).toBe(1);
  expect((await snapshot(page)).completed).toBe(1);
  expect((await snapshot(page)).score).toBe(first.score - 500);
  await expect(page.getByRole('region', { name: '对局结算' })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('journey-checkpoint.png'), fullPage: true });
  await page.getByRole('button', { name: '从检查点重试', exact: true }).click();
  await expect(page.locator('.flight-health')).toHaveAttribute('aria-label', '剩余 4 次体力');
  expect((await snapshot(page)).stage).toBe(1);
  expect((await snapshot(page)).completed).toBe(1);
  const completed = await drive(page);
  expect(completed.phase).toBe('won');
  expect(completed.completed).toBe(4);
  expect(completed.visited).toEqual([1, 2, 3]);
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('援助通关');
  await expect(page.getByRole('region', { name: '对局结算' })).toContainText('检查点重试 1 次');
  const records = await page.evaluate(() => ({
    standard: localStorage.getItem('moecore:parkour:journey:best:v1:standard'),
    assisted: localStorage.getItem('moecore:parkour:journey:best:v1:assisted'),
  }));
  expect(records.standard).toBe('12345');
  expect(Number(records.assisted)).toBe(completed.score);
  await page.screenshot({ path: info.outputPath('journey-assisted-complete.png'), fullPage: true });
});
