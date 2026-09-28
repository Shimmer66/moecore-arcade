import { expect, it } from 'vitest';
import { advance, createBattle, emptyInput, type Battle, type Command } from '../src/rules';
const press = (...commands: Command[]) => ({ ...emptyInput(), commands });
function battle(player: 'deepseek' | 'gpt' | 'doubao' = 'deepseek') {
  const b = createBattle(player, 'gpt', 7, { localVersus: true });
  b.phase = 'fight';
  return b;
}
function frames(b: Battle, n: number) {
  for (let i = 0; i < n; i++) advance(b, emptyInput(), emptyInput());
}
it('local versus has no unsolicited CPU movement and independent second player inputs', () => {
  const b = battle();
  for (let i = 0; i < 90; i++) advance(b);
  expect(b.fighters[1].x).toBe(680);
  expect(b.fighters[1].action).toBe('idle');
  advance(b, { ...emptyInput(), move: 1 }, { ...emptyInput(), move: -1 });
  expect(b.fighters[0].x).toBeGreaterThan(280);
  expect(b.fighters[1].x).toBeLessThan(680);
});
it('rice heals only on completing its vulnerable windup, cooldown resets each round', () => {
  const b = battle();
  b.fighters[0].hp = 800;
  advance(b, press('meme'), emptyInput());
  frames(b, 35);
  expect(b.fighters[0].hp).toBe(800);
  frames(b, 1);
  expect(b.fighters[0].hp).toBe(840);
  expect(b.fighters[0].energy).toBe(20);
  frames(b, 15);
  advance(b, press('meme'), emptyInput());
  expect(b.fighters[0].action).not.toBe('meme');
  b.timer = 1;
  frames(b, 1);
  frames(b, 120);
  expect(b.fighters[0].memeCooldown).toBe(0);
});
it('punching an eating DeepSeek spills rice and prevents the reward', () => {
  const b = battle();
  b.fighters[0].hp = 800;
  b.fighters[0].x = 400;
  b.fighters[1].x = 450;
  advance(b, press('meme'), press('light'));
  let spilled = false;
  for (let i = 0; i < 70; i++) {
    advance(b, emptyInput(), emptyInput());
    spilled ||= b.events.some((e) => e.effect === 'rice-spill');
  }
  expect(spilled).toBe(true);
  expect(b.fighters[0].hp).toBe(760);
  expect(b.fighters[0].energy).toBeLessThan(20);
});
it('GPT catches a falling foe, deals 120, and permits timely throw tech', () => {
  for (const tech of [false, true]) {
    const b = battle('gpt');
    b.fighters[0].x = 400;
    b.fighters[1].x = 455;
    advance(b, press('meme'), emptyInput());
    frames(b, 6);
    Object.assign(b.fighters[1], { y: 65, vy: -60, action: 'jump' });
    frames(b, 1);
    expect(b.grab?.catch).toBe(true);
    if (tech) advance(b, emptyInput(), press('throw'));
    frames(b, 30);
    expect(b.fighters[1].hp).toBe(tech ? 1000 : 880);
    expect(b.grab).toBeNull();
  }
});
it('Tangbao projectile returns on a miss and can hit its owner', () => {
  const b = battle('doubao');
  b.fighters[1].x = 900;
  advance(b, press('meme'), emptyInput());
  let returned = false,
    bonk = false;
  for (let i = 0; i < 140; i++) {
    advance(b, emptyInput(), emptyInput());
    returned ||= b.projectiles.some((p) => p.returning);
    bonk ||= b.events.some((e) => e.effect === 'tangbao-return');
  }
  expect(returned).toBe(true);
  expect(bonk).toBe(true);
  expect(b.fighters[0].hp).toBe(950);
  expect(b.fighters[1].hp).toBe(1000);
});
