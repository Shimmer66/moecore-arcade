export type EnemyKind =
  'runner' | 'turret' | 'drone' | 'sniper' | 'hopper' | 'pod' | 'larva' | 'heart' | 'boss';
export type Weapon = 'pulse' | 'spread' | 'rapid' | 'laser' | 'flame' | 'homing';
export type SupplyKind =
  Weapon | 'shield' | 'grenade' | 'health' | 'overclock' | 'barrier' | 'purge';
export interface SupplyCarrier {
  kind: 'capsule' | 'cache';
  x: number;
  y: number;
  drop: SupplyKind;
}
export interface Platform {
  from: number;
  to: number;
  top: number;
  checkpoint?: boolean;
  motion?: { x: number; y: number; period: number; phase?: number };
  conveyor?: number;
  solid?: boolean;
}
export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  y: number;
}
export interface Supply {
  x: number;
  y: number;
  kind: SupplyKind;
}
export interface Hazard {
  from: number;
  to: number;
  kind: 'firewall' | 'context' | 'mirage';
  y?: number;
}
export interface LevelDefinition {
  title: string;
  subtitle: string;
  meme: string;
  hint: string;
  boss: string;
  color: string;
  sky: string;
  length: number;
  axis: 'horizontal' | 'vertical' | 'depth';
  height: number;
  arenaY: number;
  background: number;
  platforms: Platform[];
  enemies: EnemySpawn[];
  supplies: Supply[];
  hazards: Hazard[];
  sectors: { from: number; title: string; hint: string }[];
  carriers: SupplyCarrier[];
}
/** One definition drives rendered platforms, rider transport and landing collision. */
export function platformAt(platform: Platform, time: number): Platform {
  if (!platform.motion) return platform;
  const { x, y, period, phase = 0 } = platform.motion;
  const wave = Math.sin((time / period) * Math.PI * 2 + phase);
  return {
    ...platform,
    from: platform.from + x * wave,
    to: platform.to + x * wave,
    top: platform.top + y * wave,
  };
}
export const platformsAt = (level: LevelDefinition, time: number) =>
  level.platforms.map((p) => platformAt(p, time));
const specs = [
  [
    '提示词登陆',
    'PROMPT LANDING',
    '你的请求已进入战斗队列。',
    '卧倒避开平射，跳上高台拿 S 散射。',
    '429 限流闸门',
    '#69e9dc',
    '#112d3d',
    112,
    0,
  ],
  [
    '已读不回工厂',
    'REPLY FACTORY',
    '正在输入…正在装填。',
    'K 跳射高位节点；拆完核心让屏障断电，再按 W / 上键向前推进。',
    '已读回执机',
    '#ffb46b',
    '#302036',
    126,
    1,
  ],
  [
    '上下文瀑布',
    'CONTEXT FALLS',
    '刚才说到哪了？',
    '向上攀登记忆塔；发光缓存台保存复活位置。',
    '上下文吞噬者',
    '#b7a1ff',
    '#202542',
    138,
    2,
  ],
  [
    '幻觉高架桥',
    'HALLUCINATION',
    '来源：我编的。',
    '虚线桥不承重，射击核验；空中也能向下开火。',
    '引用缝合怪',
    '#ff8ac7',
    '#311d3c',
    146,
    3,
  ],
  [
    'Token 熔炉',
    'TOKEN FURNACE',
    '你的余额正在燃烧。',
    '火墙亮起前有预警；别在炉口停留。',
    'Token 焚烧炉',
    '#ff925f',
    '#3b2028',
    154,
    6,
  ],
  [
    '智能体叛乱',
    'AGENT UPRISING',
    '我给自己创建了 100 个子任务。',
    '先拆核心解除屏障；终端节点对齐时才暴露，外围全毁后攻击主核心。',
    '递归调度器',
    '#6ce4a1',
    '#102d33',
    162,
    5,
  ],
  [
    '对齐防火墙',
    'ALIGNMENT WALL',
    '抱歉，我无法让你通过。',
    '重炮与跳跃怪协同进攻，保持移动。',
    '拒绝服务堡垒',
    '#72c9ff',
    '#172b44',
    172,
    5,
  ],
  [
    '最终生成',
    'FINAL INFERENCE',
    '这次，答案由你来写。',
    '三阶段终战；观察红色弹道预警，保留手雷。',
    '幻觉之母 · Ω',
    '#efadff',
    '#291a3c',
    182,
    7,
  ],
] as const;

function contextTower(): Pick<
  LevelDefinition,
  'length' | 'axis' | 'height' | 'arenaY' | 'platforms' | 'enemies' | 'supplies' | 'hazards'
