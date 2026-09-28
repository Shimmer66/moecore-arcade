import { expect, it } from 'vitest';
import { advance, createBattle, emptyInput, type Battle, type Command } from '../src/rules';
import { moveFor } from '../src/moves';
const press = (...commands: Command[]) => ({ ...emptyInput(), commands });
function setup(
  p: 'deepseek' | 'gpt' | 'doubao' = 'deepseek',
  q: 'deepseek' | 'gpt' | 'doubao' = 'gpt',
) {
  const b = createBattle(p, q, 12, { localVersus: true });
  b.phase = 'fight';
  b.fighters[0].x = 400;
  b.fighters[1].x = 455;
  return b;
}
function frames(b: Battle, n: number) {
  for (let i = 0; i < n; i++) advance(b, emptyInput(), emptyInput());
}
it('throw steals rice without throw damage and only its current holder can eat the reward', () => {
  const b = setup();
  b.fighters.forEach((f) => (f.hp = 800));
  advance(b, press('meme'), press('throw'));
  frames(b, 8);
  expect(b.rice?.holder).toBe(1);
  expect(b.fighters[0].hp).toBe(800);
  expect(b.grab).toBeNull();
  advance(b, emptyInput(), press('meme'));
  expect(b.fighters[1].action).toBe('eat');
  frames(b, 40);
  expect(b.fighters[1].hp).toBe(840);
  expect(b.fighters[1].energy).toBe(20);
  expect(b.fighters[0].hp).toBe(800);
  expect(b.rice).toBeNull();
});
it('the original owner reclaims stolen rice by landing a strike, then can eat despite cooldown', () => {
  const b = setup();
  b.fighters[0].hp = 800;
  advance(b, press('meme'), press('throw'));
  frames(b, 22);
  advance(b, press('light'), emptyInput());
  let reclaimed = false;
  for (let i = 0; i < 30; i++) {
    advance(b, emptyInput(), emptyInput());
    reclaimed ||= b.events.some((e) => e.effect === 'rice-reclaimed');
  }
  expect(reclaimed).toBe(true);
  expect(b.rice?.holder).toBe(0);
  expect(b.fighters[0].memeCooldown).toBeGreaterThan(0);
  advance(b, press('meme'), emptyInput());
  frames(b, 40);
  expect(b.fighters[0].hp).toBe(840);
  expect(b.rice).toBeNull();
});
it('rice expires and is removed at round end instead of leaking into a replay', () => {
  const b = setup();
  b.rice = { owner: 0, holder: 1, life: 1 };
  frames(b, 1);
  expect(b.rice).toBeNull();
  b.rice = { owner: 0, holder: 1, life: 300 };
  b.timer = 1;
  frames(b, 1);
  expect(b.rice).toBeNull();
});
it('heavy attacks reflect a bubble with ownership and lifetime preserved; sender takes the returned hit', () => {
  const b = setup('doubao');
  b.fighters[0].x = 200;
  b.fighters[1].x = 500;
  b.projectiles.push({ id: 1000, owner: 0, x: 445, y: 52, direction: 1, life: 100 });
  const g = b.fighters[1];
  g.action = 'heavy';
  g.age = moveFor(g.id, 'heavy')!.strikes[0]!.start;
  frames(b, 1);
  expect(b.projectiles[0]?.owner).toBe(1);
  expect(b.projectiles[0]?.originalOwner).toBe(0);
  expect(b.projectiles[0]?.direction).toBe(-1);
  expect(b.projectiles[0]?.life).toBe(99);
  let delivered = false;
  for (let i = 0; i < 65; i++) {
    advance(b, emptyInput(), emptyInput());
    delivered ||= b.events.some((e) => e.effect === 'parcel-delivered');
  }
  expect(delivered).toBe(true);
  expect(b.fighters[0].hp).toBe(900);
  expect(b.fighters[1].damage).toBe(100);
});
it('a returning boomerang can be hit away and its damage does not grow on reflection', () => {
  const b = setup('doubao');
  b.fighters[1].x = 900;
  const a = b.fighters[0];
  a.action = 'heavy';
  a.age = 16;
  b.projectiles.push({
    id: 99,
    owner: 1,
    x: 455,
    y: 52,
    direction: 1,
    life: 60,
    boomerang: true,
    returning: true,
  });
  frames(b, 1);
  expect(b.projectiles[0]?.owner).toBe(0);
  expect(b.projectiles[0]?.damage).toBe(80);
  expect(b.projectiles[0]?.boomerang).toBe(false);
});
it('catching a rice carrier or meeting another bubble overloads GPT without unpaid grab damage', () => {
  for (const rice of [true, false]) {
    const b = setup('gpt', 'deepseek');
    advance(b, press('meme'), emptyInput());
    frames(b, 6);
    Object.assign(b.fighters[1], { action: 'jump', y: 65, vy: -60 });
    if (rice) b.rice = { owner: 1, holder: 1, life: 300 };
    else b.projectiles.push({ id: 88, owner: 1, x: 420, y: 52, direction: -1, life: 30 });
    frames(b, 1);
    expect(b.grab).toBeNull();
    expect(b.rice).toBeNull();
    expect(b.fighters.map((f) => f.action)).toEqual(['down', 'down']);
    expect(b.fighters.map((f) => f.hp)).toEqual([1000, 1000]);
    expect(b.events.some((e) => e.effect === 'catch-overload')).toBe(true);
  }
});
