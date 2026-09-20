import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';

function spikeShutdown(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/__spike_shutdown', (request, response, next) => {
      if (request.method !== 'POST' || request.headers['x-engine-spike'] !== 'shutdown') {
        next();
        return;
      }
      response.end('closing');
      setImmediate(() => void server.close());
    });
  };
  return {
    name: 'engine-spike-shutdown',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig(() => {
  const engine = process.env.SPIKE_ENGINE;
  if (engine && engine !== 'phaser' && engine !== 'pixi') {
    throw new Error(`Unknown SPIKE_ENGINE: ${engine}`);
  }

  return {
    base: './',
    ...(engine
      ? {
          root: fileURLToPath(new URL('./spike', import.meta.url)),
          plugins: [spikeShutdown()],
          resolve: {
            alias: {
              '@spike/renderer': fileURLToPath(new URL(`./spike/${engine}.mjs`, import.meta.url)),
            },
          },
        }
      : {}),
    build: {
      outDir: fileURLToPath(new URL('./dist', import.meta.url)),
      emptyOutDir: true,
    },
  };
});