> {
  // Every rise is 2 units: below the 2.6-unit jump apex. Zigzags demand midair steering.
  const route = [
    4, 7.5, 11, 14.5, 18, 14.5, 11, 7.5, 4, 7.5, 11, 14.5, 18, 14.5, 11, 7.5, 4, 7.5, 11, 14.5, 18,
    14.5, 11,
  ];
  const platforms: Platform[] = [{ from: 0, to: 22, top: 0 }];
  const enemies: EnemySpawn[] = [];
  const supplies: Supply[] = [{ x: 2, y: 0.8, kind: 'homing' }];
  const hazards: Hazard[] = [];
  route.forEach((x, i) => {
    const top = (i + 1) * 2;
    const checkpoint = (i + 1) % 6 === 0;
    const halfWidth = checkpoint ? 3.6 : 1.9;
    platforms.push({ from: x - halfWidth, to: x + halfWidth, top, checkpoint });
    if (checkpoint) {
      supplies.push({ x, y: top + 0.7, kind: 'health' });
      supplies.push({ x: x - 2.5, y: top + 0.7, kind: 'shield' });
    } else if (i % 5 === 1) {
      supplies.push({ x, y: top + 0.7, kind: i < 10 ? 'homing' : 'laser' });
    }
    // Side emplacements do not occupy the required landing point.
    if (i % 4 === 2) {
      const side = x > 11 ? 2 : 20;
      platforms.push({ from: side - 1.2, to: side + 1.2, top });
      enemies.push({ kind: i > 10 ? 'sniper' : 'turret', x: side, y: top });
    }
    if (i === 7 || i === 15) enemies.push({ kind: 'drone', x: 16, y: top + 3 });
    if (i === 3 || i === 13) hazards.push({ from: x + 0.6, to: x + 1.8, y: top, kind: 'context' });
  });
  platforms.push(
    { from: 0, to: 22, top: 48, checkpoint: true, solid: true },
    { from: 6, to: 10, top: 50 },
    { from: 14, to: 17, top: 50.7 },
  );
  supplies.push({ x: 8, y: 48.8, kind: 'grenade' }, { x: 11, y: 48.8, kind: 'health' });
  enemies.push({ kind: 'boss', x: 17, y: 48 });
  return {
    length: 22,
    axis: 'vertical',
    height: 60,
    arenaY: 48,
    platforms,
    enemies,
    supplies,
    hazards,
  };
}

