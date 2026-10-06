import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page, name: string, practice = false) {
  await page.clock.install();
  await page.goto('/#/games/stardust');
  await page.getByRole('button', { name: practice ? /练习模式/ : /双人格斗/ }).click();
  await page
    .getByRole('group', { name: '玩家一选择角色' })
    .getByRole('button', { name: new RegExp(name) })
    .click();
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: '确认选择' }).click();
  await page.getByTestId('stardust-start').click();
  await expect(page.getByTestId('stardust-intro')).toBeHidden({ timeout: 6500 });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  for (const label of ['角色语音', '打击音效', '待机环境声'])
    await page.getByLabel(label).uncheck();
  await page.getByTestId('stardust-arena').click();
}

async function approach(page: Page) {
  const x = async (side: string) =>
    page
      .getByTestId(`stardust-${side}`)
      .evaluate((node) => Number.parseFloat((node as HTMLElement).style.left));
  for (let frame = 0; frame < 80; frame++) {
    const difference = (await x('p2')) - (await x('p1'));
    if (Math.abs(difference) <= 1.5) return;
    const key = difference > 0 ? 'KeyD' : 'KeyA';
    await page.keyboard.down(key);
    await page.clock.runFor(16);
    await page.keyboard.up(key);
  }
  throw new Error('Could not approach the barrage target');
}

async function chargeUltimate(page: Page) {
  await page.getByTestId('stardust-arena').click();
  for (let n = 0; n < 6; n++) {
    await approach(page);
    await page.keyboard.press('KeyK');
    await page.clock.runFor(432);
  }
}

for (const [hero, name] of [
  ['jotaro', '空条承太郎'],
  ['kakyoin', '花京院典明'],
  ['avdol', '阿布德尔'],
  ['polnareff', '波鲁那雷夫'],
]) {
  test(`${hero} has gated lethal ultimate, pauses correctly, and resets between rounds`, async ({
    page,
  }, info) => {
    await enter(page, name!);
    const caster = page.getByTestId('stardust-p1');
    const target = page.getByTestId('stardust-p2');
    const control = page.getByTestId('stardust-ultimate-p1');
    await expect(caster).toHaveAttribute('data-hp', '500');
    await expect(target).toHaveAttribute('data-hp', '500');
    await expect(control).toBeDisabled();
    await page.keyboard.press('KeyI');
    await expect(page.getByTestId(`stardust-ultimate-fx-${hero}`)).toHaveCount(0);
    await chargeUltimate(page);
    await expect(caster).toHaveAttribute('data-energy', '100');
    await control.click();
    const fx = page.getByTestId(`stardust-ultimate-fx-${hero}`);
    await expect(fx).toHaveAttribute('data-stage', 'startup');
    await expect(caster).toHaveAttribute('data-energy', '0');
    await page.clock.runFor(320);
    await page
      .getByTestId('stardust-arena')
      .screenshot({ path: info.outputPath(`${hero}-startup.png`) });
    if (hero === 'polnareff')
      await expect(page.getByTestId('stardust-chariot-chest-burst')).toHaveCSS(
        'background-image',
        /upper-burst-v5/,
      );
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    const hp = await target.getAttribute('data-hp');
    const cooldown = await caster.getAttribute('data-ultimate-cd');
    await page.clock.runFor(2000);
    await expect(target).toHaveAttribute('data-hp', hp!);
    await expect(caster).toHaveAttribute('data-ultimate-cd', cooldown!);
    await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    await page.clock.runFor(800);
    if (hero === 'kakyoin') {
      await expect(fx).toHaveAttribute('data-stage', 'armed');
      await page.clock.runFor(2000);
      await expect(target).toHaveAttribute('data-hp', hp!);
      await page.keyboard.down('ArrowLeft');
      await page.clock.runFor(32);
      await page.keyboard.up('ArrowLeft');
      await expect(fx).toHaveAttribute('data-stage', 'strike');
    }
    await page
      .getByTestId('stardust-arena')
      .screenshot({ path: info.outputPath(`${hero}-strike.png`) });
    if (hero === 'jotaro') {
      await page.clock.runFor(4200);
      await expect(fx).toHaveAttribute('data-stage', 'strike');
      await expect(page.getByTestId('stardust-jotaro-finisher')).toBeVisible();
      await page
        .getByTestId('stardust-arena')
        .screenshot({ path: info.outputPath('jotaro-finisher.png') });
      expect(Number(await target.getAttribute('data-hp'))).toBeGreaterThan(0);
      await page.clock.runFor(250);
    } else if (hero === 'polnareff') {
      await page.clock.runFor(3700);
      await expect(fx).toHaveAttribute('data-stage', 'strike');
      await expect(page.getByTestId('stardust-chariot-finisher')).toBeVisible();
      expect(Number(await target.getAttribute('data-hp'))).toBeGreaterThan(0);
      await page
        .getByTestId('stardust-arena')
        .screenshot({ path: info.outputPath('polnareff-finisher.png') });
      await page.clock.runFor(250);
    } else {
      await page.clock.runFor(1500);
    }
    await expect(page.getByTestId('stardust-game')).toHaveAttribute('data-phase', 'round-break');
    await expect(target).toHaveAttribute('data-hp', '0');
    await expect(page.getByTestId('stardust-score')).toContainText('P1 1 : 0 P2');
    await expect(fx).toHaveCount(0);
    await page.clock.runFor(1800);
    await expect(target).toHaveAttribute('data-hp', '500');
    await expect(caster).toHaveAttribute('data-ultimate-cd', '0');
    await expect(caster).toHaveAttribute('data-energy', '30');
  });
}

