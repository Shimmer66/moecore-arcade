import {
  DUEL_ART,
  DUEL_ADVANCED_MOTION,
  DUEL_NORMAL_MOTION,
  DUEL_GRAPPLE_MOTION,
  DUEL_SIGNATURE_MOTION,
  DUEL_NEWCOMER_MOTION,
  DUEL_COMBAT_ART,
  DUEL_COMBAT_FX,
  DUEL_CROUCH_ART,
  DUEL_MOTION_ART,
  DUEL_SWEEP_ART,
} from '@moecore/assets/duel';
import { isNewcomer } from './types';
import type { FighterId } from './types';

/** Only primary rendering paths. Error-only fallback art is fetched on demand. */
export function battleArtUrls(characters: readonly FighterId[]): string[] {
  const urls: string[] = [...Object.values(DUEL_COMBAT_FX)];
  for (const id of new Set(characters)) {
    urls.push(DUEL_ADVANCED_MOTION[id], DUEL_NORMAL_MOTION[id]);
    if (id === 'gpt') urls.push(DUEL_GRAPPLE_MOTION.gpt);
    if (id === 'deepseek') urls.push(DUEL_SIGNATURE_MOTION.deepseek);
    if (id === 'doubao') urls.push(DUEL_SIGNATURE_MOTION.doubao);
    if (id === 'client') urls.push(DUEL_SIGNATURE_MOTION.client);
    if (id === 'prompt_sage') urls.push(DUEL_SIGNATURE_MOTION.prompt_sage);
    if (id === 'unplug_uncle') urls.push(DUEL_SIGNATURE_MOTION.unplug_uncle);
    if (isNewcomer(id)) urls.push(...Object.values(DUEL_NEWCOMER_MOTION[id]));
    else {
      const poses = DUEL_COMBAT_ART[id];
      urls.push(
        DUEL_MOTION_ART[id],
        ...Object.values(DUEL_CROUCH_ART[id]),
        DUEL_SWEEP_ART,
        poses.ready,
        poses.jump,
        poses.jab_start,
        poses.cross_hit,
        poses.skill_cast,
        poses.guard,
        DUEL_ART[id].ultimate,
      );
      if (id === 'deepseek') urls.push(poses.dash);
      if (id === 'doubao') urls.push(poses.upper_hit);
    }
  }
  return [...new Set(urls)];
}

interface DecodableImage {
  src: string;
  decode(): Promise<void>;
}
interface Entry {
  image: DecodableImage;
  done: Promise<boolean>;
}
/** Shared in-flight promises prevent mode changes and reordering from decoding twice. */
export class BattleArtLoader {
  private entries = new Map<string, Entry>();
  private generation = 0;
  constructor(private createImage: () => DecodableImage = () => new Image()) {}
  private load(url: string): Promise<boolean> {
    const cached = this.entries.get(url);
    if (cached) return cached.done;
    const image = this.createImage();
    image.src = url;
    const done = image.decode().then(
      () => true,
      () => false,
    );
    this.entries.set(url, { image, done });
    return done;
  }
  async warm(
    urls: readonly string[],
    progress: (loaded: number, total: number, failed: number) => void,
  ): Promise<boolean> {
    const generation = ++this.generation,
      unique = [...new Set(urls)];
    const wanted = new Set(unique);
    for (const url of this.entries.keys()) if (!wanted.has(url)) this.entries.delete(url);
    let cursor = 0,
      loaded = 0,
      failed = 0;
    progress(0, unique.length, 0);
    await Promise.all(
      [0, 1, 2].map(async () => {
        while (generation === this.generation && cursor < unique.length) {
          const ok = await this.load(unique[cursor++]!);
          if (generation !== this.generation) return;
          loaded++;
          if (!ok) failed++;
          progress(loaded, unique.length, failed);
        }
      }),
    );
    return generation === this.generation;
  }
  dispose(): void {
    this.generation++;
    this.entries.clear();
  }
}
