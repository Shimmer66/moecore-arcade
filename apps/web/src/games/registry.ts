import type { GameModule } from '@moecore/game-sdk';

// Register only games with a complete, tested mount implementation.
export const gameLoaders: Readonly<Record<string, () => Promise<GameModule>>> = {};
