import type { Enemy, Pickup, Platform, Trap } from './rules';

export interface LevelDefinition {
  readonly title: string;
  readonly hint: string;
  readonly platforms: readonly Platform[];
  readonly enemies: readonly Enemy[];
  readonly pickups: readonly Pickup[];
  readonly traps: readonly Trap[];
  readonly goal: 'exit' | 'boss';
  readonly sky: string;
}

const floor = (from: number, to: number): Platform => ({ from, to, top: 0 });
const ledge = (from: number, to: number): Platform => ({ from, to, top: 2.1 });
const star = (x: number): Pickup => ({ x, y: 2.8, collected: false });
const contextTrap = (x: number): Trap => ({
  kind: 'context',
  from: x - 0.45,
  to: x + 0.45,
  triggered: false,
  verified: false,
});
const mirage = (from: number, to: number): Trap => ({
  kind: 'mirage',
  from,
  to,
  triggered: false,
  verified: false,
});
const walker = (x: number, minX: number, maxX: number): Enemy => ({
  kind: 'walker',
  x,
  y: 0,
  hp: 1,
  maxHp: 1,
  minX,
  maxX,
  direction: -1,
  shotCooldown: 0,
  shotsFired: 0,
  alive: true,
  guarded: false,
  lastHitVolley: -1,
});
const turret = (x: number, cooldown = 1.3, guarded = false): Enemy => ({
  kind: 'turret',
  x,
  y: 0,
  hp: 2,
  maxHp: 2,
  minX: x,
  maxX: x,
  direction: -1,
  shotCooldown: cooldown,
  shotsFired: 0,
  alive: true,
  guarded,
  lastHitVolley: -1,
});
const boss = (x: number): Enemy => ({
  kind: 'boss',
  x,
  y: 0,
  hp: 8,
  maxHp: 8,
  minX: x,
  maxX: x,
  direction: -1,
  shotCooldown: 1,
  shotsFired: 0,
  alive: true,
  guarded: true,
  lastHitVolley: -1,
});

export const levels: readonly LevelDefinition[] = [
  {
    title: '第一关 · 开机热身',
    hint: '练习跳跃与射击。两次能力选择会决定后面的应对方式。',
    platforms: [
      floor(0, 10),
      floor(11, 20),
      floor(21, 34),
      ledge(5, 8),
      ledge(15, 18),
      ledge(25, 28),
    ],
    enemies: [walker(7.2, 6.3, 8.7), walker(18.4, 17.2, 19.4), turret(25)],
    pickups: [star(6.5), star(16.5), star(26.5)],
    traps: [],
    goal: 'exit',
    sky: '#334469',
  },
  {
    title: '第二关 · 已读走廊',
    hint: '炮台“已读不回”：先躲回执弹，等它开火后护盾松动再反击。',
    platforms: [
      floor(0, 8),
      floor(9, 18),
      floor(19, 27),
      floor(28, 34),
      ledge(3, 6),
      ledge(12, 15),
      ledge(22, 25),
    ],
    enemies: [
      walker(5.4, 4.3, 7.1),
      turret(13, 0.9, true),
      turret(23, 0.8, true),
      walker(30, 29, 32),
    ],
    pickups: [star(4.5), star(13.5), star(23.5)],
    traps: [],
    goal: 'exit',
    sky: '#354770',
  },
  {
    title: '第三关 · 上下文高路',
    hint: '地面有“上下文过期”区，会清空护盾；走高路收集星星可绕开。',
    platforms: [
      floor(0, 6),
      floor(7, 15),
      floor(16, 24),
      floor(25, 34),
      ledge(3, 6),
      ledge(10, 13),
      ledge(18, 21),
      ledge(27, 30),
    ],
    enemies: [
      walker(4.5, 3.5, 5.7),
      walker(11, 9.5, 13.5),
      turret(20, 0.9, true),
      turret(28, 0.7, true),
    ],
    pickups: [star(4.5), star(11.5), star(19.5), star(28.5)],
    traps: [contextTrap(11.5), contextTrap(19.5)],
    goal: 'exit',
    sky: '#425372',
  },
  {
    title: '第四关 · 弹幕加班',
    hint: '“需求追加”让缺口变宽、回信变快；低弹要跳，高弹留在地面。',
    platforms: [
      floor(0, 8.5),
      floor(10.5, 16.2),
      floor(18.3, 24),
      floor(26.2, 34),
      ledge(4, 7),
      ledge(13, 16),
      ledge(21, 24),
      ledge(28, 31),
    ],
    enemies: [
      turret(6, 0.6, true),
      walker(13, 11, 15),
      turret(20, 0.7, true),
      walker(23, 21.5, 23.8),
      turret(29, 0.6, true),
    ],
    pickups: [star(5.5), star(14.5), star(22.5), star(29.5)],
    traps: [],
    goal: 'exit',
    sky: '#514869',
  },
  {
    title: '第五关 · 幻觉大王',
    hint: '“未核验”的桥可能不存在；射击核查。大王每次回话只露一次破绽。',
    platforms: [
      floor(0, 9.5),
      floor(12, 20.5),
      floor(23, 34),
      ledge(5, 8),
      ledge(15, 18),
      ledge(25, 28),
    ],
    enemies: [
      walker(7.2, 6.3, 8.7),
      turret(15, 1.0, true),
      walker(18.4, 17.2, 19.4),
      turret(25, 0.9, true),
      boss(30.2),
    ],
    pickups: [star(6.5), star(16.5), star(26.5)],
    traps: [mirage(9.5, 12), mirage(20.5, 23)],
    goal: 'boss',
    sky: '#5a3d6e',
  },
];
