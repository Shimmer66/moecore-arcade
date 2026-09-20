import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = join(root, 'docs/spikes/results');
const screenshots = join(root, 'apps/web/test-results/engine-spike');
const manifestPath = join(root, 'apps/web/package.json');
const lockPath = join(root, 'pnpm-lock.yaml');
const engine = process.argv[2];
const version = process.argv[3];
assert(
  ['baseline', 'phaser', 'pixi', 'cost'].includes(engine),
  'Expected baseline, phaser, pixi, cost',
);
assert(!version || /^\d+\.\d+\.\d+$/.test(version), 'Use an exact release version');
await mkdir(output, { recursive: true });
await mkdir(screenshots, { recursive: true });
const env = { ...process.env, NO_COLOR: '1' };
delete env.SPIKE_ENGINE;
if (engine === 'phaser' || engine === 'pixi') env.SPIKE_ENGINE = engine;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const save = async (name, value) =>
  writeFile(join(output, name), `${JSON.stringify(value, null, 2)}\n`);

function sync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(' ')}: ${result.stderr?.toString()}`);
  return result.stdout;
}

function startPnpm(args) {
  // Windows .cmd launchers require cmd.exe; all arguments below are fixed or validated.
  return spawn('pnpm', args, {
    cwd: root,
    env,
    shell: process.platform === 'win32',
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function pnpm(args, name) {
  console.log(`$ pnpm ${args.join(' ')}`);
  const child = startPnpm(args);
  let text = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (data) => {
      const clean = stripVTControlCharacters(data.toString());
      text += clean;
      process.stdout.write(clean);
    });
  }
  const [code] = await once(child, 'exit');
  if (name) await writeFile(join(output, name), text);
  assert.equal(code, 0, `pnpm ${args.join(' ')} exited ${code}`);
}

async function footprint() {
  const human = sync('du', ['-sh', 'node_modules']).toString().trim();
  const allocated = sync('du', ['-s', '-B1', 'node_modules']).toString().trim();
  const apparent = sync('du', ['-sb', 'node_modules']).toString().trim();
  const lockLines = sync('wc', ['-l', 'pnpm-lock.yaml']).toString().trim();
  return {
    duSh: human,
    duAllocated: allocated,
    allocatedBytes: Number(allocated.split(/\s+/)[0]),
    duApparent: apparent,
    apparentBytes: Number(apparent.split(/\s+/)[0]),
    wcLock: lockLines,
    lockLines: Number(lockLines.split(/\s+/)[0]),
  };
}

async function assets() {
  const directory = join(root, 'apps/web/dist/assets');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.js')).sort();
  assert(files.length > 0, 'No production JavaScript assets');
  const records = [];
  for (const file of files) {
    const path = join(directory, file);
    const source = await readFile(path);
    records.push({
      file,
      bytes: source.byteLength,
      gzip9Bytes: sync('gzip', ['-9', '-c', path]).byteLength,
      gzip9NoNameBytes: sync('gzip', ['-9', '-n', '-c', path]).byteLength,
      viteGzipBytes: gzipSync(source).byteLength,
      sha256: hash(source),
    });
  }
  return {
    files: records,
    totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
    totalGzip9Bytes: records.reduce((sum, record) => sum + record.gzip9Bytes, 0),
    totalGzip9NoNameBytes: records.reduce((sum, record) => sum + record.gzip9NoNameBytes, 0),
    totalViteGzipBytes: records.reduce((sum, record) => sum + record.viteGzipBytes, 0),
  };
}

async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((done) => socket.close(done));
  return port;
}

async function stop({ child, url }) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  const response = await fetch(`${url}/__spike_shutdown`, {
    method: 'POST',
    headers: { 'x-engine-spike': 'shutdown' },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(await response.text(), 'closing');
  const timeout = setTimeout(() => {
    console.error(`Server did not exit after shutdown: ${url}`);
    process.exitCode = 1;
  }, 15_000);
  await exited.finally(() => clearTimeout(timeout));
}

async function server(mode, iteration = 0) {
  const port = await freePort();
  const args = ['run', mode, '--port', String(port), '--strictPort'];
  if (mode === 'dev') args.push('--force');
  const started = performance.now();
  const child = startPnpm(args);
  let text = '';
  try {
    const seconds = await new Promise((done, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Server readiness timeout: ${text}`)),
        60_000,
      );
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited ${code}: ${text}`));
      });
      for (const stream of [child.stdout, child.stderr]) {
        stream.on('data', (data) => {
          text += stripVTControlCharacters(data.toString());
          if (text.includes(`http://127.0.0.1:${port}/`)) {
            clearTimeout(timeout);
            done((performance.now() - started) / 1000);
          }
        });
      }
    });
    await writeFile(join(output, `${engine}-${mode}-${iteration}.txt`), text);
    return { child, url: `http://127.0.0.1:${port}`, seconds, command: `pnpm ${args.join(' ')}` };
  } catch (error) {
    await stop({ child, url: `http://127.0.0.1:${port}` });
    throw error;
  }
}