function sideRoute(
  index: number,
  length: number,
): Pick<LevelDefinition, 'platforms' | 'enemies' | 'supplies' | 'hazards' | 'sectors'> {
  const platforms: Platform[] = [];
  const enemies: EnemySpawn[] = [];
  const supplies: Supply[] = [];
  const hazards: Hazard[] = [];
  const sectors: LevelDefinition['sectors'] = [];
  const ground = (...spans: [number, number, number?][]) => {
    spans.forEach(([from, to, conveyor]) =>
      platforms.push({ from, to, top: 0, ...(conveyor ? { conveyor } : {}) }),
    );
  };
  const ledges = (...spans: [number, number, number][]) =>
    spans.forEach(([from, to, top]) => platforms.push({ from, to, top }));
  const foes = (kind: EnemyKind, ...places: [number, number][]) =>
    places.forEach(([x, y]) => enemies.push({ kind, x, y }));
  const loot = (kind: Supply['kind'], x: number, y = 0.8) => supplies.push({ kind, x, y });
  const zone = (from: number, title: string, hint: string) => sectors.push({ from, title, hint });
  const fire = (from: number, to: number) => hazards.push({ from, to, kind: 'firewall' });
  if (index === 0) {
    // Beach → optional canopy → short bridge → fortified approach.
    ground([0, 25], [27.5, 56], [59, 80], [83, length]);
    ledges(
      [8, 13.5, 2],
      [19, 23, 1.6],
      [29, 34, 1.8],
      [34, 43, 3.6],
      [46, 50, 2],
      [62, 70, 2],
      [74, 78, 1.6],
    );
    foes('runner', [15, 0], [32, 0], [51, 0], [70, 0]);
    foes('turret', [24, 0], [41, 3.6], [66, 2], [86, 0]);
    foes('drone', [49, 4.8]);
    loot('spread', 5);
    loot('spread', 10, 2.7);
    loot('shield', 37, 4.3);
    loot('rapid', 64, 2.7);
    loot('health', 73);
    loot('grenade', 87);
    zone(0, '01 / 提示词海滩', '先清除步兵；站定按下卧倒，避开炮台平射。');
    zone(28, '02 / 分支推演', '高台有护盾与侧翼射线；地面路线更快，也更暴露。');
    zone(59, '03 / 回执桥头', '起跳越过断桥，跳射高位炮台，再进入限流闸门。');
  } else if (index === 3) {
    // The reliable lower route and the elevated ferry route cross one another.
    ground([0, 19], [22.4, 44], [48, 66], [70.2, 91], [95, 119], [122.8, length]);
    ledges(
      [12, 17, 1.8],
      [26, 31, 1.9],
      [36, 42, 3.8],
      [51, 57, 1.8],
      [62, 67, 3.7],
      [76, 82, 1.8],
      [88, 93, 3.6],
      [101, 107, 1.8],
      [111, 118, 3.8],
    );
    platforms.push(
      { from: 28, to: 33, top: 3.6, motion: { x: 4, y: 0, period: 5 } },
      { from: 72, to: 77, top: 3.7, motion: { x: 4.2, y: 0, period: 5.6 } },
      { from: 99, to: 104, top: 3.7, motion: { x: 0, y: 1.6, period: 4.8 } },
    );
    for (const [from, to] of [
      [19, 22.4],
      [44, 48],
      [66, 70.2],
      [91, 95],
      [119, 122.8],
    ])
      hazards.push({ from: from!, to: to!, kind: 'mirage' });
    foes('runner', [15, 0], [56, 0], [105, 0]);
    foes('sniper', [40, 3.8], [81, 1.8], [115, 3.8]);
    foes('drone', [31, 5.6], [74, 5.3], [105, 6]);
    foes('turret', [61, 0], [112, 0]);
    loot('laser', 5);
    loot('shield', 39, 4.5);
    loot('homing', 65, 4.4);
    loot('health', 78);
    loot('grenade', 89, 4.3);
    loot('spread', 114, 4.5);
    zone(0, '01 / 引用核验', '虚线桥不会承重；射击只能揭穿幻觉，仍需跳过。');
    zone(24, '02 / 浮动引用', '亮紫平台会运送乘客；搭乘高路，绕开地面交叉火力。');
    zone(72, '03 / 来源漂移', '平台与升降台共用真实碰撞；等到接近再起跳。');
  } else if (index === 4) {
    ground(
      [0, 21],
      [21, 38, -2.4],
      [41.5, 61, 2.8],
      [61, 78],
      [82, 103, -2.8],
      [103, 119],
      [122.5, length],
    );
    ledges(
      [13, 18, 1.8],
      [27, 34, 2],
      [47, 53, 2],
      [57, 64, 3.8],
      [68, 73, 2],
      [88, 96, 2],
      [109, 115, 1.8],
    );
    platforms.push({ from: 73, to: 78, top: 2.6, motion: { x: 0, y: 1.5, period: 5.5 } });
    foes('runner', [17, 0], [50, 0], [100, 0]);
    foes('turret', [34, 2], [61, 3.8], [94, 2], [126, 0]);
    foes('hopper', [30, 0], [71, 0], [110, 0]);
    foes('drone', [58, 5.8], [99, 4.8]);
    fire(26, 27.6);
    fire(46, 47.6);
    fire(56, 57.8);
    fire(90, 91.6);
    fire(107, 108.5);
    loot('flame', 5);
    loot('shield', 29, 2.7);
    loot('rapid', 59, 4.5);
    loot('health', 66);
    loot('laser', 92, 2.7);
    loot('grenade', 113, 2.5);
    zone(0, '01 / Token 装配线', '传送带会推动角色，卧倒也会滑动；跳跃可暂时脱离。');
    zone(41.5, '02 / 温度过载', '顺向带把你送向炉口；看预警跳跃，或走上层冷却管。');
    zone(82, '03 / 预算回收', '逆向带减慢推进；清理高台炮位后补充弹药。');
  } else if (index === 6) {
    ground([0, 29], [32.5, 60], [64, 96], [99.8, 129], [133.5, length]);
    ledges(
      [9, 15, 1.8],
      [20, 27, 3.6],
      [35, 40, 1.8],
      [44, 53, 3.7],
      [67, 73, 1.8],
      [78, 88, 3.7],
      [105, 110, 1.8],
      [114, 125, 3.7],
      [138, 143, 2],
    );
    // Elevator offers a protected approach to each fortified upper battery.
    platforms.push(
      { from: 16, to: 20, top: 1.9, motion: { x: 0, y: 1.5, period: 5 } },
      { from: 73.5, to: 78, top: 1.9, motion: { x: 0, y: 1.5, period: 4.6 } },
    );
    foes('sniper', [25, 3.6], [51, 3.7], [86, 3.7], [123, 3.7]);
    foes('turret', [26, 0], [56, 0], [91, 0], [128, 0], [141, 2]);
    foes('hopper', [18, 0], [43, 0], [78, 0], [112, 0], [145, 0]);
    foes('drone', [39, 5], [103, 5.5]);
    fire(47, 48.4);
    fire(81, 82.4);
    fire(118, 119.4);
    loot('laser', 5);
    loot('shield', 23, 4.3);
    loot('homing', 48, 4.4);
    loot('health', 68);
    loot('grenade', 84, 4.4);
    loot('spread', 119, 4.4);
    zone(0, '01 / 第一层拒绝', '升降平台通往狙击台；低路面对重炮，高路获得护盾。');
    zone(34, '02 / 交叉审查', '高低炮位夹击；定点斜射可先拆上层防线。');
    zone(100, '03 / 最终权限', '弹簧怪逼近时保持移动，留一枚手雷突破最后炮组。');
  } else {
    ground(
      [0, 23],
      [26.5, 49],
      [53, 78, 2.3],
      [78, 95],
      [99.2, 121],
      [124.8, 151],
      [154.5, length],
    );
    ledges(
      [10, 16, 2],
      [30, 35, 1.8],
      [39, 46, 3.7],
      [60, 66, 2],
      [71, 77, 3.8],
      [84, 91, 2],
      [105, 112, 1.8],
      [118, 124, 3.7],
      [137, 145, 2],
    );
    platforms.push(
      { from: 32, to: 37, top: 3.5, motion: { x: 4, y: 0, period: 4.8 } },
      { from: 112, to: 117, top: 2, motion: { x: 0, y: 1.6, period: 4.6 } },
    );
    hazards.push({ from: 23, to: 26.5, kind: 'mirage' }, { from: 95, to: 99.2, kind: 'mirage' });
    fire(58, 59.5);
    fire(70, 71.6);
    fire(132, 133.6);
    fire(145, 146.6);
    foes('runner', [18, 0], [58, 0], [102, 0]);
    foes('sniper', [43, 3.7], [75, 3.8], [121, 3.7]);
    foes('turret', [45, 0], [88, 2], [142, 2], [153, 0]);
    foes('hopper', [67, 0], [114, 0], [145, 0]);
    foes('drone', [36, 5], [81, 5.6], [130, 4.8]);
    foes('pod', [54, 0], [101, 0], [145, 2]);
    foes('heart', [164, 0], [169, 3.7], [174, 1.8]);
    loot('homing', 5);
    loot('shield', 42, 4.4);
    loot('laser', 73, 4.5);
    loot('health', 104);
    loot('grenade', 120, 4.4);
    loot('spread', 140, 2.7);
    zone(0, '01 / 幻觉回归', '真假桥与移动平台同时出现；先确认落点。');
    zone(53, '02 / 全量推理', '顺向带、炉口和空中敌机组合；上层管道提供另一条路线。');
    zone(100, '03 / 神经巢穴', '摧毁孵化节点才能封锁幼体并打开终战入口。');
  }
  const checkpoint = platforms.find(
    (p) => !p.motion && !p.conveyor && p.top === 0 && p.from > length * 0.4,
  );
  if (checkpoint) checkpoint.checkpoint = true;
  loot('health', length - 24);
  loot('grenade', length - 21);
  ledges([length - 16, length - 12, 2], [length - 8, length - 5, 2.7]);
  foes('boss', [length - 5, 0]);
  return { platforms, enemies, supplies, hazards, sectors };
}

