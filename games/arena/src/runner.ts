import Matter from 'matter-js';
import { CAMPAIGN, type Room } from './campaign';
import {
  createTrapScene,
  cutFloor,
  overlaps,
  stepTraps,
  trapView,
  type Rect,
  type TrapScene,
  type TrapEffect,
} from './traps';

const { Engine, Bodies, Body, Composite } = Matter;
export const FRAME_MS = 1000 / 60;
export class RoomRunner {
  readonly engine = Engine.create({ gravity: { x: 0, y: 1.4 } });
  readonly player: Matter.Body;
  scene;
  floors: Rect[] = [];
  phase: 'playing' | 'dead' | 'clear' = 'playing';
  secret = false;
  ticks = 0;
  deathTicks = 0;
  facing = 1;
  grounded = false;
  jumpCount = 0;
  deathReason = '';
  landingTicks = 0;
  justLanded = false;
  fuel = 60;
  readonly clones: RoomRunner[] = [];
  arrived = false;
  deathTrap: TrapEffect | 'void' | null = null;
  private solids: Matter.Body[] = [];
  private geometry = '';
  private coyote = 0;
  private jumpBuffer = 0;
  constructor(
    readonly room: Room,
    isClone = false,
  ) {
    this.scene = createTrapScene(room.traps);
    this.player = Bodies.rectangle(room.spawn.x + 16, room.spawn.y + 24, 32, 48, {
      friction: 0,
      frictionStatic: 0,
      frictionAir: 0,
      restitution: 0,
      inertia: Infinity,
    });
    Composite.add(this.engine.world, this.player);
    this.updateFloor();
    this.grounded = this.floors.some(
      (floor) =>
        Math.abs(room.spawn.y + 48 - floor.y) < 1 &&
        room.spawn.x + 32 > floor.x &&
        room.spawn.x < floor.x + floor.w,
    );
    if (!isClone)
      this.clones = (room.cloneSpawns ?? []).map(
        (spawn) => new RoomRunner({ ...room, spawn }, true),
      );
  }
  get rect(): Rect {
    return { x: this.player.position.x - 16, y: this.player.position.y - 24, w: 32, h: 48 };
  }
  get width(): number {
    return this.room.width ?? 1000;
  }
  get secretPoint() {
    const travel = this.room.secretTravel;
    const time = travel ? this.scene.tick / travel.ticks : 0;
    const offset = travel?.loop ? 1 - Math.abs((time % 2) - 1) : Math.min(1, time);
    return {
      x: this.room.secret.x + (travel?.x ?? 0) * offset,
      y: this.room.secret.y + (travel?.y ?? 0) * offset,
      radius: 30 + (this.room.secretGrowth ?? 0) * (0.5 + 0.5 * Math.sin(this.scene.tick / 30)),
    };
  }
  get traps() {
    return this.room.traps.flatMap((trap) => {
      const view = trapView(trap, this.scene);
      return view ? [view] : [];
    });
  }
  get exit(): Rect {
    return (
      this.traps.find((view) => view.trap.effect === 'exit' && view.phase === 'active')?.body ??
      this.room.exit
    );
  }
  get exitReady(): boolean {
    const moving = this.traps.find(
      (view) => view.trap.effect === 'exit' && view.phase === 'active',
    );
    if (!moving?.trap.travel) return true;
    if (moving.trap.travel.loop) return true;
    const started = this.scene.clocks[moving.trap.id]?.triggeredAt;
    return (
      started !== null &&
      started !== undefined &&
      this.scene.tick - started - moving.trap.delay >= moving.trap.travel.ticks
    );
  }
  get speech(): string {
    let latestTick = -1;
    let line = this.room.promise;
    for (const view of this.traps) {
      if (view.phase === 'spent') continue;
      const tick = this.scene.clocks[view.trap.id]?.triggeredAt ?? -1;
      if (tick >= latestTick) {
        latestTick = tick;
        line = view.trap.line;
      }
    }
    return line;
  }
  get jetpack(): boolean {
    return this.traps.some(
      (view) =>
        view.phase === 'active' && view.trap.effect === 'jetpack' && overlaps(this.rect, view.body),
    );
  }
  get groupJetpack(): boolean {
    return this.jetpack || this.clones.some((clone) => clone.jetpack && clone.phase === 'playing');
  }
  triggerActors(horizontal: number, jump: boolean, prefix = 'solo') {
    return [this, ...this.clones].flatMap((actor, index) =>
      actor.phase === 'playing' && !actor.arrived
        ? [{ ...actor.triggerActor(horizontal, jump), id: `${prefix}-${index}` }]
        : [],
    );
  }
  triggerActor(horizontal: number, jump: boolean) {
    const reversed = this.traps.some(
      (view) => view.trap.effect === 'reverse' && view.phase === 'active',
    );
    return {
      ...this.rect,
      landed: this.justLanded,
      jump:
        (jump || this.jumpBuffer > 1) &&
        (this.grounded ||
          this.coyote > 1 ||
          this.traps.some(
            (view) =>
              view.phase === 'active' &&
              view.trap.effect === 'airJump' &&
              overlaps(this.rect, view.body),
          )),
      horizontal: horizontal * (reversed ? -1 : 1),
    };
  }
  private updateFloor() {
    this.floors = cutFloor(
      this.room.floors,
      this.traps
        .filter((view) => view.phase === 'active' && view.trap.effect === 'pit')
        .map((view) => view.body),
    );
    this.floors.push(
      ...this.traps
        .filter(
          (view) => ['platform', 'wall'].includes(view.trap.effect) && view.phase === 'active',
        )
        .map((view) => view.body),
    );
    const signature = JSON.stringify(this.floors);
    if (signature === this.geometry) return;
    this.geometry = signature;
    this.solids.forEach((body) => Composite.remove(this.engine.world, body));
    this.solids = this.floors.map((rect) =>
      Bodies.rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, {
        isStatic: true,
        friction: 0,
        restitution: 0,
      }),
    );
    Composite.add(this.engine.world, this.solids);
  }
  step(horizontal: number, jump: boolean, sharedScene?: TrapScene, thrust = false) {
    if (!this.clones.length || this.phase !== 'playing') {
      this.stepActor(horizontal, jump, sharedScene, thrust);
      return;
    }
    const scene =
      sharedScene ?? stepTraps(this.room.traps, this.scene, this.triggerActors(horizontal, jump));
    this.stepActor(horizontal, jump, scene, thrust);
    const actorPhase = this.phase as RoomRunner['phase'];
    for (const clone of this.clones) clone.step(horizontal, jump, scene, thrust);
    this.secret ||= this.clones.some((clone) => clone.secret);
    if (actorPhase === 'dead') return;
    const lost = this.clones.find((clone) => clone.phase === 'dead');
    if (lost) {
      this.phase = 'dead';
      this.deathReason = `分身：${lost.deathReason}`;
      this.deathTrap = lost.deathTrap;
      return;
    }
    this.arrived ||= actorPhase === 'clear';
    this.phase =
      this.arrived && this.clones.every((clone) => clone.phase === 'clear') ? 'clear' : 'playing';
  }
  private stepActor(horizontal: number, jump: boolean, sharedScene?: TrapScene, thrust = false) {
    const oldFeet = { ...this.rect, y: this.rect.y + 46, h: 5 };
    const riding = this.traps.find(
      (view) =>
        ['platform', 'wall'].includes(view.trap.effect) &&
        view.phase === 'active' &&
        overlaps(oldFeet, view.body) &&
        Math.abs(this.player.velocity.y) < 2,
    );
    if (sharedScene) {
      this.scene = sharedScene;
      this.updateFloor();
    }
    if (this.phase === 'dead') {
      this.deathTicks++;
      return;
    }
    if (this.phase !== 'playing') return;
    if (this.arrived) {
      this.ticks++;
      return;
    }
    const wasGrounded = this.grounded;
    if (this.landingTicks > 0) this.landingTicks--;
    this.ticks++;
    if (!sharedScene)
      this.scene = stepTraps(this.room.traps, this.scene, [this.triggerActor(horizontal, jump)]);
    if (riding) {
      const moved = this.traps.find((view) => view.trap.id === riding.trap.id);
      if (moved?.phase === 'active')
        Body.translate(this.player, {
          x: moved.body.x - riding.body.x,
          y: moved.body.y - riding.body.y,
        });
    }
    this.updateFloor();
    const active = this.traps.filter((view) => view.phase === 'active');
    const reverse = active.some((view) => view.trap.effect === 'reverse');
    const gravity = active.some((view) => view.trap.effect === 'gravity') ? -1 : 1;
    this.engine.gravity.y = 1.4 * gravity;
    const feet = { ...this.rect, y: gravity > 0 ? this.rect.y + 46 : this.rect.y - 3, h: 5 };
    this.grounded =
      this.floors.some((floor) => overlaps(feet, floor)) && Math.abs(this.player.velocity.y) < 2;
    this.justLanded = this.grounded && !wasGrounded && this.ticks > 1;
    if (this.justLanded) this.landingTicks = 6;
    if (this.grounded) this.fuel = 60;
    this.coyote = this.grounded ? 5 : Math.max(0, this.coyote - 1);
    this.jumpBuffer = jump ? 6 : Math.max(0, this.jumpBuffer - 1);
    const dx = Number.isFinite(horizontal) ? Math.max(-1, Math.min(1, horizontal)) : 0;
    const zoneEffects = active.filter((view) => overlaps(this.rect, view.body));
    const ice = zoneEffects.some((view) => view.trap.effect === 'ice');
    const wind = zoneEffects.some((view) => view.trap.effect === 'wind');
    let vx = dx * 4.5 * (reverse ? -1 : 1);
    if (ice)
      vx = Math.max(-6, Math.min(6, this.player.velocity.x * 0.9 + dx * (reverse ? -0.6 : 0.6)));
    if (wind) vx -= 2;
    if (vx) this.facing = Math.sign(vx);
    let vy = this.player.velocity.y;
    const bounce =
      this.grounded &&
      active.some((view) => view.trap.effect === 'bounce' && overlaps(feet, view.body));
    const airJump = zoneEffects.some((view) => view.trap.effect === 'airJump');
    if (bounce || (this.jumpBuffer && this.coyote) || (jump && airJump)) {
      this.jumpCount++;
      const strength = bounce
        ? 14
        : zoneEffects.some((view) => view.trap.effect === 'lowJump')
          ? 7.5
          : 10.5;
      vy = -strength * gravity;
      this.coyote = this.jumpBuffer = 0;
      this.grounded = false;
    }
    if (this.jetpack && (jump || thrust) && this.fuel > 0) {
      vy = gravity > 0 ? Math.max(-7, vy - 0.85) : Math.min(7, vy + 0.85);
      this.fuel--;
      this.grounded = false;
    }
    Body.setVelocity(this.player, { x: vx, y: vy });
    Engine.update(this.engine, FRAME_MS);
    Body.setPosition(this.player, {
      x: Math.max(16, Math.min(this.width - 16, this.player.position.x)),
      y: this.player.position.y,
    });
    const rect = this.rect;
    const hit = active.find(
      (view) =>
        ['spikes', 'falling', 'saw', 'gate', 'decoy', 'mine', 'seeker'].includes(
          view.trap.effect,
        ) &&
        (['mine', 'seeker', 'saw'].includes(view.trap.effect)
          ? Math.hypot(
              view.body.x +
                view.body.w / 2 -
                Math.max(rect.x, Math.min(rect.x + rect.w, view.body.x + view.body.w / 2)),
              view.body.y +
                view.body.h / 2 -
                Math.max(rect.y, Math.min(rect.y + rect.h, view.body.y + view.body.h / 2)),
            ) <
            view.body.w / 2
          : overlaps(rect, view.body)),
    );
    if (rect.y > 440 || rect.y < -100 || hit) {
      const pit = active.find(
        (view) =>
          view.trap.effect === 'pit' &&
          rect.x + rect.w > view.body.x &&
          rect.x < view.body.x + view.body.w,
      );
      this.deathTrap = hit?.trap.effect ?? pit?.trap.effect ?? 'void';
      this.deathReason =
        hit?.trap.line ??
        active.find(
          (view) =>
            view.trap.effect === 'pit' &&
            rect.x + rect.w > view.body.x &&
            rect.x < view.body.x + view.body.w,
        )?.trap.line ??
        '跑出了上下文窗口。';
      this.phase = 'dead';
      return;
    }
    if (
      Math.hypot(rect.x + 16 - this.secretPoint.x, rect.y + 24 - this.secretPoint.y) <
      this.secretPoint.radius
    )
      this.secret = true;
    if (this.exitReady && overlaps(rect, this.exit)) this.phase = 'clear';
  }
  dispose() {
    this.clones.forEach((clone) => clone.dispose());
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}

export function openRoom(index: number): RoomRunner {
  const room = CAMPAIGN[index];
  if (!room) throw new Error(`Unknown room: ${index}`);
  return new RoomRunner(room);
}
