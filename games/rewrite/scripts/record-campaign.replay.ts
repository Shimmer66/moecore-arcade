import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { recordCampaign } from './campaign-driver';

it('records six complete campaigns without changing simulation state', () => {
  const directory = new URL('../tests/replays/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  for (const difficulty of ['normal', 'classic', 'hard'] as const)
    for (const duo of [false, true]) {
      const { result, tape } = recordCampaign(difficulty, duo, (s) =>
        console.log(`${difficulty}/${duo ? 'duo' : 'solo'} cleared stage ${s.levelIndex + 1}`),
      );
      if (result.phase !== 'won') console.error(JSON.stringify(result));
      expect(result.phase).toBe('won');
      const fixture = {
        schema: 2,
        difficulty,
        duo,
        expectation: {
          ticks: Math.round(result.elapsed * 60),
          deaths: result.deaths,
          continuesRemaining: result.continues,
          levels: 8,
        },
        tape,
      };
      writeFileSync(
        new URL(`${difficulty}-${duo ? 'duo' : 'solo'}.json`, directory),
        JSON.stringify(fixture) + '\n',
      );
    }
}, 240000);
