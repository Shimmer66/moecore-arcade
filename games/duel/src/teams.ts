import { IDS } from './moves';
import type { Battle, TeamLineups, TeamState } from './types';

export const DEFAULT_TEAMS: TeamLineups = [
  ['deepseek', 'gpt', 'doubao'],
  ['client', 'prompt_sage', 'unplug_uncle'],
];
export function cloneLineups(lineups: TeamLineups): TeamLineups {
  return [[...lineups[0]], [...lineups[1]]];
}
export function makeTeams(lineups: TeamLineups): [TeamState, TeamState] {
  for (const lineup of lineups) {
    if (lineup.length !== 3 || new Set(lineup).size !== 3 || lineup.some((id) => !IDS.includes(id)))
      throw new Error('每队需要三名不同的已开放角色');
  }
  return lineups.map((lineup) => ({
    members: lineup.map((id) => ({ id, hp: 1000, eliminated: false, damage: 0, wins: 0 })),
    active: 0,
    energy: 0,
    recovery: 0,
  })) as [TeamState, TeamState];
}
export const teamEnergyCap = (team: TeamState) => (3 + team.active) * 100;
export const remaining = (team: TeamState) =>
  team.members.filter((member) => !member.eliminated).length;
export function teamOutcome(teams: [TeamState, TeamState]): Battle['outcome'] {
  const a = remaining(teams[0]),
    b = remaining(teams[1]);
  if (a > 0 && b > 0) return null;
  return a === 0 && b === 0 ? 'draw' : a === 0 ? 'lose' : 'win';
}
/** Record eliminations at the bell; keep the old active fighters visible until the handoff. */
export function settleTeamBout(b: Battle): void {
  if (!b.teams) return;
  for (const f of b.fighters) {
    const team = b.teams[f.slot],
      member = team.members[team.active]!;
    member.damage = Math.max(
      0,
      f.damage -
        team.members.reduce((sum, m, index) => sum + (index === team.active ? 0 : m.damage), 0),
    );
    member.eliminated = b.roundWinner === null || b.roundWinner !== f.slot;
    member.hp = member.eliminated ? 0 : f.hp;
    if (b.roundWinner === f.slot) member.wins++;
    team.energy = f.energy;
    team.recovery = 0;
  }
  if (b.roundWinner !== null && teamOutcome(b.teams) === null) {
    const team = b.teams[b.roundWinner];
    team.recovery = Math.min(
      1000 - team.members[team.active]!.hp,
      180,
      60 + Math.floor(b.timer / 60) * 2,
    );
  }
}
export function advanceTeamOrder(team: TeamState): void {
  while (team.members[team.active]?.eliminated) team.active++;
  const member = team.members[team.active];
  if (!member) throw new Error('已全员退场的队伍不能继续接力');
  member.hp = Math.min(1000, member.hp + team.recovery);
  team.recovery = 0;
}
