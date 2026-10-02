import type { Command, Fighter, Input } from './types';
import { characterPatterns, CHARGE_FRAMES, CHARGE_RELEASE_WINDOW } from './character-commands';
import type { MotionPattern } from './character-commands';

const patterns: MotionPattern[] = [
  { directions: [2, 1, 4, 1, 2, 3, 6], command: 'climax', label: '回旋指令 · 终结', window: 42 },
  { directions: [2, 3, 6, 2, 3, 6], command: 'super', label: '双正摇 · 大招', window: 42 },
  { directions: [6, 2, 3, 6], command: 'uppercut', label: '升龙 · 挑空', window: 26 },
  { directions: [6, 2, 3], command: 'uppercut', label: '升龙 · 挑空', window: 26 },
  { directions: [2, 3, 6], command: 'skill', label: '正摇 · 特色技', window: 26 },
  { directions: [2, 1, 4], command: 'variant', label: '反摇 · 变招', window: 26 },
];
const arrows: Record<number, string> = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '·', 6: '→' };
const buttons: Partial<Record<Command, string>> = {
  light: '轻拳',
  heavy: '重拳',
  lightKick: '轻脚',
  kick: '重脚',
  skill: '技能',
  variant: '变招',
  super: '大招',
  jump: '跳',
  roll: '闪避',
  dash: '冲刺',
  throw: '投',
  burst: '脱身',
  meme: '整活',
  exSkill: 'EX技',
  exVariant: 'EX变',
  max: 'MAX',
  maxSuper: '二阶',
  climax: '终结',
  blowback: '击飞',
  commandGrab: '指令投',
};
export function clearMotionInput(f: Fighter) {
  f.directions = [];
  f.inputLog = [];
  f.motionResult = null;
  f.backCharge = 0;
  f.chargeReadyUntil = -1;
}
/** Absolute input is displayed; matching is relative to facing. A side switch clears old motions. */
export function motionInput(f: Fighter, input: Input, frame: number, facing: -1 | 1): Input {
  if (f.motionFacing !== facing) {
    f.directions = [];
    f.motionFacing = facing;
    f.backCharge = 0;
    f.chargeReadyUntil = -1;
  }
  if (input.move === -facing) {
    f.backCharge = Math.min(CHARGE_FRAMES, f.backCharge + 1);
    if (f.backCharge >= CHARGE_FRAMES) f.chargeReadyUntil = frame + CHARGE_RELEASE_WINDOW;
  } else f.backCharge = 0;
  const direction = input.crouch ? 2 + input.move : 5 + input.move;
  f.directions = f.directions.filter((item) => frame - item.frame <= 42);
  f.inputLog = f.inputLog.filter((item) => frame - item.frame <= 180);
  const last = f.directions.at(-1);
  if (last?.direction === direction) last.frame = frame;
  else {
    f.directions.push({ direction, frame });
    if (direction !== 5) f.inputLog.push({ text: arrows[direction]!, frame });
  }
  for (const command of input.commands)
    f.inputLog.push({ text: buttons[command] ?? command, frame });
  f.inputLog = f.inputLog.slice(-12);
  f.directions = f.directions.slice(-18);
  if (f.motionResult && frame - f.motionResult.frame > 100) f.motionResult = null;
  const punch = input.commands.find((command) => command === 'light' || command === 'heavy');
  const kick = input.commands.find((command) => command === 'lightKick' || command === 'kick');
  // These command specials are ground-only. A takeoff/air normal must not be
  // replaced by a stale ground motion, which would then fail and eat the button.
  if ((punch || kick) && (f.y > 0 || input.commands.includes('jump'))) {
    f.directions = [];
    return input.commands.includes('heavy') && input.commands.includes('kick')
      ? {
          ...input,
          commands: [...input.commands.filter((c) => c !== 'heavy' && c !== 'kick'), 'blowback'],
        }
      : input;
  }
  if ((!punch && !kick) || input.guard) {
    if (input.commands.includes('heavy') && input.commands.includes('kick'))
      return {
        ...input,
        commands: [...input.commands.filter((c) => c !== 'heavy' && c !== 'kick'), 'blowback'],
      };
    return input;
  }
  const recent = f.directions.filter((item) => item.direction !== 5);
  const candidates = [...patterns, ...characterPatterns(f.id)].sort(
    (a, b) => b.directions.length - a.directions.length,
  );
  for (const pattern of candidates) {
    const trigger = pattern.button === 'kick' ? kick : punch;
    if (!trigger) continue;
    const tail = recent.slice(-pattern.directions.length);
    if (
      tail.length !== pattern.directions.length ||
      frame - tail[0]!.frame > pattern.window ||
      frame - tail.at(-1)!.frame > 8
    )
      continue;
    if (
      !tail.every(
        (item, index) =>
          (facing === 1
            ? item.direction
            : item.direction === 2
              ? 2
              : item.direction <= 3
                ? 4 - item.direction
                : 10 - item.direction) === pattern.directions[index],
      )
    )
      continue;
    const both =
      pattern.button === 'kick'
        ? input.commands.includes('lightKick') && input.commands.includes('kick')
        : input.commands.includes('light') && input.commands.includes('heavy');
    const command =
      both && pattern.command === 'skill'
        ? 'exSkill'
        : both && pattern.command === 'variant'
          ? 'exVariant'
          : both && pattern.command === 'super'
            ? 'maxSuper'
            : pattern.command;
    f.directions = [];
    f.backCharge = 0;
    f.chargeReadyUntil = -1;
    f.motionResult = {
      text:
        command === 'maxSuper'
          ? '双正摇双拳 · 二阶大招'
          : `${both && command.startsWith('ex') ? 'EX ' : ''}${pattern.label}`,
      frame,
    };
    f.motionCount++;
    return {
      ...input,
      commands: [
        ...input.commands.filter((c) =>
          pattern.button === 'kick'
            ? c !== 'lightKick' && c !== 'kick'
            : c !== 'light' && c !== 'heavy',
        ),
        command,
      ],
      contexts: {
        ...input.contexts,
        [command]: input.contexts?.[trigger] ?? { move: input.move, crouch: input.crouch },
      },
    };
  }
  const chargeTrigger = f.id === 'doubao' ? punch : f.id === 'unplug_uncle' ? kick : undefined;
  if (chargeTrigger && input.move === facing && f.chargeReadyUntil >= frame) {
    const ex =
      f.id === 'doubao'
        ? input.commands.includes('light') && input.commands.includes('heavy')
        : input.commands.includes('lightKick') && input.commands.includes('kick');
    const command: Command = ex ? 'exSkill' : 'skill';
    f.backCharge = 0;
    f.chargeReadyUntil = -1;
    f.directions = [];
    f.motionCount++;
    f.motionResult = {
      text: `${ex ? 'EX ' : ''}蓄力完成 · ${f.id === 'doubao' ? '憋个包' : '网线拉人'}`,
      frame,
    };
    return {
      ...input,
      commands: [
        ...input.commands.filter((c) => !['light', 'heavy', 'lightKick', 'kick'].includes(c)),
        command,
      ],
      contexts: {
        ...input.contexts,
        [command]: input.contexts?.[chargeTrigger] ?? { move: input.move, crouch: input.crouch },
      },
    };
  }
  if (input.commands.includes('heavy') && input.commands.includes('kick'))
    return {
      ...input,
      commands: [...input.commands.filter((c) => c !== 'heavy' && c !== 'kick'), 'blowback'],
    };
  return input;
}
