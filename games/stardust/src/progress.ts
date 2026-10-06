export const ENEMY_UNLOCK_KILLS = 30;
export const ENEMY_PROGRESS_KEY = 'moecore:stardust:v1:enemy-kills';

export type EnemyKillProgress<Id extends string = string> = Partial<Record<Id, number>>;

export function sanitizeEnemyProgress<Id extends string>(
  value: unknown,
  ids: readonly Id[],
): EnemyKillProgress<Id> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const progress: EnemyKillProgress<Id> = {};
  for (const id of ids) {
    const count = record[id];
    if (typeof count !== 'number' || !Number.isFinite(count)) continue;
    progress[id] = Math.max(0, Math.min(ENEMY_UNLOCK_KILLS, Math.floor(count)));
  }
  return progress;
}

export function defeatedEnemy<Id extends string>(
  progress: EnemyKillProgress<Id>,
  id: Id,
): EnemyKillProgress<Id> {
  return {
    ...progress,
    [id]: Math.min(ENEMY_UNLOCK_KILLS, (progress[id] ?? 0) + 1),
  };
}

export function enemyUnlocked<Id extends string>(progress: EnemyKillProgress<Id>, id: Id): boolean {
  return (progress[id] ?? 0) >= ENEMY_UNLOCK_KILLS;
}

export function challengeVictory<Id extends string>(
  progress: EnemyKillProgress<Id>,
  id: Id,
  name: string,
) {
  const next = defeatedEnemy(progress, id);
  const kills = next[id] ?? 0;
  return {
    progress: next,
    kills,
    unlocked: kills >= ENEMY_UNLOCK_KILLS,
    summary:
      kills >= ENEMY_UNLOCK_KILLS
        ? `挑战成功，击败${name}。${name}已解锁为可操作角色。`
        : `挑战成功，击败${name}。解锁进度 ${kills} / ${ENEMY_UNLOCK_KILLS}`,
  };
}
