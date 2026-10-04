import type { RoomRunner } from '../src/runner';
export type RouteDriver = Pick<RoomRunner, 'rect' | 'phase' | 'traps' | 'grounded' | 'step'>;

function tick(run: RouteDriver, direction = 0, jump = false) {
  const reversed = run.traps.some(
    (view) => view.trap.effect === 'reverse' && view.phase === 'active',
  );
  run.step(direction * (reversed ? -1 : 1), jump);
}
export function move(run: RouteDriver, target: number, jump = false) {
  const direction = Math.sign(target - run.rect.x);
  if (jump) tick(run, direction, true);
  for (
    let frames = 0;
    frames < 500 &&
    run.phase === 'playing' &&
    (direction > 0 ? run.rect.x < target : run.rect.x > target);
    frames++
  )
    tick(run, direction);
}
function land(run: RouteDriver) {
  for (let frame = 0; frame < 180 && run.phase === 'playing'; frame++) {
    tick(run);
    if (run.grounded) return;
  }
}
function hop(run: RouteDriver) {
  tick(run, 0, true);
  for (let i = 0; i < 65; i++) tick(run);
}
function gate(run: RouteDriver, id: string, approach: number) {
  move(run, approach);
  for (let i = 0; i < 400 && run.phase === 'playing'; i++) {
    if (run.traps.find((view) => view.trap.id === id)?.phase === 'spent') return;
    tick(run);
  }
}
function saw(run: RouteDriver, target = 950) {
  for (let i = 0; i < 500 && run.phase === 'playing' && run.rect.x < target; i++) {
    const hazard = run.traps.find((view) => view.trap.effect === 'saw');
    const jump =
      !!hazard && run.grounded && hazard.body.x > run.rect.x && hazard.body.x - run.rect.x < 100;
    tick(run, 1, jump);
  }
}

