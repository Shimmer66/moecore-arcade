/* global window, document, HTMLImageElement */
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const { chromium } = createRequire(new URL('../apps/web/package.json', import.meta.url))(
  'playwright',
);
const browser = await chromium.launch();
const results = [];
const baseURL = process.env.DUEL_TEST_URL ?? 'http://127.0.0.1:5198';
const mobile = process.argv.includes('--mobile');
const cpuRate = mobile ? 4 : 1;
for (const team of [false, true]) {
  const p = await browser.newPage({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    hasTouch: mobile,
  });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(() => {
    window.__duelPerf = { decodes: [], frames: [], record: false, last: 0, longTasks: [] };
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      const start = performance.now(),
        url = this.src;
      return decode.call(this).finally(() =>
        window.__duelPerf.decodes.push({
          url,
          ms: performance.now() - start,
          width: this.naturalWidth,
          height: this.naturalHeight,
        }),
      );
    };
    const request = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) =>
      request.call(window, (time) => {
        const m = window.__duelPerf,
          start = performance.now();
        callback(time);
        if (m.record) {
          if (m.last && time !== m.last)
            m.frames.push({ interval: time - m.last, work: performance.now() - start });
          m.last = time;
        }
      });
    new PerformanceObserver((list) => {
      if (window.__duelPerf.record)
        window.__duelPerf.longTasks.push(...list.getEntries().map((e) => e.duration));
    }).observe({ type: 'longtask', buffered: false });
  });
  const started = Date.now();
  await p.goto(baseURL + '/#/games/duel');
  if (team) await p.getByRole('button', { name: /3v3车轮战/ }).click();
  await p.locator('.duel[data-art-ready="true"]').waitFor();
  const readyMs = Date.now() - started;
  const before = await p.evaluate(() => ({
    decodes: window.__duelPerf.decodes,
    resources: performance
      .getEntriesByType('resource')
      .filter((r) => /\.(png|webp)(\?|$)/.test(r.name))
      .map((r) => ({ url: r.name, bytes: r.transferSize, body: r.encodedBodySize })),
  }));
  if (!team) await p.getByRole('button', { name: /练招房/ }).click();
  await p.getByRole('button', { name: team ? '全队开打 →' : '开始练招 →', exact: true }).click();
  await p.waitForFunction(() => document.querySelector('.duel')?.dataset.phase === 'fight');
  await p.locator('.duel-arena').focus();
  await p.evaluate(() => {
    window.__duelPerf.record = true;
    window.__duelPerf.last = 0;
  });
  const wait = (ms) => p.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
  await p.keyboard.down('KeyD');
  await wait(650);
  await p.keyboard.up('KeyD');
  for (const key of [
    'KeyJ',
    'KeyM',
    'KeyK',
    'KeyN',
    'KeyQ',
    'KeyG',
    'KeyC',
    'KeyF',
    'KeyJ',
    'KeyN',
  ]) {
    await p.keyboard.press(key);
    await wait(360);
  }
  await p.keyboard.down('Space');
  await wait(120);
  await p.keyboard.press('KeyJ');
  await wait(400);
  await p.keyboard.up('Space');
  await wait(450);
  const running = await p.evaluate(() => {
    window.__duelPerf.record = false;
    return window.__duelPerf;
  });
  const percentile = (arr, n) =>
    arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * n))] ?? 0;
  const decodeURLs = new Set(before.decodes.map((d) => d.url));
  results.push({
    mode: team ? 'team' : 'practice',
    mobile,
    cpuRate,
    readyMs,
    decodedURLs: decodeURLs.size,
    decodeCalls: before.decodes.length,
    duplicateDecodeCalls: before.decodes.length - decodeURLs.size,
    requestedImages: before.resources.length,
    imageBodyBytes: before.resources.reduce((s, r) => s + r.body, 0),
    estimatedDecodedBytes: [...decodeURLs].reduce((s, url) => {
      const d = before.decodes.find((d) => d.url === url);
      return s + d.width * d.height * 4;
    }, 0),
    frames: running.frames.length,
    frameIntervalP50: percentile(
      running.frames.map((f) => f.interval),
      0.5,
    ),
    frameIntervalP95: percentile(
      running.frames.map((f) => f.interval),
      0.95,
    ),
    callbackP95: percentile(
      running.frames.map((f) => f.work),
      0.95,
    ),
    framesAbove25ms: running.frames.filter((f) => f.interval > 25).length,
    longTasks: running.longTasks,
    fightDecodeCalls: running.decodes.length - before.decodes.length,
    errors,
    decodeDetail: before.decodes,
    resourceDetail: before.resources,
  });
  await p.close();
}
await browser.close();
const filename =
  process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? '.cache/duel-perf-current.json';
await writeFile(filename, JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    results.map((result) =>
      Object.fromEntries(
        Object.entries(result).filter(
          ([key]) => key !== 'decodeDetail' && key !== 'resourceDetail',
        ),
      ),
    ),
    null,
    2,
  ),
);
