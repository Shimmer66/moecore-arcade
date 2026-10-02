import type { Room } from './campaign';
import type { Trap } from './traps';

export interface EndlessRun {
  seed: number;
  stage: number;
  cleared: number;
  secrets: number;
  deaths: number;
  ticks: number;
}
export interface EndlessSave {
  version: 1;
  best: number;
  run: EndlessRun;
}
export const ENDLESS_KEY = 'arena-endless-v1';
export const endlessReplay: { seed: number | null } = { seed: null };
export function createEndless(seed: number): EndlessRun {
  return { seed: seed >>> 0, stage: 0, cleared: 0, secrets: 0, deaths: 0, ticks: 0 };
}

export function generateEndlessRoom(seed: number, stage: number): Room {
  if (!Number.isSafeInteger(stage) || stage < 0) throw new Error('Invalid endless stage');
  let randomState = ((seed >>> 0) ^ Math.imul(stage + 1, 0x9e3779b9)) >>> 0;
  const random = (max: number) => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return Math.floor((randomState / 0x100000000) * max);
  };
  const positions = stage < 3 ? [270, 610] : [230, 500, 770];
  const traps: Trap[] = positions.map((base, index) => {
    const x = base + random(21) - 10;
    const effect = (['pit', 'spikes', 'gate', 'saw'] as const)[random(4)]!;
    const common = {
      id: `generated-${index}`,
      effect,
      trigger: { x: x - 150, y: 0, w: 130, h: 440 },
      delay: 10,
      line: '',
    };
    if (effect === 'pit')
      return {
        ...common,
        body: { x, y: 354, w: 86 + random(25), h: 86 },
        line: '这段地板仍在生成中。',
      };
    if (effect === 'spikes')
      return { ...common, body: { x, y: 324, w: 60, h: 30 }, line: '自动补全了一个意外。' };
    if (effect === 'gate')
      return {
        ...common,
        delay: 0,
        body: { x, y: 100, w: 26, h: 254 },
        cycle: { active: 70 + Math.min(40, stage * 2) + random(15), rest: 70 },
        line: '生成额度稍后恢复。',
      };
    return {
      ...common,
      body: { x, y: 310, w: 44, h: 44 },
      travel: { x: 55 + random(21), y: 0, ticks: 70 + random(21), loop: true },
      line: '正在切分下一批 Token。',
    };
  });
  return {
    id: `endless-${seed >>> 0}-${stage}`,
    chapter: '无尽生成',
    title: `第 ${stage + 1} 次续写`,
    promise: '我还有一个新想法。',
    spawn: { x: 50, y: 306 },
    exit: { x: 930, y: 292, w: 64, h: 62 },
    floors: [{ x: 0, y: 354, w: 1000, h: 86 }],
    traps,
    secret: { x: 140, y: 220 },
  };
}
export function clearEndless(run: EndlessRun, ticks: number, secret: boolean): EndlessRun {
  if (run.cleared > run.stage) return run;
  return {
    ...run,
    cleared: run.stage + 1,
    secrets: run.secrets + Number(secret),
    ticks: run.ticks + ticks,
  };
}
export function nextEndless(run: EndlessRun): EndlessRun {
  return run.cleared > run.stage ? { ...run, stage: run.cleared } : run;
}
export function loadEndless(): EndlessSave | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(ENDLESS_KEY) ?? 'null');
    if (
      !saved ||
      typeof saved !== 'object' ||
      !('version' in saved) ||
      saved.version !== 1 ||
      !('run' in saved) ||
      !('best' in saved)
    )
      return null;
    const run = saved.run as EndlessRun;
    if (
      !run ||
      ['seed', 'stage', 'cleared', 'secrets', 'deaths', 'ticks'].some((key) => {
        const value = run[key as keyof EndlessRun];
        return !Number.isSafeInteger(value) || value < 0;
      }) ||
      run.seed > 0xffffffff ||
      run.cleared < run.stage ||
      run.cleared > run.stage + 1 ||
      run.secrets > run.cleared ||
      !Number.isSafeInteger(saved.best) ||
      Number(saved.best) < run.cleared
    )
      return null;
    return { version: 1, best: Number(saved.best), run };
  } catch {
    return null;
  }
}
export function saveEndless(run: EndlessRun, best: number): boolean {
  try {
    localStorage.setItem(
      ENDLESS_KEY,
      JSON.stringify({ version: 1, run, best: Math.max(best, run.cleared) }),
    );
    return true;
  } catch {
    return false;
  }
}
