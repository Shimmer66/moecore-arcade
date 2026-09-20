export const SETTINGS_STORAGE_KEY = 'moecore:settings:v1';

export function createGameStorageKey(gameId: string, key: string): string {
  if (!gameId.trim() || !key.trim()) {
    throw new Error('Game ID and storage key must not be empty.');
  }

  return `moecore:game:${encodeURIComponent(gameId)}:v1:${encodeURIComponent(key)}`;
}