async function pixels(page) {
  return page.evaluate(() => {
    const { document, window } = globalThis;
    const source = document.querySelector('canvas');
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const context = copy.getContext('2d');
    context.drawImage(source, 0, 0);
    return window.__spikeBoard.cells.map(({ x, y }) =>
      [...context.getImageData(x + 24, y + 24, 1, 1).data].slice(0, 3),
    );
  });
}

function assertPixels(actual, cells, selected) {
  for (const cell of cells) {
    const color = selected.includes(cell.index) ? 0xffffff : cell.color;
    const expected = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
    assert.deepEqual(actual[cell.index], expected, `Cell ${cell.index} pixel mismatch`);
  }
}

async function browserMeasurements(url) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const results = { channel: 'chrome', browserVersion: browser.version(), samples: [], qa: [] };
  try {
    for (let sample = 0; sample < 4; sample += 1) {
      const mobile = sample === 3;
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await page.goto(url);
      await page.waitForFunction(() => Number.isFinite(globalThis.window.__spikeFirstPaint));
      const initial = await page.evaluate(() => ({
        firstPaintMs: globalThis.window.__spikeFirstPaint,
        engine: globalThis.window.__spikeEngine,
        board: globalThis.window.__spikeBoard,
        renderer: globalThis.window.__spikeRenderer,
        navigation: performance.getEntriesByType('navigation')[0].toJSON(),
        userAgent: globalThis.navigator.userAgent,
      }));
      assert.equal(initial.engine.name, engine);
      assert.equal(initial.board.cells.length, 64);
      assertPixels(await pixels(page), initial.board.cells, []);
      const canvas = page.locator('canvas');
      const box = await canvas.boundingBox();
      assert(box && box.width > 0 && box.height > 0);
      assert.equal(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.document.documentElement.clientWidth,
        ),
        true,
      );
      const clickCell = async (index) => {
        const cell = initial.board.cells[index];
        const x = box.x + ((cell.x + 24) * box.width) / initial.board.size;
        const y = box.y + ((cell.y + 24) * box.height) / initial.board.size;
        const previous = await page.evaluate(() => globalThis.window.__spikeClickSequence);
        if (mobile) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        await page.waitForFunction(
          (sequence) => globalThis.window.__spikeClickSequence === sequence + 1,
          previous,
        );
        return page.evaluate(() => ({
          clickLatencyMs: globalThis.window.__spikeClickLatency,
          selected: globalThis.window.__spikeSelected,
        }));
      };
      const interaction = await clickCell(28);
      assertPixels(await pixels(page), initial.board.cells, [28]);
      assert.deepEqual(interaction.selected, [28]);
      assert(Number.isFinite(interaction.clickLatencyMs) && interaction.clickLatencyMs >= 0);
      await page.screenshot({
        path: join(screenshots, `${engine}-${mobile ? 'mobile' : `desktop-${sample + 1}`}.png`),
      });
      if (!mobile) {
        const record = {
          run: sample + 1,
          ...initial,
          board: undefined,
          boardSha256: hash(JSON.stringify(initial.board.board)),
          ...interaction,
        };
        results.samples.push(record);
        console.log(JSON.stringify(record));
      }
      // Exhaustive functional checks happen after the timed sample, not during it.
      if (sample === 0 || mobile) {
        await clickCell(28);
        assertPixels(await pixels(page), initial.board.cells, []);
        for (let index = 0; index < 64; index += 1) {
          const state = await clickCell(index);
          assert(state.selected.includes(index));
        }
        assertPixels(
          await pixels(page),
          initial.board.cells,
          initial.board.cells.map((c) => c.index),
        );
        results.qa.push({
          viewport: mobile ? 'mobile-touch' : 'desktop-mouse',
          cellsChecked: 64,
          toggleOffChecked: true,
          pixelsChecked: true,
          noHorizontalOverflow: true,
        });
      }
      assert.deepEqual(errors, [], 'Browser errors');
      await context.close();
    }
    return results;
  } finally {
    await browser.close();
  }
}

