import { Application, Graphics, VERSION } from 'pixi.js';
import { BACKGROUND, CELL, SIZE, cells, frameComplete, toggle } from './common.mjs';

export async function mount() {
  const app = new Application();
  await app.init({
    width: SIZE,
    height: SIZE,
    autoStart: false,
    resolution: 1,
    preference: 'webgl',
    preferWebGLVersion: 1,
    antialias: false,
    background: BACKGROUND,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  globalThis.document.querySelector('#board').append(app.canvas);
  const render = () => {
    app.render();
    frameComplete(app.renderer.gl);
  };
  for (const cell of cells) {
    const tile = new Graphics();
    const paint = (color) =>
      tile
        .clear()
        .rect(2, 2, CELL - 4, CELL - 4)
        .fill(color);
    paint(cell.color);
    tile.position.set(cell.x, cell.y);
    tile.eventMode = 'static';
    tile.on('pointerdown', () => {
      paint(toggle(cell));
      render();
    });
    app.stage.addChild(tile);
  }
  render();
  globalThis.window.__spikeEngine = { name: 'pixi', version: VERSION };
}
