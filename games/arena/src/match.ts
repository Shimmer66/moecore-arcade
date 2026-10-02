export interface MatchState {
  start: number;
  round: number;
  scores: [number, number];
  result: 0 | 1 | 'draw' | null;
}
export function createMatch(start: number): MatchState {
  return { start, round: 1, scores: [0, 0], result: null };
}
export function matchChampion(match: MatchState): 0 | 1 | null {
  return match.scores[0] >= 3 ? 0 : match.scores[1] >= 3 ? 1 : null;
}
export function settleRound(match: MatchState, winner: 0 | 1 | 'draw'): MatchState {
  if (match.result !== null || matchChampion(match) !== null) return match;
  const scores: [number, number] = [...match.scores];
  if (winner !== 'draw') scores[winner]++;
  return { ...match, result: winner, scores };
}
export function advanceRound(match: MatchState): MatchState {
  if (match.result === null || matchChampion(match) !== null) return match;
  return { ...match, round: match.round + (match.result === 'draw' ? 0 : 1), result: null };
}