if (engine === 'cost') {
  const paths = [
    'apps/web/spike/index.html',
    'apps/web/spike/main.mjs',
    'apps/web/spike/common.mjs',
    'apps/web/spike/phaser.mjs',
    'apps/web/spike/pixi.mjs',
    'apps/web/vite.config.ts',
    'apps/web/spike-tools/measure.mjs',
  ];
  const raw = sync('wc', ['-l', ...paths]).toString();
  await writeFile(join(output, 'code-lines.txt'), raw);
  console.log(raw);
} else {
  const beforeManifest = await readFile(manifestPath);
  const beforeLock = await readFile(lockPath);
  await writeFile(join(screenshots, `${engine}-before-package.json`), beforeManifest);
  await writeFile(join(screenshots, `${engine}-before-lock.yaml`), beforeLock);
  const dependencies = JSON.parse(beforeManifest).dependencies;
  assert(
    !dependencies.phaser && !dependencies['pixi.js'],
    'Start each round without either engine',
  );
  const result = {
    engine,
    startedAt: new Date().toISOString(),
    environment: {
      cwd: root,
      node: process.version,
      os: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0].model,
      ramBytes: os.totalmem(),
      baseCommit: sync('git', ['rev-parse', 'HEAD']).toString().trim(),
      pnpm: sync('pnpm', ['--version'], { shell: process.platform === 'win32' })
        .toString()
        .trim(),
    },
    before: await footprint(),
    commands: [],
  };
  const packageName = engine === 'pixi' ? 'pixi.js' : engine;
  const packageSpec = `${packageName}${version ? `@${version}` : ''}`;
  let installed = false;
  try {
    if (engine !== 'baseline') {
      installed = true;
      const args = ['--filter', '@moecore/web', 'add', '--save-exact', packageSpec];
      result.commands.push(`pnpm ${args.join(' ')}`);
      await pnpm(args, `${engine}-add.txt`);
      result.installedVersion = JSON.parse(await readFile(manifestPath, 'utf8')).dependencies[
        packageName
      ];
    }
    result.after = await footprint();
    result.installDelta = {
      allocatedBytes: result.after.allocatedBytes - result.before.allocatedBytes,
      apparentBytes: result.after.apparentBytes - result.before.apparentBytes,
      lockLines: result.after.lockLines - result.before.lockLines,
    };
    result.commands.push('pnpm run build');
    await pnpm(['run', 'build'], `${engine}-build.txt`);
    result.assets = await assets();
    if (engine !== 'baseline') {
      result.startup = [];
      for (let iteration = 1; iteration <= 3; iteration += 1) {
        const running = await server('dev', iteration);
        result.startup.push({ run: iteration, command: running.command, seconds: running.seconds });
        await stop(running);
      }
      const preview = await server('preview');
      try {
        result.browser = await browserMeasurements(preview.url);
      } finally {
        await stop(preview);
      }
    }
    result.status = 'complete';
  } catch (error) {
    result.status = 'incomplete';
    result.error = String(error.stack ?? error);
    process.exitCode = 1;
  } finally {
    if (installed) {
      try {
        const args = ['--filter', '@moecore/web', 'remove', packageName];
        result.commands.push(`pnpm ${args.join(' ')}`);
        await pnpm(args, `${engine}-remove.txt`);
        assert.deepEqual(
          await readFile(manifestPath),
          beforeManifest,
          'Manifest not restored exactly',
        );
        assert.deepEqual(await readFile(lockPath), beforeLock, 'Lockfile not restored exactly');
        result.restored = {
          manifestIdentical: true,
          lockIdentical: true,
          manifestSha256: hash(beforeManifest),
          lockSha256: hash(beforeLock),
        };
      } catch (error) {
        result.restorationError = String(error.stack ?? error);
        result.status = 'incomplete';
        process.exitCode = 1;
      }
    }
    result.finishedAt = new Date().toISOString();
    await save(`${engine}.json`, result);
    console.log(JSON.stringify(result, null, 2));
  }
}