test('ordinary barrage deals at most half of 500 HP and cannot end the first round', async ({
  page,
}) => {
  await enter(page, '空条承太郎');
  await approach(page);
  await page.keyboard.press('KeyU');
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '485');
  await expect(page.getByTestId('stardust-attack-fx-jotaro')).toBeVisible();
  await page.clock.runFor(10032);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '250');
  await expect(page.getByTestId('stardust-p1')).toHaveAttribute('data-hp', '500');
  await expect(page.getByTestId('stardust-score')).toContainText('P1 0 : 0 P2');
  await page.clock.runFor(1000);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '250');
});

test('practice dummy revival cannot inherit a completed ultimate across pause', async ({
  page,
}) => {
  await enter(page, '阿布德尔', true);
  await chargeUltimate(page);
  await page.getByTestId('stardust-ultimate-p1').click();
  await page.clock.runFor(2000);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '0');
  await expect(page.getByTestId('stardust-ultimate-fx-avdol')).toHaveCount(0);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.clock.runFor(2000);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(2000);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '500');
  await expect(page.getByTestId('stardust-ultimate-fx-avdol')).toHaveCount(0);
});

test('Jotaro ultimate reuses full ORA clips, pauses them and stops at the final punch', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    const clips: HTMLMediaElement[] = [];
    const timers = new Map<HTMLMediaElement, number>();
    Object.assign(window, { ultimateVoiceAudit: { calls, clips } });
    HTMLMediaElement.prototype.play = function () {
      if (!clips.includes(this)) {
        clips.push(this);
        Object.defineProperty(this, 'paused', { get: () => !timers.has(this) });
      }
      calls.push(new URL(this.src).pathname);
      timers.set(
        this,
        window.setTimeout(() => {
          timers.delete(this);
          this.dispatchEvent(new Event('ended'));
        }, 2400),
      );
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      window.clearTimeout(timers.get(this));
      timers.delete(this);
    };
  });
  await enter(page, '空条承太郎');
  await page.getByLabel('角色语音').check();
  await chargeUltimate(page);
  const audio = () =>
    page.evaluate(() => {
      const audit = (
        window as unknown as {
          ultimateVoiceAudit: {
            calls: string[];
            clips: HTMLMediaElement[];
          };
        }
      ).ultimateVoiceAudit;
      return {
        calls: audit.calls,
        stopped: audit.clips.every((clip) => clip.paused && clip.currentTime === 0),
      };
    });
  await page.getByTestId('stardust-ultimate-p1').click();
  await page.clock.runFor(700);
  expect((await audio()).calls).toEqual(['/audio/stardust/jotaro-ora.wav']);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  expect((await audio()).stopped).toBe(true);
  await page.clock.runFor(2000);
  expect((await audio()).calls).toHaveLength(1);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(3000);
  expect((await audio()).calls.length).toBeGreaterThanOrEqual(3);
  expect((await audio()).calls.every((src) => src === '/audio/stardust/jotaro-ora.wav')).toBe(true);
  await page.clock.runFor(2500);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '0');
  expect((await audio()).stopped).toBe(true);
});

