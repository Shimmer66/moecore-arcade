import { prototypeConfig } from '@moecore/game-match3';
import { createBoard, createRandomSource } from '@moecore/game-match3/rules';

const { window, performance } = globalThis;
export const CELL = 48;
export const SIZE = CELL * 8;
export const BACKGROUND = 0x181818;
export const SELECTED = 0xffffff;
const seed = 'engine-selection-2026-09-20';
const palette = [0xea668d, 0x48b7a5, 0x668fe8, 0xe9c85b, 0xb083d6, 0xea9163];
const { board } = createBoard(prototypeConfig, createRandomSource(seed));
export const cells = board.flatMap((line, row) =>
  line.map((character, column) => ({
    index: row * 8 + column,
    x: column * CELL,
    y: row * CELL,
    color: palette[prototypeConfig.characterIds.indexOf(character)],
  })),
);

window.__spikeBoard = { seed, board, cells, size: SIZE, cellSize: CELL };
window.__spikeSelected = [];
window.__spikeClickSequence = 0;
const selected = new Set();
let pointerStarted;
let pendingClick;

window.addEventListener(
  'pointerdown',
  (event) => {
    if (event.target instanceof globalThis.HTMLCanvasElement) {
      pointerStarted = performance.now();
    }
  },
  { capture: true },
);

export function toggle(cell) {
  if (pointerStarted === undefined) throw new Error('Missing pointerdown timing');
  if (selected.has(cell.index)) selected.delete(cell.index);
  else selected.add(cell.index);
  pendingClick = pointerStarted;
  pointerStarted = undefined;
  window.__spikeClickLatency = undefined;
  window.__spikeSelected = [...selected];
  return selected.has(cell.index) ? SELECTED : cell.color;
}

export function frameComplete(gl) {
  if (window.__spikeFirstPaint !== undefined && pendingClick === undefined) return;
  // Both engines use the same GPU fence; this is not a browser compositor timestamp.
  gl.finish();
  const completed = performance.now();
  if (window.__spikeFirstPaint === undefined) {
    window.__spikeFirstPaint = completed;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    window.__spikeRenderer = {
      version: gl.getParameter(gl.VERSION),
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    };
  }
  if (pendingClick !== undefined) {
    window.__spikeClickLatency = completed - pendingClick;
    window.__spikeClickSequence += 1;
    pendingClick = undefined;
  }
}
