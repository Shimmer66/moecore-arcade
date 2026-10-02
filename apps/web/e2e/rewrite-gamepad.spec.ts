import { expect, test, type Page } from '@playwright/test';

interface PadState {
  axes?: number[];
  buttons?: number[];
}

async function setPad(page: Page, index: number, state: PadState) {
  await page.evaluate(
    ({ index, axes, buttons }) => {
      const pads = (window as unknown as { __rewritePads: Gamepad[] }).__rewritePads;
      const pad = pads[index] as unknown as {
        axes: number[];
        buttons: { pressed: boolean; touched: boolean; value: number }[];
      };
      pad.axes.splice(0, pad.axes.length, ...(axes ?? [0, 0, 0, 0]));
      pad.buttons.forEach((button, buttonIndex) => {
        const pressed = (buttons ?? []).includes(buttonIndex);
        button.pressed = pressed;
        button.touched = pressed;
        button.value = pressed ? 1 : 0;
      });
    },
    { index, axes: state.axes, buttons: state.buttons },
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const makePad = (index: number) =>
      ({
        id: `Test Standard Gamepad ${index + 1}`,
        index,
        connected: true,
        mapping: 'standard',
        timestamp: 0,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({
          pressed: false,
          touched: false,
          value: 0,
        })),
        vibrationActuator: null,
        hapticActuators: [],
      }) as unknown as Gamepad;
    const pads = [makePad(0), makePad(1)];
    (window as unknown as { __rewritePads: Gamepad[] }).__rewritePads = pads;
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => pads,
    });
  });
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') });
  await page.goto('/#/games/rewrite');
  await expect(page.getByRole('button', { name: /DeepSeek 娘/ })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-10-01T09:00:00Z'));
});

test('standard gamepad movement, fire, jump and grenade use correct hold semantics', async ({
  page,
}) => {
  await page.getByRole('button', { name: /GPT 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await setPad(page, 0, { axes: [1, 0, 0, 0], buttons: [2] });
  await page.clock.runFor(200);
  expect(Number(await world.getAttribute('data-x'))).toBeGreaterThan(3);
  expect(
    Number(
      await page.getByTestId('rewrite-player').locator('.actor-sprite').getAttribute('data-recoil'),
    ),
  ).toBeGreaterThan(0);
  await setPad(page, 0, { buttons: [0] });
  await page.clock.runFor(100);
  expect(Number(await world.getAttribute('data-y'))).toBeGreaterThan(0);
  await page.clock.runFor(1000);
  await expect(world).toHaveAttribute('data-grounded', 'true');
  await page.clock.runFor(200);
  await expect(world).toHaveAttribute('data-y', '0.00');
  await setPad(page, 0, { buttons: [1] });
  await page.clock.runFor(50);
  await expect(world).toHaveAttribute('data-grenades', '2');
  await page.clock.runFor(700);
  await expect(world).toHaveAttribute('data-grenades', '2');
  await setPad(page, 0, { buttons: [] });
  await page.clock.runFor(20);
  await setPad(page, 0, { buttons: [1] });
  await page.clock.runFor(50);
  await expect(world).toHaveAttribute('data-grenades', '1');
});

test('pause consumes edge presses without replaying them after resume', async ({ page }) => {
  await page.getByRole('button', { name: /Claude 娘/ }).click();
  const world = page.locator('.rewrite-world');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await setPad(page, 0, { buttons: [0, 1] });
  await page.clock.runFor(200);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(150);
  await expect(world).toHaveAttribute('data-y', '0.00');
  await expect(world).toHaveAttribute('data-grenades', '3');
  await setPad(page, 0, { buttons: [] });
  await page.clock.runFor(20);
  await setPad(page, 0, { buttons: [0] });
  await page.clock.runFor(80);
  expect(Number(await world.getAttribute('data-y'))).toBeGreaterThan(0);
});

test('two standard gamepads remain independent in co-op', async ({ page }) => {
  await page.getByRole('button', { name: '双人协作', exact: true }).click();
  await page.getByRole('button', { name: /DeepSeek 娘/ }).click();
  const p1 = page.getByTestId('rewrite-player');
  const p2 = page.getByTestId('rewrite-partner');
  const p1Start = Number(await p1.getAttribute('data-x'));
  const p2Start = Number(await p2.getAttribute('data-x'));
  await setPad(page, 0, { axes: [1, 0, 0, 0] });
  await setPad(page, 1, { axes: [-1, 0, 0, 0], buttons: [2] });
  await page.clock.runFor(200);
  expect(Number(await p1.getAttribute('data-x'))).toBeGreaterThan(p1Start);
  expect(Number(await p2.getAttribute('data-x'))).toBeLessThan(p2Start);
  expect(Number(await p2.locator('.actor-sprite').getAttribute('data-recoil'))).toBeGreaterThan(0);
});
