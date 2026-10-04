import { CAMPAIGN } from './campaign';
import { DISCOVERIES, hiddenUnlocked, type DiscoveryId } from './hidden';

export interface RoomRecord {
  clears: number;
  bestTicks: number | null;
  deaths: number;
  secret: boolean;
}
export interface Progress {
  version: 2;
  rooms: Record<string, RoomRecord>;
  discoveries: DiscoveryId[];
  secretEnding: boolean;
}
export const PROGRESS_KEY = 'arena-campaign-v2';
const empty = (): RoomRecord => ({ clears: 0, bestTicks: null, deaths: 0, secret: false });
const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function parseProgress(raw: string | null, legacy: string | null = null): Progress {
  const progress: Progress = { version: 2, rooms: {}, discoveries: [], secretEnding: false };
  let data: unknown;
  try {
    data = JSON.parse(raw ?? 'null');
  } catch {
    data = null;
  }
  let old: unknown;
  try {
    old = JSON.parse(legacy ?? '[]');
  } catch {
    old = [];
  }
  const entries =
    data &&
    typeof data === 'object' &&
    'version' in data &&
    data.version === 2 &&
    'rooms' in data &&
    data.rooms &&
    typeof data.rooms === 'object'
      ? data.rooms
      : {};
  for (const room of CAMPAIGN) {
    const record = (entries as Record<string, unknown>)[room.id];
    const value = empty();
    if (record && typeof record === 'object') {
      if ('clears' in record) value.clears = count(record.clears);
      if ('deaths' in record) value.deaths = count(record.deaths);
      if ('secret' in record) value.secret = record.secret === true;
      if ('bestTicks' in record && count(record.bestTicks) > 0 && value.clears > 0)
        value.bestTicks = count(record.bestTicks);
    } else if (Array.isArray(old) && old.includes(room.id)) value.clears = 1;
    progress.rooms[room.id] = value;
  }
  if (data && typeof data === 'object') {
    if ('discoveries' in data && Array.isArray(data.discoveries)) {
      progress.discoveries = DISCOVERIES.filter((key) =>
        (data.discoveries as unknown[]).includes(key.id),
      ).map((key) => key.id);
    }
    progress.secretEnding =
      'secretEnding' in data && data.secretEnding === true && hiddenUnlocked(progress.discoveries);
  }
  return progress;
}
export function recordDiscovery(progress: Progress, id: DiscoveryId): Progress {
  if (progress.discoveries.includes(id)) return progress;
  return { ...progress, discoveries: [...progress.discoveries, id] };
}

export function recordClear(
  progress: Progress,
  id: string,
  ticks: number,
  secret: boolean,
): Progress {
  const previous = progress.rooms[id];
  if (!previous || !Number.isSafeInteger(ticks) || ticks <= 0) return progress;
  return {
    ...progress,
    rooms: {
      ...progress.rooms,
      [id]: {
        ...previous,
        clears: previous.clears + 1,
        bestTicks: Math.min(previous.bestTicks ?? ticks, ticks),
        secret: previous.secret || secret,
      },
    },
  };
}
export function recordDeath(progress: Progress, id: string): Progress {
  const previous = progress.rooms[id];
  return previous
    ? {
        ...progress,
        rooms: { ...progress.rooms, [id]: { ...previous, deaths: previous.deaths + 1 } },
      }
    : progress;
}
export function loadProgress(): Progress {
  try {
    return parseProgress(
      localStorage.getItem(PROGRESS_KEY),
      localStorage.getItem('arena-campaign-v1'),
    );
  } catch {
    return parseProgress(null);
  }
}
export function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(mergeProgress(loadProgress(), progress)));
    return true;
  } catch {
    return false;
  }
}
export function mergeProgress(first: Progress, second: Progress): Progress {
  const rooms: Progress['rooms'] = {};
  for (const room of CAMPAIGN) {
    const a = first.rooms[room.id]!,
      b = second.rooms[room.id]!;
    const times = [a.bestTicks, b.bestTicks].filter((value): value is number => value !== null);
    rooms[room.id] = {
      clears: Math.max(a.clears, b.clears),
      deaths: Math.max(a.deaths, b.deaths),
      secret: a.secret || b.secret,
      bestTicks: times.length ? Math.min(...times) : null,
    };
  }
  return {
    version: 2,
    rooms,
    discoveries: [...new Set([...first.discoveries, ...second.discoveries])],
    secretEnding: first.secretEnding || second.secretEnding,
  };
}
