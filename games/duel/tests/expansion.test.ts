import { describe, expect, it } from 'vitest';
import { advance, createBattle, emptyInput } from '../src/rules';
import type { Battle, Command, FighterId, Input } from '../src/rules';
import { campaignBattle, createCampaign, settleStage, takeUpgrade } from '../src/modes';
const press = (...commands: Command[]): Input => ({ ...emptyInput(), commands });
function fight(id: FighterId = 'deepseek') {
  const b = createBattle(id, 'gpt');
  b.phase = 'fight';
  b.fighters[0].x = 400;
  b.fighters[1].x = 455;
  return b;
}
function frames(b: Battle, n: number) {
  for (let i = 0; i < n; i++) advance(b, emptyInput(), emptyInput());
}

describe('expanded combat choices', () => {
  it('requires 25 meter and a separate cooldown for variants', () => {
    const b = fight();
    b.fighters[0].energy = 24;
    advance(b, press('variant'), emptyInput());
    expect(b.fighters[0].action).toBe('idle');
    b.fighters[0].energy = 25;
    advance(b, press('variant'), emptyInput());
    expect(b.fighters[0].energy).toBe(0);
    expect(b.fighters[0].variantCooldown).toBe(300);
    expect(b.fighters[0].cooldown).toBe(0);
    frames(b, 45);
    b.fighters[0].energy = 100;
    advance(b, press('variant'), emptyInput());
    expect(b.fighters[0].action).not.toBe('variant');
    expect(b.fighters[0].energy).toBe(100);
  });
  it('DeepSeek retreats and strikes at her original position, not at the retreat position', () => {
    const b = fight();
    b.fighters[0].energy = 25;
    b.fighters[1].x = 510;
    advance(b, press('variant'), emptyInput());
    frames(b, 15);
    expect(b.fighters[0].x).toBe(320);
    expect(b.fighters[1].hp).toBe(905);
    expect(b.fighters[0].variantHits).toBe(1);
  });
  it('GPT can confirm a variant into a light, with combo scaling preserved', () => {
    const b = fight('gpt');
    b.fighters[0].energy = 25;
    advance(b, press('variant'), emptyInput());
    frames(b, 8);
    expect(b.fighters[1].hp).toBe(925);
    advance(b, press('light'), emptyInput());
    frames(b, 13);
    expect(b.fighters[0].maxCombo).toBeGreaterThanOrEqual(2);
    expect(b.fighters[1].hp).toBe(891);
  });
  it('Doubao rising variant hits nearby grounded targets and returns to the floor', () => {
    const b = fight('doubao');
    b.fighters[0].energy = 25;
    advance(b, press('variant'), emptyInput());
    frames(b, 12);
    expect(b.fighters[0].y).toBeGreaterThan(0);
    expect(b.fighters[1].hp).toBe(890);
    frames(b, 80);
    expect(b.fighters[0].y).toBe(0);
    expect(b.fighters[0].action).toBe('idle');
  });
  it('burst costs 50, breaks a combo, clears hostile bubbles and is limited to once per round', () => {
    const b = fight();
    const f = b.fighters[0];
    f.action = 'hurt';
    f.stun = 20;
    f.energy = 75;
    f.combo = 3;
    f.comboDamage = 150;
    b.projectiles.push({ id: 999, owner: 1, x: 600, y: 52, life: 60, direction: -1 });
    advance(b, press('burst'), emptyInput());
    expect(f.energy).toBe(25);
    expect(f.burstUsed).toBe(true);
    expect(f.combo).toBe(0);
    expect(f.invulnerable).toBe(12);
    expect(b.projectiles).toHaveLength(0);
    expect(Math.abs(f.x - b.fighters[1].x)).toBeGreaterThanOrEqual(180);
    f.action = 'hurt';
    f.stun = 20;
    f.energy = 100;
    advance(b, press('burst'), emptyInput());
    expect(f.energy).toBe(100);
    expect(f.bursts).toBe(1);
  });
  it('cannot burst from neutral, knockdown or a grab', () => {
    for (const action of ['idle', 'down', 'grabbed'] as const) {
      const b = fight();
      b.fighters[0].action = action;
      b.fighters[0].stun = 30;
      b.fighters[0].energy = 100;
      advance(b, press('burst'), emptyInput());
      expect(b.fighters[0].energy).toBe(100);
      expect(b.fighters[0].burstUsed).toBe(false);
    }
  });
  it('does not change damage or health between difficulty settings', () => {
    const easy = createBattle('gpt', 'doubao', 42, { difficulty: 'easy' }),
      hard = createBattle('gpt', 'doubao', 42, { difficulty: 'hard' });
    expect(easy.fighters.map((f) => f.hp)).toEqual(hard.fighters.map((f) => f.hp));
    expect(easy.brain.history.length).toBeGreaterThan(hard.brain.history.length);
  });
});