export const SECRET_ROUTES: ((run: RouteDriver) => void)[] = [
  (r) => {
    move(r, 250);
    move(r, 480, true);
    land(r);
    hop(r);
    move(r, 950);
  },
  (r) => {
    move(r, 240);
    move(r, 395, true);
    land(r);
    move(r, 410);
    move(r, 650, true);
    move(r, 950);
  },
  (r) => {
    move(r, 230);
    move(r, 480, true);
    land(r);
    hop(r);
    move(r, 495);
    move(r, 740, true);
    move(r, 950);
  },
  (r) => {
    move(r, 480);
    hop(r);
    move(r, 850);
    move(r, 650);
    move(r, 400, true);
    move(r, 180);
  },
  (r) => {
    move(r, 480);
    hop(r);
    move(r, 725, true);
    move(r, 950);
  },
  (r) => {
    move(r, 300);
    for (let i = 0; i < 70; i++) tick(r);
    move(r, 480);
    hop(r);
    move(r, 950);
  },
  (r) => {
    move(r, 480);
    hop(r);
    move(r, 610);
    move(r, 850, true);
    move(r, 950);
  },
  (r) => {
    move(r, 230);
    move(r, 395, true);
    land(r);
    move(r, 425);
    move(r, 630, true);
    land(r);
    move(r, 655);
    move(r, 910, true);
    move(r, 950);
  },
];
SECRET_ROUTES.push(
  (r) => {
    move(r, 340);
    move(r, 590, true);
    move(r, 950);
  },
  (r) => {
    gate(r, 'quota', 370);
    move(r, 690);
    hop(r);
    move(r, 950);
  },
  (r) => {
    move(r, 950);
    for (let i = 0; i < 180; i++) tick(r);
  },
  (r) => {
    move(r, 200);
    move(r, 440, true);
    land(r);
    for (let i = 0; i < 400 && r.rect.x < 505 && r.phase === 'playing'; i++) tick(r);
    move(r, 660, true);
    land(r);
    move(r, 950, true);
  },
  (r) => {
    move(r, 220);
    move(r, 475, true);
    land(r);
    hop(r);
    saw(r);
  },
  (r) => {
    gate(r, 'free', 240);
    move(r, 480);
    hop(r);
    gate(r, 'paid', 590);
    move(r, 950);
  },
  (r) => {
    move(r, 425);
    move(r, 950, true);
    for (let i = 0; i < 180; i++) tick(r);
  },
  (r) => {
    saw(r, 510);
    land(r);
    hop(r);
    gate(r, 'bench-gate', 610);
    move(r, 950);
  },
  (r) => {
    move(r, 410);
    move(r, 950, true);
  },
  (r) => {
    move(r, 710);
    hop(r);
    move(r, 950);
  },
  (r) => {
    move(r, 535);
    hop(r);
    move(r, 800);
    move(r, 675);
    move(r, 425, true);
    move(r, 180);
  },
  (r) => {
    move(r, 225);
    move(r, 485, true);
    land(r);
    move(r, 660);
    hop(r);
    move(r, 950);
  },
  (r) => {
    move(r, 150);
    move(r, 250, true);
    land(r);
    move(r, 280);
    move(r, 435, true);
    land(r);
    move(r, 465);
    move(r, 640, true);
    land(r);
    hop(r);
    move(r, 685);
    move(r, 950, true);
  },
  (r) => {
    move(r, 480);
    move(r, 950, true);
  },
  (r) => {
    move(r, 320);
    for (let i = 0; i < 400; i++) {
      if (r.traps.find((view) => view.trap.effect === 'platform')!.body.y > 290) break;
      tick(r);
    }
    move(r, 465, true);
    land(r);
    for (let i = 0; i < 400 && r.rect.y > 185; i++) tick(r);
    hop(r);
    land(r);
    for (let i = 0; i < 400 && r.rect.y > 195; i++) tick(r);
    move(r, 720, true);
    land(r);
    move(r, 950);
  },
  (r) => {
    move(r, 240);
    move(r, 470, true);
    land(r);
    move(r, 530);
    hop(r);
    gate(r, 'release-gate', 650);
    move(r, 950);
  },
);
SECRET_ROUTES.push(
  (r) => {
    move(r, 475);
    move(r, 850, true);
    move(r, 950);
  },
  (r) => {
    move(r, 300);
    move(r, 480, true);
    land(r);
    move(r, 590);
    hop(r);
    move(r, 640);
    move(r, 850, true);
    move(r, 950);
  },
  (r) => {
    move(r, 550);
    land(r);
    move(r, 610);
    move(r, 850, true);
    move(r, 950);
  },
  (r) => {
    move(r, 440);
    move(r, 750, true);
    move(r, 950);
  },
  (r) => {
    move(r, 480);
    move(r, 950, true);
  },
  (r) => {
    move(r, 550);
    move(r, 750, true);
    land(r);
    move(r, 790);
    hop(r);
    move(r, 950);
  },
  (r) => {
    move(r, 550);
    land(r);
    move(r, 615);
    move(r, 680, true);
    land(r);
    gate(r, 'queue-gate', 680);
    move(r, 950);
  },
  (r) => {
    move(r, 520);
    move(r, 750, true);
    land(r);
    gate(r, 'soup-quota', 775);
    move(r, 950);
  },
);
SECRET_ROUTES.push(
  (r) => {
    move(r, 230);
    move(r, 480, true);
    land(r);
    hop(r);
    gate(r, 'tool-quota', 500);
    move(r, 700);
    for (let i = 0; i < 70; i++) tick(r);
    move(r, 950);
  },
  SECRET_ROUTES[22]!,
  (r) => {
    move(r, 480);
    hop(r);
    move(r, 850);
    move(r, 760);
    move(r, 520, true);
    land(r);
    gate(r, 'agent-quota', 535);
    move(r, 170);
  },
  SECRET_ROUTES[11]!,
  SECRET_ROUTES[14]!,
  (r) => {
    move(r, 540);
    move(r, 950, true);
  },
  (r) => {
    gate(r, 'safe-quota', 350);
    move(r, 590);
    hop(r);
    move(r, 700);
    move(r, 950, true);
  },
  (r) => {
    move(r, 180);
    move(r, 370, true);
    land(r);
    move(r, 410);
    move(r, 590, true);
    land(r);
    move(r, 780, true);
    land(r);
    gate(r, 'final-quota', 780);
    move(r, 950);
  },
);
SECRET_ROUTES.push(
  (r) => {
    move(r, 160);
    move(r, 280, true);
    land(r);
    move(r, 320);
    move(r, 570, true);
    land(r);
    move(r, 630);
    hop(r);
    move(r, 950);
  },
  (r) => {
    move(r, 200);
    for (let i = 0; i < 160 && r.rect.x < 525 && r.phase === 'playing'; i++)
      tick(r, 1, i % 25 === 0);
    for (let i = 0; i < 70; i++) tick(r, 0, i % 25 === 0);
    for (let i = 0; i < 160 && r.rect.x < 905 && r.phase === 'playing'; i++)
      tick(r, 1, i % 25 === 0);
    land(r);
  },
  (r) => {
    move(r, 170);
    for (let i = 0; i < 250 && r.rect.x < 740 && r.phase === 'playing'; i++)
      tick(r, 1, r.rect.y > 170);
    land(r);
    move(r, 780);
    for (let i = 0; i < 80; i++) tick(r, 0, i < 20);
    move(r, 950);
  },
);
SECRET_ROUTES.push(
  (r) => {
    move(r, 470);
    move(r, 750, true);
    move(r, 950);
  },
  (r) => {
    let jumped = false;
    for (let i = 0; i < 500 && r.phase === 'playing'; i++) {
      const projectile = r.traps.find((view) => view.trap.effect === 'seeker');
      const jump =
        !jumped &&
        r.grounded &&
        !!projectile &&
        projectile.phase === 'active' &&
        projectile.body.x - r.rect.x < 130;
      if (jump) jumped = true;
      tick(r, 1, jump);
    }
  },
);
SECRET_ROUTES.push((r) => {
  move(r, 250);
  move(r, 500, true);
  land(r);
  move(r, 535);
  move(r, 780, true);
  land(r);
  gate(r, 'long-gate', 830);
  move(r, 1100);
  for (let i = 0; i < 65; i++) tick(r);
  for (let i = 0; i < 250 && r.rect.x < 1650 && r.phase === 'playing'; i++) {
    const blade = r.traps.find((view) => view.trap.id === 'long-saw');
    tick(r, 1, r.grounded && !!blade && blade.body.x > r.rect.x && blade.body.x - r.rect.x < 100);
  }
  land(r);
  move(r, 1750);
  move(r, 1970, true);
  land(r);
  move(r, 2020);
  move(r, 2250, true);
  move(r, 2450);
});
SECRET_ROUTES.push(
  (r) => {
    move(r, 240);
    move(r, 490, true);
    land(r);
    move(r, 530);
    move(r, 760, true);
    land(r);
    move(r, 850);
    for (let i = 0; i < 70; i++) tick(r);
    move(r, 1405);
    move(r, 1660, true);
    land(r);
    gate(r, 'w1-gate', 1780);
    move(r, 2250);
  },
  (r) => {
    move(r, 490);
    move(r, 740, true);
    land(r);
    gate(r, 'w2-gate', 840);
    move(r, 1300);
    move(r, 1480, true);
    land(r);
    move(r, 1510);
    hop(r);
    move(r, 1580);
    move(r, 1800, true);
    land(r);
    move(r, 1930);
    for (let i = 0; i < 70; i++) tick(r);
    move(r, 2450);
  },
);
SECRET_ROUTES.push(
  (r) => {
    move(r, 200);
    move(r, 410, true);
    land(r);
    move(r, 690, true);
    move(r, 950);
  },
  (r) => {
    move(r, 330);
    hop(r);
    move(r, 525);
    move(r, 770, true);
    move(r, 950);
  },
  (r) => {
    move(r, 240);
    move(r, 355, true);
    land(r);
    for (let i = 0; i < 70; i++) tick(r);
    move(r, 695);
    hop(r);
    move(r, 785);
    move(r, 950, true);
    land(r);
  },
  (r) => {
    move(r, 200);
    move(r, 410, true);
    land(r);
    move(r, 655, true);
    land(r);
    move(r, 930, true);
    land(r);
    move(r, 950);
  },
  (r) => {
    move(r, 200);
    move(r, 410, true);
    land(r);
    move(r, 700, true);
    land(r);
    move(r, 795);
    move(r, 950, true);
    land(r);
  },
);
