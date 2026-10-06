import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.argv[2] ?? 4176);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Expected a port between 1 and 65535.');
}

// Each play session owns its build, so edits and parallel builds cannot replace its assets.
const outDir = await mkdtemp(join(tmpdir(), 'moecore-play-'));
await build({ root, build: { outDir, emptyOutDir: true }, logLevel: 'warn' });
const server = await preview({
  root,
  build: { outDir },
  preview: { host: '127.0.0.1', port, strictPort: true, open: false },
});
server.printUrls();
console.log('Fixed play build; restart this command to load source changes.');
