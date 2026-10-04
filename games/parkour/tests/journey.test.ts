import { expect, it } from 'vitest';
import type { GameResult } from '@moecore/game-sdk';
import { advanceAdventure, type Adventure } from '../src/rules/adventure';
import { advanceFlight, beginFlight, flightGates } from '../src/rules/flight';
import { advanceRhythm, beginRhythm, rhythmChart, RHYTHM_END_MS } from '../src/rules/rhythm';
import {
  beginJourney,
  continueJourney,
  finishJourneyStage,
  journeyScore,
  journeyStages,
  beginMissionAdventure,
  HANDOFF_MS,
} from '../src/rules/journey';
const result = (win = true, score = 1000, durationMs = 1000): GameResult => ({
  gameId: 'parkour',
  sessionId: 'test',
  outcome: win ? 'win' : 'lose',
  durationMs,
  summary: 'test',
  stats: { score },
});
function runnerInput(s: Adventure) {
  const d = s.run.distance;
  const next = [...s.run.obstacles, ...s.queues.map((q) => ({ ...q, kind: 'ground' }))]
    .filter((o) => o.x + 1.2 > d)
    .sort((a, b) => a.x - b.x)[0];
  const lead = next ? next.x - d - 0.6 : Infinity;
  const low = next?.kind === 'air' && lead < s.run.speed * 0.5;
  const paper = s.papers.find((p) => !p.returned && p.x + 0.45 > d);
  const fake = s.hallucinations.find((p) => p.x + 0.35 > d);
  return {
    jump: !low && next?.kind === 'ground' && s.run.player.grounded && lead < s.run.speed * 0.25,
    crouch: low || Boolean(paper && paper.x - d < 1 && !s.tailTicks && s.tailCooldown),
    tail:
      !s.tailHeld &&
      !s.tailCooldown &&
      Boolean(
        (paper && paper.x - d < 3.1) ||
        (fake && fake.x - d < 3.1) ||
        (s.hasAnswer && s.energy === 100),
      ),
  };
}
it('keeps the checkpoint and completed score after failure without farming failed scores', () => {
  let s = continueJourney(beginJourney());
  s = finishJourneyStage(s, result());
  expect(s.stage).toBe(1);
  expect(finishJourneyStage(s, result())).toBe(s);
  s = continueJourney(s);
  s = finishJourneyStage(s, result(false, 99999, 2000));
  expect(s.stage).toBe(1);
  expect(s.completed).toHaveLength(1);
  expect(journeyScore(s)).toBe(500);
  expect(s.spentMs).toBe(3000);
  s = continueJourney(s);
  expect(s.assisted).toBe(true);
  for (let index = 1; index < 4; index++) {
    s = finishJourneyStage(s, result());
    if (index < 3) s = continueJourney(s);
  }
  expect(s.phase).toBe('won');
  expect(s.completed).toHaveLength(4);
  expect(journeyScore(s)).toBe(3500);
});
it.each(['aborted', 'completed', 'draw'] as const)(
  'does not award a stage for a non-win outcome: %s',
  (outcome) => {
    const state = finishJourneyStage(continueJourney(beginJourney()), { ...result(), outcome });
    expect(state.phase).toBe('failed');
    expect(state.stage).toBe(0);
    expect(state.completed).toHaveLength(0);
    expect(journeyScore(state)).toBe(0);
  },
);
it('offers explicit retry aid without changing the route or precise timing standard', () => {
  const normal = beginMissionAdventure(7, { levelId: 2, from: 360, assisted: false });
  const assist = beginMissionAdventure(7, { levelId: 2, from: 360, assisted: true });
  expect(assist.run.obstacles).toEqual(normal.run.obstacles);
  expect(assist.run.distance).toBe(360);
  expect(assist.context).toBe(6);
  expect(assist.printers.every((p) => p.x >= 360)).toBe(true);
  expect(beginFlight(true).health).toBe(4);
  const rhythm = beginRhythm(true);
  expect(rhythm.health).toBe(8);
  expect(advanceRhythm(rhythm, rhythmChart[0]!.at + 140, 'jump').good).toBe(1);
  expect(advanceRhythm(rhythm, rhythmChart[0]!.at + 140, 'jump').perfect).toBe(0);
  expect(advanceRhythm(rhythm, RHYTHM_END_MS).status).toBe('lost');
  let idleFlight = beginFlight(true);
  for (let i = 0; i < 4000 && idleFlight.status === 'running'; i++)
    idleFlight = advanceFlight(idleFlight, false);
  expect(idleFlight.status).toBe('lost');
  let idleRunner = assist;
  for (let i = 0; i < 5000 && idleRunner.run.status === 'running'; i++)
    idleRunner = advanceAdventure(idleRunner, { jump: false, crouch: false, tail: false });
  expect(idleRunner.run.result?.reason).not.toBe('distance-limit');
});
it.each([0, 1, 2])('normal-input journey seed %i finishes in about three minutes', (seed) => {
  let s = continueJourney(beginJourney());
  for (const stage of journeyStages) {
    let durationMs: number;
    if (stage.kind === 'runner') {
      let run = beginMissionAdventure(seed, {
        levelId: stage.levelId,
        from: stage.from,
        assisted: false,
      });
      for (let i = 0; i < 5000 && run.run.status === 'running'; i++)
        run = advanceAdventure(run, runnerInput(run));
      expect(run.run.result?.reason).toBe('distance-limit');
      durationMs = (run.realTick / 60) * 1000;
    } else if (stage.kind === 'flight') {
      let run = beginFlight();
      for (let i = 0; i < 4000 && run.status === 'running'; i++) {
        let target = flightGates.find((g) => g.x > run.distance - 1)?.center ?? 5;
        const missile = run.missiles.find((m) => m.x > run.distance - 1);
        if (missile && Math.abs(target - missile.y) < 1.4)
          target = Math.max(1, Math.min(9, missile.y + (missile.y > 5 ? -2 : 2)));
        run = advanceFlight(run, run.y + run.vy * 0.35 < target);
      }
      expect(run.status).toBe('won');
      durationMs = (run.tick / 60) * 1000;
    } else {
      let run = beginRhythm();
      for (const note of rhythmChart) run = advanceRhythm(run, note.at, note.action);
      expect(advanceRhythm(run, RHYTHM_END_MS).status).toBe('won');
      durationMs = RHYTHM_END_MS;
    }
    s = finishJourneyStage(s, result(true, 1000, durationMs));
    if (s.phase === 'handoff') s = continueJourney(s);
  }
  expect(s.phase).toBe('won');
  expect(s.spentMs + HANDOFF_MS * 3).toBeGreaterThanOrEqual(160000);
  expect(s.spentMs + HANDOFF_MS * 3).toBeLessThanOrEqual(195000);
});