export const levels: readonly LevelDefinition[] = specs.map((spec, index) => {
  const [title, subtitle, meme, hint, boss, color, sky, length, background] = spec;
  return {
    title,
    subtitle,
    meme,
    hint,
    boss,
    color,
    sky,
    length,
    axis: 'horizontal',
    height: 14,
    arenaY: 0,
    background,
    platforms: [],
    enemies: [],
    supplies: [],
    hazards: [],
    sectors: [],
    carriers:
      index === 2
        ? [
            { kind: 'cache', x: 11, y: 6.8, drop: 'overclock' },
            { kind: 'capsule', x: 7.5, y: 17.7, drop: 'barrier' },
            { kind: 'cache', x: 14.5, y: 28.8, drop: 'purge' },
          ]
        : [1, 5].includes(index)
          ? []
          : [
              { kind: 'cache', x: 8, y: 1, drop: 'overclock' },
              { kind: 'capsule', x: 17, y: 3.1, drop: 'barrier' },
              { kind: 'cache', x: index === 0 ? 63 : 57, y: 1, drop: 'purge' },
              { kind: 'capsule', x: length - 31, y: 3.3, drop: index % 2 ? 'laser' : 'spread' },
            ],
    ...([0, 3, 4, 6, 7].includes(index) ? sideRoute(index, length) : {}),
    ...(index === 2 ? contextTower() : {}),
    ...([1, 5].includes(index)
      ? {
          axis: 'depth' as const,
          length: 22,
          platforms: [{ from: 0, to: 22, top: 0 }],
          enemies: [{ kind: 'boss' as const, x: 11, y: 0 }],
          supplies: [
            { x: 5, y: 0.8, kind: 'spread' as const },
            { x: 17, y: 0.8, kind: 'homing' as const },
          ],
          hazards: [],
        }
      : {}),
  };
});