test('Silver Chariot plays selected light and heavy recordings with pause and mute support', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const cues: { sample: 'light' | 'heavy'; rate: number }[] = [];
    Object.assign(window, { swordAudioCues: cues });
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
      const length = this.buffer?.duration ?? 0;
      if (Math.abs(length - 1.099365) < 0.001 || Math.abs(length - 0.284036) < 0.001) {
        cues.push({ sample: length > 1 ? 'light' : 'heavy', rate: this.playbackRate.value });
      }
      if (duration === undefined) return original.call(this, when, offset);
      return original.call(this, when, offset, duration);
    };
  });
  const cues = () =>
    page.evaluate(
      () =>
        (window as unknown as { swordAudioCues: { sample: string; rate: number }[] })
          .swordAudioCues,
    );
  const recordingRequests: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/audio/stardust/mixkit-') && response.ok())
      recordingRequests.push(new URL(response.url()).pathname);
  });
  await enter(page, '波鲁那雷夫');
  await page.getByLabel('打击音效').check();
  await page.getByTestId('stardust-arena').click();
  await page.keyboard.press('KeyJ');
  await page.clock.runFor(272);
  expect((await cues()).at(-1)?.sample).toBe('light');
  await page.keyboard.press('KeyK');
  await page.clock.runFor(432);
  expect((await cues()).at(-1)?.sample).toBe('heavy');
  await approach(page);
  await page.keyboard.press('KeyU');
  await page.clock.runFor(640);
  expect((await cues()).filter((cue) => cue.sample === 'light').length).toBeGreaterThanOrEqual(4);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const pausedCount = (await cues()).length;
  await page.clock.runFor(1000);
  expect(await cues()).toHaveLength(pausedCount);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.getByLabel('打击音效').uncheck();
  await page.clock.runFor(640);
  expect(await cues()).toHaveLength(pausedCount);
  await page.getByLabel('打击音效').check();
  await page.clock.runFor(9000);
  await chargeUltimate(page);
  const beforeUltimate = (await cues()).length;
  await page.getByTestId('stardust-ultimate-p1').click();
  await page.clock.runFor(1400);
  expect((await cues()).length).toBeGreaterThan(beforeUltimate);
  expect((await cues()).slice(beforeUltimate).every((cue) => cue.sample === 'heavy')).toBe(true);
  await page.clock.runFor(3300);
  await expect(page.getByTestId('stardust-chariot-finisher')).toBeVisible();
  const beforeFinisher = (await cues()).length;
  await page.clock.runFor(400);
  await expect(page.getByTestId('stardust-p2')).toHaveAttribute('data-hp', '0');
  expect((await cues()).length).toBeGreaterThan(beforeFinisher);
  expect((await cues()).at(-1)?.sample).toBe('heavy');
  expect((await cues()).every((cue) => cue.rate === 1)).toBe(true);
  expect(recordingRequests).toContain('/audio/stardust/mixkit-arrow-whoosh-1491.wav');
  expect(recordingRequests).toContain('/audio/stardust/mixkit-dagger-woosh-1487.wav');
});
