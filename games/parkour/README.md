# Parkour Vue Prototype

This package exports a Vue game through `GameDefinition`. The fixed-step rules were imported
from `feat/parkour` at commit `5d6268f`, without merging other branch changes.
`rules/adventure.ts` implements a short Answer Generation Center shift: double jump, fast fall,
rice detours, timed tail returns, automatic parry slow motion, charged whale bursts, moving request
queues, a context shield and verifiable hallucinations. The three actions are jump, slide and tail.
The authored 480m course lives in `config/shift.ts`; deterministic pilots target 45–60 seconds.
There are no mid-run reading stops. Retries skip the initial one-line exchange.
The original base rules remain separately testable. The previous ocean story and character roster
are replaced, not offered as a parallel game mode.

The Web entry is `/#/games/parkour`, titled 大肥鱼跑酷：答案马上就到.
Keyboard, touch buttons and pointer gestures are supported.
Game art is previewed only during development; production uses original geometric placeholders.
No Phaser dependency or manual game-mount compatibility layer is introduced.
See `docs/games/parkour.md` at the repository root for gameplay and current limits.

## API

```ts
import { FIXED_DT, restart, start, step } from '@moecore/game-parkour/rules';

let run = start(123);
run = step(run, { jump: true, crouch: false }, FIXED_DT);
if (run.status === 'ended') {
  const { distance, score, reason } = run.result;
  void [distance, score, reason];
}
run = restart(run); // Same seed by default; restart(run, 0) selects a new seed.
```

`start` returns tick zero. One `step` accepts exactly `FIXED_DT = 1 / 60` second; other values,
including zero and non-finite values, throw. The host must convert elapsed time to fixed ticks.
Pausing means not calling `step`; wall-clock time never enters the rules.

This API describes the base simulation, whose default finish remains 1200m. The Vue game uses
`beginAdventure` and `advanceAdventure`, sets `finishDistance` to 480m and supplies an authored
course. Energy, slow motion, printers and answer pickup do not apply to base `step`.
Real ticks and world ticks separate ability time from slowed motion. No second physics engine
or old UI compatibility mode is introduced.

States, inputs, obstacle lists, and RNG state are immutable values. Functions do not mutate
arguments or shared state. Callers must treat returned state as read-only. The supported run-state
boundary is `start`, `step`, and `restart`, not arbitrary unvalidated JSON save data.

Distances and sizes are in meters; velocities are in meters/second. Distance is the player's
left edge in world space; `y` is the bottom of the player, positive upwards, with ground at zero.

## Rules

- Standing box: 0.6 by 1.8. Crouching box: 0.6 by 0.8, with unchanged feet position.
- A new jump press on the ground starts at 9 m/s. Gravity is 24 m/s squared, integrated with
  semi-implicit Euler. Ground contact clamps both height and downward velocity to zero.
- Held jump does not repeat. Airborne jump presses do not double-jump or buffer a landing jump.
  Crouch wins simultaneous grounded inputs. Airborne crouch does not alter the box; holding it
  applies on the first tick that starts grounded after landing.
- Ground obstacles: width 0.8, height 0.6. Air obstacles: width 0.8, bottom 1, top 5.
  Ground obstacles require enough jump clearance; air obstacles require crouching while grounded.
- Posture changes at the start of a tick; `classifyObstacle` uses the target frame's posture.
  Movement within that tick is the line segment between
  integrated endpoints. Swept AABB checks that segment, including descending onto an obstacle;
  collision ends the run at the first contact fraction, without counting the rest of the tick.
  A blocked instantaneous stand-up ends the run while preserving the last legal player pose.
  Pure edge touching is not positive-area intersection. Jump/duck success is emitted once, only
  after the player's back crosses the obstacle's trailing edge without collision.
- `events` belongs to the returned tick. Terminal calls return the same state, including its last
  events and result. Consumers must not process the same tick's events repeatedly.
- Score is `floor(distance * 10)`; clearing obstacles gives no additional points.
- Speed is `min(12, 6 + distance * 0.015)`, using the previous state's speed for each full tick.
  The cap is reached at 400 meters. A course finishes at exactly 1,200 meters; other end reasons
  are `ground-collision` and `air-collision`. Collision takes precedence at a tied finish fraction.

## Generation and Balance

The package-local 32-bit LCG uses an explicit unsigned integer state; seeds range from 0 through
4,294,967,295, including zero. It is for reproducible gameplay, not security. Keeping this small
implementation local avoids game-to-game dependencies and a speculative shared package. It is
not copied or imported from match3.

The first obstacle starts at 18 meters. A 60-meter lookahead stores only nearby obstacles; passed
obstacles are removed. Each obstacle consumes two random values, for type and spacing. Spacing
uses speed at that obstacle's world distance, so generating in batches does not change the course.

The edge-to-edge gap is at least 12.6 meters, plus seeded variation. Subtracting the player's
0.6-meter width leaves at least one second between collision windows even at 12 m/s. At higher
speeds the target gap also grows with speed. The continuous jump flight is 0.75 seconds (the
fixed-step flight is slightly shorter), leaving at least 0.25 seconds of recovery margin.
Obstacle traversal at the slowest speed takes about 0.233 seconds, well inside the jump's clearance
window. The air obstacle ceiling cannot be jumped over with these parameters.

The two-times-initial-speed cap is a conservative prototype choice, supported by deterministic
clearance and 512 seeded full-course simulations, not human playtesting. The finite course is
intentional: it exercises over 3,900 ticks at the cap and guarantees a finite result even with
correct input. Generation also rejects horizons beyond the course plus lookahead.

## Verification

From the worktree root:

```text
pnpm --filter @moecore/game-parkour test
pnpm run check
pnpm build
```

Tests cover golden input/output traces, complete recorded replays, local RNG vectors, batched
generation, spacing, jump/crouch successes, late jumps, swept collisions, scoring, capped speed,
terminal behavior, and fresh restarts. All 512 seeds are simulated both with a deterministic pilot
and with scripted input, with per-tick finite-value and penetration checks and a hard test-step
budget. Pure-rule tests require no browser or images; the Web suite separately exercises input,
pause, replay, settlement and switching between parkour and match3.
