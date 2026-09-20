import Phaser from 'phaser';
import { BACKGROUND, CELL, SIZE, cells, frameComplete, toggle } from './common.mjs';

export function mount() {
  new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'board',
    width: SIZE,
    height: SIZE,
    backgroundColor: BACKGROUND,
    banner: false,
    audio: { noAudio: true },
    render: {
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    },
    scene: {
      create() {
        for (const cell of cells) {
          const tile = this.add
            .rectangle(cell.x + CELL / 2, cell.y + CELL / 2, CELL - 4, CELL - 4, cell.color)
            .setInteractive();
          tile.on('pointerdown', () => tile.setFillStyle(toggle(cell)));
        }
        this.game.events.on(Phaser.Core.Events.POST_RENDER, () =>
          frameComplete(this.game.renderer.gl),
        );
      },
    },
  });
  globalThis.window.__spikeEngine = { name: 'phaser', version: Phaser.VERSION };
}