describe('practice and campaign', () => {
  it('practice has infinite time, configurable meter and a standing/blocking dummy', () => {
    const b = createBattle('gpt', 'doubao', 1, { practice: true, infiniteEnergy: true });
    b.phase = 'fight';
    const timer = b.timer;
    for (let i = 0; i < 100; i++) advance(b);
    expect(b.timer).toBe(timer);
    expect(b.fighters[1].x).toBe(680);
    expect(b.fighters[0].energy).toBe(500);
    b.options.dummy = 'guard';
    advance(b);
    expect(b.fighters[1].action).toBe('guard');
    b.options.infiniteEnergy = false;
    b.fighters[0].energy = 20;
    advance(b);
    expect(b.fighters[0].energy).toBe(20);
  });
  it('a knocked-out dummy respawns without awarding a match or erasing progress', () => {
    const b = createBattle('gpt', 'doubao', 1, { practice: true, infiniteEnergy: true });
    b.phase = 'fight';
    b.fighters[0].maxCombo = 3;
    b.fighters[0].variantHits = 1;
    b.fighters[1].hp = 0;
    advance(b);
    frames(b, 60);
    expect(b.phase).toBe('fight');
    expect(b.fighters[1].hp).toBe(1000);
    expect(b.scores).toEqual([0, 0]);
    expect(b.fighters[0].maxCombo).toBe(3);
    expect(b.fighters[0].variantHits).toBe(1);
    expect(b.outcome).toBeNull();
  });
  it('requires a win before choosing upgrades and carries each unique perk to the next station', () => {
    const c = createCampaign('deepseek', 'easy', 42);
    expect(takeUpgrade(c, 'battery')).toBe(false);
    const b = campaignBattle(c);
    expect(b.timer).toBe(3600);
    expect(b.options.roundLimit).toBe(1);
    b.phase = 'done';
    b.outcome = 'win';
    b.elapsed = 100;
    b.fighters[0].damage = 900;
    settleStage(c, b);
    settleStage(c, b);
    expect(c.wins).toBe(1);
    expect(c.damage).toBe(900);
    expect(takeUpgrade(c, 'battery')).toBe(true);
    const second = campaignBattle(c);
    expect(second.fighters[0].energy).toBe(25);
    expect(second.fighters[0].hp).toBe(1000);
    expect(takeUpgrade(c, 'cooling')).toBe(false);
    second.phase = 'done';
    second.outcome = 'win';
    settleStage(c, second);
    expect(takeUpgrade(c, 'battery')).toBe(false);
    expect(takeUpgrade(c, 'cooling')).toBe(true);
    const final = campaignBattle(c);
    expect(final.fighters[1].id).toBe('deepseek');
    expect(final.fighters[1].energy).toBe(25);
    final.phase = 'fight';
    advance(final, press('skill'), emptyInput());
    expect(final.fighters[0].cooldown).toBe(144);
    final.phase = 'done';
    final.outcome = 'win';
    settleStage(c, final);
    expect(c.phase).toBe('complete');
    expect(c.wins).toBe(3);
    expect(takeUpgrade(c, 'lightfoot')).toBe(false);
  });
  it('a loss or draw ends the run and cannot advance or receive perks', () => {
    for (const outcome of ['lose', 'draw'] as const) {
      const c = createCampaign('gpt', 'normal', 5),
        b = campaignBattle(c);
      b.phase = 'done';
      b.outcome = outcome;
      settleStage(c, b);
      expect(c.phase).toBe('lost');
      expect(takeUpgrade(c, 'battery')).toBe(false);
      expect(c.stage).toBe(0);
    }
  });
  it('movement and cooling perks affect only the player and never leak into a new quick match', () => {
    const b = createBattle('gpt', 'gpt', 1, { playerPerks: ['lightfoot', 'cooling'] });
    b.phase = 'fight';
    advance(b, { ...emptyInput(), move: 1 }, { ...emptyInput(), move: -1 });
    expect(b.fighters[0].x - 280).toBeCloseTo(5.04);
    expect(680 - b.fighters[1].x).toBeCloseTo(4.5);
    advance(b, press('skill'), press('skill'));
    expect(b.fighters[0].cooldown).toBe(192);
    expect(b.fighters[1].cooldown).toBe(240);
    expect(createBattle().options.playerPerks).toEqual([]);
  });
});
