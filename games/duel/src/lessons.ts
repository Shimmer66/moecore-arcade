import { moveFor } from './moves';
import type { Action, Battle, BattleEvent, DummyMode, FighterId } from './types';

export type LessonId = 'ground' | 'aerial' | 'supers' | 'signature';
type Check =
  | 'jab'
  | 'lightKick'
  | 'closeHeavy'
  | 'upper'
  | 'chase'
  | 'air'
  | 'airHeavy'
  | 'super1'
  | 'super2'
  | 'super3'
  | 'rice'
  | 'heal'
  | 'catch'
  | 'throwHit'
  | 'parcel'
  | 'reflect'
  | 'commandGrab'
  | 'commandSlam'
  | 'castTrap'
  | 'trapHit'
  | 'disconnect'
  | 'offlinePunch';
export interface LessonStep {
  check: Check;
  key: string;
  label: string;
  hint: string;
}
export interface Lesson {
  id: LessonId;
  title: string;
  intro: string;
  continuous: boolean;
  dummy: DummyMode;
  positions: [number, number];
  playerHP: number;
  steps: LessonStep[];
}
export interface LessonProgress {
  definition: Lesson;
  step: number;
  status: 'ready' | 'active' | 'complete' | 'failed';
  hint: string;
  beganAt: number;
  lastStepAt: number;
  lastSerial: number;
  matchedSerial: number;
  pendingSerial: number | null;
  pendingAction: Action | null;
  playerHP: number;
  targetHP: number;
  throws: number;
  commandThrows: number;
  cancels: number;
  projectile: number | null;
  eventId: number;
}
const step = (check: Check, key: string, label: string, hint: string): LessonStep => ({
  check,
  key,
  label,
  hint,
});
export function lessonsFor(id: FighterId): Lesson[] {
  const common = {
    dummy: 'idle' as const,
    positions: [400, 448] as [number, number],
    playerHP: 1000,
  };
  const lessons: Lesson[] = [
    {
      ...common,
      id: 'ground',
      title: '三下端走',
      intro: '轻拳→轻脚→贴身重拳，三次命中必须连在一起。',
      continuous: true,
      steps: [
        step('jab', 'J', '轻拳命中', '先按J，看到命中再接下一步。'),
        step('lightKick', 'M', '轻脚接上', '现在按M，别等对方站稳。'),
        step('closeHeavy', 'K', '近重拳收尾', '贴身按K；距离太远会出远重拳。'),
      ],
    },
    {
      ...common,
      id: 'aerial',
      title: '上天也要挨揍',
      intro: '蹲重挑空→跳跃追击→空中轻拳→重拳砸落。',
      continuous: true,
      steps: [
        step('upper', 'S＋K', '挑空命中', '按住S再按K，把木桩打上天。'),
        step('chase', '跳', '追上去', '挑空打中后立刻按跳，触发追击。'),
        step('air', 'J', '空中轻拳', '追上去后按J，确认空中打中。'),
        step('airHeavy', 'K', '砸回地上', '空中轻拳命中后按K收尾。'),
      ],
    },
    {
      ...common,
      id: 'supers',
      title: '这顿越吃越大',
      intro: '一阶命中后升级二阶，再接终结；起始5格气。',
      continuous: true,
      steps: [
        step('super1', 'I', '一阶命中', '按I，命中后留意特写里的升级窗口。'),
        step('super2', 'R', '二阶命中', '特写前段按R，追加1格气升级。'),
        step('super3', 'T', '终结命中', '二阶命中后按T，继续升到终结。'),
      ],
    },
  ];
  const signature: Record<
    FighterId,
    Pick<Lesson, 'title' | 'intro' | 'steps'> &
      Partial<Pick<Lesson, 'positions' | 'playerHP' | 'dummy'>>
  > = {
    deepseek: {
      title: '白饭要吃到嘴里',
      intro: '先端碗，再等吃完。回复真的到账才算完成。',
      positions: [260, 740],
      playerHP: 760,
      steps: [
        step('rice', 'F', '端起饭碗', '距离拉开了，按F端饭。'),
        step('heal', '等吃完', '回血到账', '等吃完这口饭；挨打会洒饭。'),
      ],
    },
    gpt: {
      title: '接住是服务，摔下是售后',
      intro: '木桩会反复跳，等它下落时用F接住。',
      positions: [400, 465],
      dummy: 'repeat-jump',
      steps: [
        step('catch', 'F', '接到下落目标', '看到木桩开始下落再按F，不要对地面空接。'),
        step('throwHit', '等摔落', '摔投伤害到账', '接住后等摔投结算；被拆开不算完成。'),
      ],
    },
    doubao: {
      title: '锅可以甩，别用脸接',
      intro: 'F扔回旋气泡；回来时用K拍回去。',
      positions: [260, 900],
      steps: [
        step('parcel', 'F', '甩出气泡', '按F，等气泡进入回程。'),
        step('reflect', 'K', '打回自己的气泡', '回程接近时提前按K，重拳有效帧才能反弹。'),
      ],
    },
    client: {
      title: '签了就别跑',
      intro: '用Y指令投锁住木桩，完成抬起和落地。',
      steps: [
        step('commandGrab', 'Y', '合同锁人', '贴身按Y；普通O不能代替指令投。'),
        step('commandSlam', '等落地', '落地结算', '等整套投技结束，伤害和落地都完成才算。'),
      ],
    },
    prompt_sage: {
      title: '给木桩画个圈',
      intro: '木桩站在符阵位置，F放阵并造成减速。',
      positions: [400, 545],
      steps: [
        step('castTrap', 'F', '开始画阵', '按F，放下减速符阵。'),
        step('trapHit', '等符阵', '符阵命中', '等待符阵造成真实伤害和减速。'),
      ],
    },
    unplug_uncle: {
      title: '断网了，拳头还能用',
      intro: 'F命中让双方断网，再用K揍它。两步无需构成真连。',
      steps: [
        step('disconnect', 'F', '双方断网', '按F并命中木桩。'),
        step('offlinePunch', 'K', '断网期间出拳', '先等断网波收招结束，再按K；不要按技能。'),
      ],
    },
  };
  lessons.push({ ...common, ...signature[id], id: 'signature', continuous: false });
  return lessons;
}
export function setupLesson(b: Battle, definition: Lesson): LessonProgress {
  b.options.dummy = definition.dummy;
  b.options.infiniteEnergy = false;
  b.fighters[0].x = definition.positions[0];
  b.fighters[1].x = definition.positions[1];
  b.fighters[0].hp = definition.playerHP;
  b.fighters[0].energy = 500;
  if (definition.dummy === 'repeat-jump') b.tick = 89;
  return {
    definition,
    step: 0,
    status: 'ready',
    hint: definition.steps[0]!.hint,
    beganAt: b.tick,
    lastStepAt: b.tick,
    lastSerial: b.fighters[0].serial,
    matchedSerial: -1,
    pendingSerial: null,
    pendingAction: null,
    playerHP: b.fighters[0].hp,
    targetHP: b.fighters[1].hp,
    throws: b.fighters[0].throws,
    commandThrows: b.fighters[0].commandThrows,
    cancels: b.fighters[0].advancedCancels,
    projectile: null,
    eventId: -1,
  };
}
function fail(s: LessonProgress, message: string) {
  s.status = 'failed';
  s.hint = message;
}
function advanceStep(s: LessonProgress, b: Battle) {
  s.step++;
  s.lastStepAt = b.tick;
  s.pendingSerial = null;
  s.pendingAction = null;
  s.matchedSerial = b.fighters[0].serial;
  s.status = s.step === s.definition.steps.length ? 'complete' : 'active';
  s.hint =
    s.status === 'complete'
      ? '做到了！这次靠的是操作，嘴硬只占一点。'
      : s.definition.steps[s.step]!.hint;
}
function matches(check: Check, b: Battle, s: LessonProgress, e?: BattleEvent): boolean {
  const f = b.fighters[0],
    d = b.fighters[1];
  const hit = e?.kind === 'hit' && e.source === 0 && e.actor === 1 && (e.damage ?? 0) > 0;
  if (check === 'chase') return e?.kind === 'chase' && e.actor === 0;
  if (check === 'jab') return hit && e.move === 'light1';
  if (check === 'lightKick') return hit && e.move === 'lightKick';
  if (check === 'closeHeavy') return hit && e.move === 'closeHeavy';
  if (check === 'upper' || check === 'air' || check === 'airHeavy') return hit && e.move === check;
  if (check === 'super1' || check === 'super2' || check === 'super3') {
    const tier = Number(check.slice(-1));
    return (
      hit && e.move === 'super' && f.superTier === tier && f.advancedCancels >= s.cancels + tier - 1
    );
  }
  if (check === 'rice') return b.rice?.owner === 0 && b.rice.holder === 0 && f.action === 'meme';
  if (check === 'heal') return f.hp >= s.playerHP + 40 && b.rice === null;
  if (check === 'catch') return !!b.grab?.catch && b.grab.attacker === 0;
  if (check === 'throwHit') return hit && e.move === 'throwing' && f.throws > s.throws;
  if (check === 'parcel') {
    const p = b.projectiles.find((p) => p.owner === 0 && p.boomerang);
    if (p) s.projectile = p.id;
    return !!p;
  }
  if (check === 'reflect')
    return b.projectiles.some(
      (p) =>
        p.id === s.projectile && p.owner === 0 && p.originalOwner === 0 && (p.reflections ?? 0) > 0,
    );
  if (check === 'commandGrab') return !!b.grab?.command && b.grab.attacker === 0;
  if (check === 'commandSlam')
    return f.commandThrows > s.commandThrows && b.grab === null && d.hp <= s.targetHP - 180;
  if (check === 'castTrap') return f.action === 'meme' && f.memeCooldown > 0;
  if (check === 'trapHit') return hit && e.move === 'bubble' && d.slowed > 0;
  if (check === 'disconnect') return hit && e.move === 'meme' && f.silenced > 0 && d.silenced > 0;
  return (
    hit &&
    f.silenced > 0 &&
    d.silenced > 0 &&
    [
      'light1',
      'light2',
      'light3',
      'heavy',
      'closeHeavy',
      'kick',
      'lightKick',
      'low',
      'crouchKick',
      'sweep',
    ].includes(e.move ?? '')
  );
}
/** Consume actual combat feedback once; no key-press-only completion. */
export function updateLesson(s: LessonProgress, b: Battle): void {
  if (s.status === 'failed' || s.status === 'complete') return;
  const f = b.fighters[0],
    d = b.fighters[1];
  if (f.serial !== s.lastSerial) {
    s.lastSerial = f.serial;
    if (
      moveFor(f.id, f.action, f.exActive, f.superTier)?.strikes.length ||
      f.action === 'commandGrab'
    ) {
      s.pendingSerial = f.serial;
      s.pendingAction = f.action;
      if (s.status === 'ready') {
        s.status = 'active';
        s.beganAt = b.tick;
      }
    }
  }
  for (const e of b.events) {
    if (e.id <= s.eventId) continue;
    s.eventId = e.id;
    if (e.kind === 'hit' && e.actor === 0 && (e.damage ?? 0) > 0) {
      fail(
        s,
        f.id === 'doubao' && s.definition.id === 'signature'
          ? '气泡用脸接住了。回程时提前按K。'
          : '被打断了。重试后先完成当前步骤。',
      );
      return;
    }
    if ((e.kind === 'block' || e.kind === 'guard-break') && e.source === 0) {
      fail(s, '这招被挡住了。重试恢复木桩，再确认命中。');
      return;
    }
    if (matches(s.definition.steps[s.step]!.check, b, s, e)) {
      advanceStep(s, b);
      if (s.step === s.definition.steps.length) return;
    } else if (
      s.definition.continuous &&
      e.kind === 'hit' &&
      e.source === 0 &&
      e.actor === 1 &&
      f.serial !== s.matchedSerial
    ) {
      fail(s, `顺序不对，下一步是「${s.definition.steps[s.step]!.label}」。`);
      return;
    }
  }
  if (matches(s.definition.steps[s.step]!.check, b, s)) {
    advanceStep(s, b);
    if (s.step === s.definition.steps.length) return;
  }
  if (s.definition.continuous && s.step > 0 && d.combo === 0 && b.phase === 'fight') {
    fail(s, '连段断开了。命中后尽快接下一步，别等对手恢复。');
    return;
  }
  if (s.definition.id === 'supers' && b.phase === 'cinematic' && b.phaseFrames <= 36) {
    fail(s, '升级窗口过去了。下次在特写前段按R或T。');
    return;
  }
  if (
    s.definition.id === 'signature' &&
    f.id === 'deepseek' &&
    s.step === 1 &&
    b.rice?.holder !== 0
  ) {
    fail(s, '饭没吃到嘴里。先拉开距离，别让饭碗被抢或打翻。');
    return;
  }
  if (
    s.definition.id === 'signature' &&
    f.id === 'gpt' &&
    s.step === 1 &&
    b.grab === null &&
    f.throws === s.throws
  ) {
    fail(s, '接住了但没摔中，可能被拆开或过载了。重试再来。');
    return;
  }
  if (s.definition.id === 'signature' && f.id === 'unplug_uncle' && s.step === 1) {
    if (f.silenced === 0) {
      fail(s, '网恢复了。下次断网后更快接普通拳脚。');
      return;
    }
    s.hint =
      f.action === 'meme' ? '先等断网波收完，普通拳脚随后能用。' : '现在按K！断网不耽误抡拳头。';
  }
  if (s.definition.id === 'signature' && f.id === 'doubao' && s.step === 1) {
    const p = b.projectiles.find((p) => p.id === s.projectile);
    if (!p) {
      fail(s, '回旋气泡没拍回去。重试后盯住回程。');
      return;
    }
    s.hint =
      p.returning && Math.abs(p.x - f.x) <= 240
        ? '现在按K！别让脸先接到。'
        : '气泡还在路上，等它返回并靠近再按K。';
  }
  if (
    s.pendingSerial !== null &&
    s.pendingSerial !== s.matchedSerial &&
    ['idle', 'walk', 'guard', 'crouch', 'jump'].includes(f.action)
  ) {
    fail(s, '这招打空了。重试摆好距离，再按当前提示出招。');
    return;
  }
  if (s.status !== 'ready' && b.tick - s.lastStepAt > 240)
    fail(s, '这一段没接上。按重试重新摆位。');
}
