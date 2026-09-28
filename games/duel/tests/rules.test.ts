import { describe, expect, it } from 'vitest';
import { advance, createBattle, emptyInput, ROUND_FRAMES } from '../src/rules';
import type { Battle, Command, FighterId, Input } from '../src/rules';
const press = (...commands: Command[]): Input => ({ ...emptyInput(), commands });
function fight(a: FighterId = 'deepseek', d: FighterId = 'gpt') {
  const b = createBattle(a, d);
  b.phase = 'fight';
  b.fighters[0].x = 400;
  b.fighters[1].x = 460;
  return b;
}
function frames(b: Battle, count: number) {
  for (let n = 0; n < count; n++) advance(b, emptyInput(), emptyInput());
}
function readyHit(b: Battle, slot: 0 | 1 = 0, action: 'light1' | 'heavy' | 'super' = 'light1') {
  const f = b.fighters[slot];
  f.action = action;
  f.age =
    action === 'light1'
      ? 6
      : action === 'super'
        ? f.id === 'gpt'
          ? 14
          : 16
        : f.id === 'gpt'
          ? 11
          : f.id === 'deepseek'
            ? 14
            : 16;
  f.serial = b.nextId++;
  f.landed = [];
}
describe('duel combat contract', () => {
  it('requires countdown and resets both fighters at a new round', () => {
    const b = createBattle();
    frames(b, 179);
    expect(b.phase).toBe('countdown');
    frames(b, 1);
    expect(b.phase).toBe('fight');
    expect(b.timer).toBe(ROUND_FRAMES);
    b.timer = 1;
    b.fighters[1].hp = 500;
    frames(b, 1);
    expect(b.scores).toEqual([1, 0]);
    frames(b, 120);
    expect(b.round).toBe(2);
    expect(b.phase).toBe('countdown');
    expect(b.fighters[1].hp).toBe(1000);
    expect(b.fighters[0].energy).toBe(0);
  });
  it('allows two jumps, rejects a third and restores jumps on landing', () => {
    const b = fight();
    advance(b, press('jump'), emptyInput());
    frames(b, 10);
    const old = b.fighters[0].vy;
    advance(b, press('jump'), emptyInput());
    expect(b.fighters[0].vy).toBeGreaterThan(old);
    expect(b.fighters[0].jumps).toBe(2);
    const second = b.fighters[0].vy;
    advance(b, press('jump'), emptyInput());
    expect(b.fighters[0].vy).toBeLessThan(second);
    expect(b.fighters[0].jumps).toBe(2);
    frames(b, 60);
    expect(b.fighters[0].y).toBe(0);
    expect(b.fighters[0].action).toBe('idle');
    expect(b.fighters[0].jumps).toBe(0);
  });
  it('keeps bodies apart and clamps the world bounds', () => {
    const b = fight();
    for (let n = 0; n < 100; n++)
      advance(b, { ...emptyInput(), move: 1 }, { ...emptyInput(), move: -1 });
    expect(Math.abs(b.fighters[0].x - b.fighters[1].x)).toBeGreaterThanOrEqual(48);
    b.fighters[0].x = 49;
    for (let n = 0; n < 100; n++) advance(b, { ...emptyInput(), move: -1 }, emptyInput());
    expect(b.fighters[0].x).toBe(48);
  });
  it('hits once per attack instance even while hitboxes overlap', () => {
    const b = fight();
    readyHit(b);
    frames(b, 1);
    expect(b.fighters[1].hp).toBe(960);
    frames(b, 12);
    expect(b.fighters[1].hp).toBe(960);
  });
  it('blocks normal damage and never kills with skill chip', () => {
    const b = fight('gpt');
    readyHit(b);
    advance(b, emptyInput(), { ...emptyInput(), guard: true });
    expect(b.fighters[1].hp).toBe(1000);
    b.freeze = 0;
    b.fighters[0].action = 'skill';
    b.fighters[0].age = 12;
    b.fighters[0].serial = b.nextId++;
    b.fighters[0].landed = [];
    b.fighters[1].hp = 1;
    advance(b, emptyInput(), { ...emptyInput(), guard: true });
    expect(b.fighters[1].hp).toBe(1);
    expect(b.phase).toBe('fight');
  });
  it('does not charge offense energy for whiffs or blocked punches', () => {
    const b = fight();
    readyHit(b);
    advance(b, emptyInput(), { ...emptyInput(), guard: true });
    expect(b.fighters[0].energy).toBe(0);
    expect(b.fighters[1].energy).toBe(2);
    b.fighters[0].x = 100;
    b.fighters[1].x = 700;
    frames(b, 30);
    advance(b, press('light'), emptyInput());
    frames(b, 30);
    expect(b.fighters[0].energy).toBe(0);
  });
  it('uses hit confirmation to cancel light attacks and scales combo damage', () => {
    const b = fight();
    readyHit(b);
    frames(b, 1);
    advance(b, press('light'), emptyInput());
    frames(b, 4);
    expect(b.fighters[0].action).toBe('light2');
    frames(b, 7);
    expect(b.fighters[1].hp).toBe(922);
    advance(b, press('light'), emptyInput());
    frames(b, 15);
    expect(b.fighters[1].hp).toBe(877);
    expect(b.fighters[0].maxCombo).toBe(3);
  });
  it('does not cancel a whiff into another light', () => {
    const b = fight();
    b.fighters[1].x = 800;
    advance(b, press('light'), emptyInput());
    frames(b, 7);
    advance(b, press('light'), emptyInput());
    expect(b.fighters[0].action).toBe('light1');
    frames(b, 30);
    expect(b.fighters[0].action).toBe('idle');
  });
  it('takes no resource when a skill is cooling or super meter is insufficient', () => {
    const b = fight();
    b.fighters[0].cooldown = 80;
    b.fighters[0].energy = 99;
    advance(b, press('skill', 'super'), emptyInput());
    expect(b.fighters[0].energy).toBe(99);
    expect(b.fighters[0].cooldown).toBe(79);
    expect(b.fighters[0].action).toBe('idle');
  });
  it('parries in the declared window and rejects supers', () => {
    const b = fight('gpt', 'deepseek');
    b.fighters[1].action = 'skill';
    b.fighters[1].age = 8;
    readyHit(b);
    frames(b, 1);
    expect(b.fighters[1].hp).toBe(1000);
    expect(b.fighters[1].action).toBe('counter');
    expect(b.fighters[1].energy).toBe(12);
    const c = fight('gpt', 'deepseek');
    c.fighters[1].action = 'skill';
    c.fighters[1].age = 8;
    readyHit(c, 0, 'super');
    frames(c, 1);
    expect(c.fighters[1].hp).toBe(720);
  });
  it('does not return a distant parried projectile as a guaranteed full-screen hit', () => {
    const b = fight('deepseek', 'doubao');
    b.fighters[1].x = 800;
    b.fighters[0].action = 'skill';
    b.fighters[0].age = 8;
    b.projectiles.push({ id: 99, owner: 1, x: 430, y: 52, direction: -1, life: 50 });
    frames(b, 1);
    expect(b.projectiles).toHaveLength(0);
    expect(b.fighters[0].counters).toBe(1);
    frames(b, 40);
    expect(b.fighters[1].hp).toBe(1000);
  });
  it('allows throws to beat guard and gives the defender a tech window', () => {
    const b = fight();
    advance(b, press('throw'), { ...emptyInput(), guard: true });
    for (let n = 0; n < 7; n++) advance(b, emptyInput(), { ...emptyInput(), guard: true });
    expect(b.grab).not.toBeNull();
    advance(b, emptyInput(), press('throw'));
    expect(b.grab).toBeNull();
    expect(b.fighters[1].hp).toBe(1000);
    expect(Math.abs(b.fighters[0].x - b.fighters[1].x)).toBe(140);
  });
  it('pays throw damage once and does not grab airborne opponents', () => {
    const b = fight();
    advance(b, press('throw'), emptyInput());
    frames(b, 40);
    expect(b.fighters[1].hp).toBe(900);
    expect(b.fighters[0].throws).toBe(1);
    const c = fight();
    advance(c, press('throw'), press('jump'));
    frames(c, 20);
    expect(c.grab).toBeNull();
    expect(c.fighters[1].hp).toBe(1000);
  });
  it('simultaneous throws tech, while a simultaneous strike stops a grab', () => {
    const b = fight();
    advance(b, press('throw'), press('throw'));
    frames(b, 8);
    expect(b.grab).toBeNull();
    expect(b.fighters[0].hp).toBe(1000);
    const c = fight();
    c.fighters[0].action = 'throw';
    c.fighters[0].age = 7;
    readyHit(c, 1);
    frames(c, 1);
    expect(c.grab).toBeNull();
    expect(c.fighters[0].hp).toBe(960);
  });
  it('cancels unpaid throws at timeout', () => {
    const b = fight();
    advance(b, press('throw'), emptyInput());
    frames(b, 7);
    expect(b.grab).not.toBeNull();
    b.timer = 1;
    frames(b, 1);
    expect(b.grab).toBeNull();
    expect(b.roundWinner).toBeNull();
    expect(b.fighters[1].hp).toBe(1000);
  });
  it('resolves simultaneous lethal attacks as a draw independent of order', () => {
    const b = fight();
    b.fighters.forEach((f) => (f.hp = 40));
    readyHit(b);
    readyHit(b, 1);
    frames(b, 1);
    expect(b.fighters.map((f) => f.hp)).toEqual([0, 0]);
    expect(b.roundWinner).toBeNull();
    expect(b.scores).toEqual([0, 0]);
  });
  it('does not revive a lethal rear hit when a front hit is blocked in the same frame', () => {
    const b = fight('doubao', 'gpt');
    b.fighters[1].hp = 100;
    readyHit(b);
    b.fighters[0].serial = 10;
    b.projectiles.push({ id: 1, owner: 0, x: 476, y: 52, direction: -1, life: 50 });
    advance(b, emptyInput(), { ...emptyInput(), guard: true });
    expect(b.fighters[1].hp).toBe(0);
    expect(b.roundWinner).toBe(0);
  });
  it('buffers commands for both fighters during shared hitstop', () => {
    const b = fight();
    b.freeze = 4;
    advance(b, press('heavy'), press('light'));
    frames(b, 4);
    expect(b.fighters[0].action).toBe('heavy');
    expect(b.fighters[1].action).toBe('light1');
  });
  it('counts hits on the final frame before timing out', () => {
    const b = fight();
    b.timer = 1;
    readyHit(b);
    frames(b, 1);
    expect(b.roundWinner).toBe(0);
    expect(b.scores).toEqual([1, 0]);
  });
  it('spends super energy at startup and does not refund whiffs', () => {
    const b = fight();
    b.fighters[0].energy = 100;
    b.fighters[1].x = 850;
    advance(b, press('super'), emptyInput());
    expect(b.fighters[0].energy).toBe(0);
    frames(b, 65);
    expect(b.fighters[1].hp).toBe(1000);
    expect(b.fighters[0].energy).toBe(0);
  });
  it('locks a successful super for 72 frames without ticking the timer or cooldowns', () => {
    const b = fight();
    readyHit(b, 0, 'super');
    b.fighters[0].cooldown = 55;
    frames(b, 1);
    expect(b.phase).toBe('cinematic');
    expect(b.fighters[1].hp).toBe(720);
    const timer = b.timer,
      cooldown = b.fighters[0].cooldown;
    frames(b, 71);
    expect(b.timer).toBe(timer);
    expect(b.fighters[0].cooldown).toBe(cooldown);
    frames(b, 1);
    expect(b.phase).toBe('fight');
  });
  it('resolves super trades without swallowing either hit', () => {
    const b = fight();
    readyHit(b, 0, 'super');
    readyHit(b, 1, 'super');
    frames(b, 1);
    expect(b.fighters.map((f) => f.hp)).toEqual([720, 720]);
    expect(b.phase).toBe('fight');
  });
  it('forces knockdown at the combo cap and protects a downed fighter', () => {
    const b = fight();
    b.fighters[1].combo = 4;
    b.fighters[1].comboDamage = 340;
    readyHit(b);
    frames(b, 1);
    expect(b.fighters[1].hp).toBe(990);
    expect(b.fighters[1].action).toBe('down');
    b.freeze = 0;
    b.fighters[1].x = 460;
    readyHit(b);
    frames(b, 1);
    expect(b.fighters[1].hp).toBe(990);
  });
  it('allows one bubble per owner and opposing bubbles cancel', () => {
    const b = fight('doubao', 'doubao');
    b.fighters[0].x = 200;
    b.fighters[1].x = 700;
    advance(b, press('skill'), press('skill'));
    frames(b, 18);
    expect(b.projectiles).toHaveLength(2);
    frames(b, 40);
    expect(b.projectiles).toHaveLength(0);
    expect(b.fighters.map((f) => f.hp)).toEqual([1000, 1000]);
    b.projectiles.push({ id: 999, owner: 0, x: 200, y: 52, life: 100, direction: 1 });
    b.fighters[0].cooldown = 0;
    b.fighters[0].action = 'idle';
    advance(b, press('skill'), emptyInput());
    expect(b.fighters[0].action).toBe('idle');
  });
  it('ends a three-round match with wins and draws counted correctly', () => {
    const b = fight();
    for (let round = 0; round < 3; round++) {
      if (round > 0) frames(b, 180);
      b.timer = 1;
      if (round === 0) b.fighters[1].hp = 999;
      frames(b, 1);
      frames(b, 120);
    }
    expect(b.phase).toBe('done');
    expect(b.outcome).toBe('win');
    expect(b.scores).toEqual([1, 0]);
  });
  it('runs the seeded bot deterministically to a completed match', () => {
    const a = createBattle('doubao', 'gpt', 42),
      b = createBattle('doubao', 'gpt', 42);
    for (let n = 0; n < 16000 && a.phase !== 'done'; n++) {
      advance(a);
      advance(b);
    }
    expect(a).toEqual(b);
    expect(a.phase).toBe('done');
    expect(a.outcome).toBe('lose');
    expect(a.fighters.every((f) => Number.isFinite(f.x) && f.hp >= 0 && f.energy <= 100)).toBe(
      true,
    );
  });
});
