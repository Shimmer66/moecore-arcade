<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { Lightbulb, Sparkles } from '@lucide/vue';
import { CHARACTERS, type CharacterId } from '@moecore/characters';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import { firstLevel } from '../config/level';
import {
  createRandomSource,
  enumerateValidSwaps,
  isAdjacent,
  playMove,
  startSession,
  type MoveResult,
  type Position,
} from '../rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const random = createRandomSource(props.sessionId);
const state = shallowRef(startSession(firstLevel, random));
const displayBoard = shallowRef(state.value.board);
const selected = shallowRef<Position | null>(null);
const highlights = ref<string[]>([]);
const hints = ref<string[]>([]);
const busy = ref(false);
const message = ref('');
const boardElement = ref<HTMLElement>();
const urls = shallowRef<Partial<Record<CharacterId, string>>>({});
const reactionUrls = shallowRef<Partial<Record<CharacterId, readonly string[]>>>({});
const activeReactions = shallowRef<Partial<Record<CharacterId, string>>>({});
const portrait = ref('');
const portraitName = ref('DeepSeek 娘');
const names = Object.fromEntries(
  CHARACTERS.map((character) => [character.id, character.displayName]),
);
const initials: Record<CharacterId, string> = {
  deepseek: 'DS',
  glm: 'GL',
  gpt: 'GPT',
  claude: 'CL',
  gemini: 'GM',
  kimi: 'KM',
};
const canPlay = computed(() => !props.paused && !busy.value && state.value.outcome === 'playing');
const cells = computed(() =>
  displayBoard.value.flatMap((line, row) =>
    line.map((character, column) => ({
      character: character!,
      row,
      column,
      key: `${row}:${column}`,
    })),
  ),
);
const goalProgress = computed(() =>
  firstLevel.goals.map((goal) => ({
    ...goal,
    collected: Math.min(goal.count, state.value.collected[goal.character] ?? 0),
  })),
);
const startedAt = performance.now();
let pausedAt: number | null = props.paused ? startedAt : null;
let pausedDuration = 0;
let animationId = 0;
let lastFrame: number | undefined;
let elapsed = 0;
let frameIndex = 0;
let pending: MoveResult | undefined;
let disposed = false;
let pointer: { id: number; position: Position; x: number; y: number } | undefined;
let suppressClick = false;
let reactionIndex = 0;

onMounted(async () => {
  const { getMatch3Asset } = await import('@moecore/assets/match3');
  if (disposed) return;
  urls.value = Object.fromEntries(
    CHARACTERS.map(({ id }) => [id, getMatch3Asset(`${id}_tile_portrait`).url]),
  );
  reactionUrls.value = Object.fromEntries(
    CHARACTERS.map(({ id }) => [
      id,
      Array.from(
        { length: id === 'deepseek' || id === 'gpt' ? 3 : 1 },
        (_, index) =>
          getMatch3Asset(`${id}_tile_reaction_${String(index + 1).padStart(2, '0')}`).url,
      ),
    ]),
  );
  portrait.value = getMatch3Asset('deepseek_tile_portrait').url;
});

function setFrame() {
  const frame = pending?.frames[frameIndex];
  if (!frame) return;
  displayBoard.value = frame.board;
  highlights.value = frame.matches.map(({ row, column }) => `${row}:${column}`);
  const reactions: Partial<Record<CharacterId, string>> = {};
  for (const { row, column } of frame.matches) {
    const character = frame.board[row]?.[column];
    if (!character || reactions[character]) continue;
    const variants = reactionUrls.value[character];
    if (variants?.length) {
      reactions[character] = variants[reactionIndex % variants.length]!;
      reactionIndex += 1;
    }
  }
  activeReactions.value = reactions;
  const first = frame.matches[0];
  const character = first && frame.board[first.row]?.[first.column];
  if (character && reactions[character]) {
    portrait.value = reactions[character]!;
    portraitName.value = names[character] ?? character;
  }
}

function animate(timestamp: number) {
  animationId = 0;
  if (disposed || props.paused || !pending) return;
  if (lastFrame !== undefined) elapsed += timestamp - lastFrame;
  lastFrame = timestamp;
  if (elapsed >= (props.settings.reduceMotion ? 0 : 220)) {
    elapsed = 0;
    frameIndex += 1;
    if (frameIndex < pending.frames.length) {
      setFrame();
    } else {
      state.value = pending.state;
      displayBoard.value = pending.state.board;
      message.value = pending.rebuilt ? '棋盘已重新排列' : `消除 ${pending.state.cleared} 枚`;
      pending = undefined;
      highlights.value = [];
      activeReactions.value = {};
      busy.value = false;
      if (state.value.outcome !== 'playing') {
        emit('finish', {
          gameId: 'match3',
          sessionId: props.sessionId,
          outcome: state.value.outcome,
          durationMs: Math.round(performance.now() - startedAt - pausedDuration),
          summary: `消除 ${state.value.cleared} 枚 · ${state.value.turns} 步`,
          stats: { turns: state.value.turns, cleared: state.value.cleared },
        });
      }
      return;
    }
  }
  animationId = requestAnimationFrame(animate);
}

function exchange(from: Position, to: Position) {
  if (!canPlay.value) return;
  const result = playMove(state.value, from, to, firstLevel, random);
  selected.value = null;
  hints.value = [];
  if (!result.accepted) {
    message.value = '没有形成三连，步数不变';
    return;
  }
  pending = result;
  frameIndex = 0;
  elapsed = 0;
  lastFrame = undefined;
  busy.value = true;
  message.value = '消除中';
  setFrame();
  animationId = requestAnimationFrame(animate);
}

function choose(position: Position, event: MouseEvent) {
  if (suppressClick && event.detail !== 0) {
    suppressClick = false;
    return;
  }
  if (!canPlay.value) return;
  const previous = selected.value;
  if (previous?.row === position.row && previous.column === position.column) {
    selected.value = null;
  } else if (previous && isAdjacent(previous, position)) {
    exchange(previous, position);
  } else {
    selected.value = position;
    hints.value = [];
  }
}

function pointerDown(event: PointerEvent, position: Position) {
  if (!canPlay.value || pointer || !event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  pointer = { id: event.pointerId, position, x: event.clientX, y: event.clientY };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function pointerUp(event: PointerEvent) {
  if (!pointer || pointer.id !== event.pointerId) return;
  const { position, x, y } = pointer;
  pointer = undefined;
  const dx = event.clientX - x;
  const dy = event.clientY - y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
  suppressClick = true;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  exchange(position, {
    row: position.row + (horizontal ? 0 : Math.sign(dy)),
    column: position.column + (horizontal ? Math.sign(dx) : 0),
  });
}

function focusNeighbour(event: KeyboardEvent, position: Position) {
  const offsets: Record<string, readonly [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  const offset = offsets[event.key];
  if (!offset) return;
  event.preventDefault();
  const row = Math.min(firstLevel.rows - 1, Math.max(0, position.row + offset[0]));
  const column = Math.min(firstLevel.columns - 1, Math.max(0, position.column + offset[1]));
  boardElement.value
    ?.querySelector<HTMLButtonElement>(`[data-row="${row}"][data-column="${column}"]`)
    ?.focus();
}

function showHint() {
  if (!canPlay.value) return;
  const candidate = enumerateValidSwaps(state.value.board)[0];
  if (candidate)
    hints.value = [candidate.from, candidate.to].map(({ row, column }) => `${row}:${column}`);
  selected.value = null;
}

watch(
  () => props.paused,
  (paused) => {
    pointer = undefined;
    selected.value = null;
    if (paused) {
      pausedAt = performance.now();
      cancelAnimationFrame(animationId);
      animationId = 0;
      lastFrame = undefined;
    } else {
      if (pausedAt !== null) pausedDuration += performance.now() - pausedAt;
      pausedAt = null;
      if (pending && !animationId) animationId = requestAnimationFrame(animate);
    }
  },
);

onUnmounted(() => {
  disposed = true;
  cancelAnimationFrame(animationId);
  pending = undefined;
  pointer = undefined;
});
</script>

<template>
  <div class="match3" :class="{ 'reduce-motion': settings.reduceMotion }">
    <aside class="match3-summary">
      <div class="level-title">
        <Sparkles :size="18" aria-hidden="true" /><span>01 · 初次见面</span>
      </div>
      <div class="match3-moves">
        <strong data-testid="moves">{{ state.movesRemaining }}</strong
        ><span>剩余步数</span>
      </div>
      <h2>收集目标</h2>
      <ul class="match3-goals">
        <li
          v-for="goal in goalProgress"
          :key="goal.character"
          :class="{ achieved: goal.collected === goal.count }"
        >
          <span class="goal-token" :data-character="goal.character">
            <img v-if="urls[goal.character]" :src="urls[goal.character]" alt="" />
            <span v-else>{{ initials[goal.character] }}</span>
          </span>
          <div>
            <span>{{ names[goal.character] }}</span
            ><strong>{{ goal.collected }} / {{ goal.count }}</strong>
          </div>
          <progress :value="goal.collected" :max="goal.count" :aria-label="names[goal.character]" />
        </li>
      </ul>
      <img
        v-if="portrait"
        class="match3-portrait"
        :src="portrait"
        :alt="portraitName"
        width="180"
        height="180"
      />
    </aside>

    <section class="match3-playfield" aria-label="消消乐对局">
      <div class="match3-board-bar">
        <span>消消乐棋盘</span>
        <button
          class="icon-button"
          type="button"
          title="提示"
          aria-label="提示"
          :disabled="!canPlay"
          @click="showHint"
        >
          <Lightbulb :size="20" />
        </button>
      </div>
      <div
        ref="boardElement"
        class="match3-board"
        role="group"
        aria-label="消消乐棋盘"
        :aria-busy="busy"
      >
        <button
          v-for="cell in cells"
          :key="cell.key"
          type="button"
          class="match3-tile"
          :class="{
            selected: selected?.row === cell.row && selected.column === cell.column,
            clearing: highlights.includes(cell.key),
            hinted: hints.includes(cell.key),
          }"
          :data-row="cell.row"
          :data-column="cell.column"
          :data-character="cell.character"
          :data-reaction="Boolean(highlights.includes(cell.key) && activeReactions[cell.character])"
          :aria-label="`第${cell.row + 1}行第${cell.column + 1}列 ${names[cell.character]}`"
          :aria-pressed="selected?.row === cell.row && selected.column === cell.column"
          :disabled="!canPlay"
          @click="choose(cell, $event)"
          @pointerdown="pointerDown($event, cell)"
          @pointerup="pointerUp"
          @pointercancel="pointer = undefined"
          @lostpointercapture="pointer = undefined"
          @keydown="focusNeighbour($event, cell)"
        >
          <img
            v-if="urls[cell.character]"
            :src="
              highlights.includes(cell.key)
                ? activeReactions[cell.character] || urls[cell.character]
                : urls[cell.character]
            "
            alt=""
            draggable="false"
          />
          <span v-else>{{ initials[cell.character] }}</span>
          <span v-if="urls[cell.character]" class="match3-tile-code" aria-hidden="true">{{
            initials[cell.character]
          }}</span>
        </button>
      </div>
      <div class="match3-board-footer">
        <span role="status">{{ message || '等待交换' }}</span
        ><span
          >已消除 <strong data-testid="cleared">{{ state.cleared }}</strong></span
        >
      </div>
    </section>
  </div>
</template>

<style scoped>
.match3 {
  display: grid;
  grid-template-columns: 240px minmax(0, 560px);
  gap: 18px;
  justify-content: center;
  align-items: start;
}
.match3-summary,
.match3-playfield {
  min-width: 0;
  padding: 20px;
  border-radius: var(--ui-radius);
}
.match3-summary {
  background: var(--ui-subtle);
}
.match3-playfield {
  padding-block: 0;
}
.level-title {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--home-purple);
  font-size: 14px;
  font-weight: 600;
}
.match3-moves {
  margin-top: 24px;
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 14px;
  color: var(--home-muted);
}
.match3-moves strong {
  font-size: 52px;
  line-height: 1.2;
  color: var(--home-ink);
  font-variant-numeric: tabular-nums;
  min-width: 2ch;
}
.match3-summary h2 {
  font-size: 14px;
  margin: 30px 0 12px;
  color: var(--home-ink);
}
.match3-goals {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 16px;
}
.match3-goals li {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 4px 10px;
}
.goal-token {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  grid-row: span 2;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: #263c35;
}
.goal-token img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.match3-goals li > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  align-items: center;
}
.match3-goals strong {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.match3-goals progress {
  appearance: none;
  height: 6px;
  width: 100%;
  accent-color: var(--home-purple);
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  align-self: center;
}
.match3-goals progress::-webkit-progress-bar {
  background: #e1e7f0;
}
.match3-goals progress::-webkit-progress-value {
  background: var(--ui-accent);
  border-radius: 4px;
}
.match3-goals progress::-moz-progress-bar {
  background: var(--ui-accent);
  border-radius: 4px;
}
.achieved {
  color: #5945aa;
}
.match3-portrait {
  display: block;
  margin: 26px auto 0;
  object-fit: contain;
  max-width: 100%;
}
.match3-playfield {
  min-width: 0;
}
.match3-board-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--home-ink);
}
.match3-board {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-template-rows: repeat(8, minmax(0, 1fr));
  gap: 6px;
  padding: 10px;
  aspect-ratio: 1;
  background: #f0f3f9;
  border: 1px solid var(--ui-line);
  border-radius: 13px;
  touch-action: none;
}
.match3-tile {
  border: 1px solid #ffffffbf;
  border-radius: 8px;
  padding: 2px;
  display: grid;
  place-items: center;
  cursor: pointer;
  min-width: 0;
  min-height: 0;
  user-select: none;
  position: relative;
  box-shadow: 0 2px 0 #30504120;
  color: #20382f;
  font:
    700 18px/1 system-ui,
    sans-serif;
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.match3-tile img {
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
  pointer-events: none;
}
.match3-tile-code {
  position: absolute;
  right: 3px;
  bottom: 3px;
  padding: 2px 3px;
  border-radius: 4px;
  background: #fffffff0;
  color: #1f2d3a;
  font-size: 9px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -0.02em;
  pointer-events: none;
}
.match3-tile:disabled {
  cursor: default;
}
.match3-tile:not(:disabled):hover {
  outline: 2px solid var(--home-purple);
  outline-offset: 0;
  z-index: 1;
}
.match3-tile.selected,
.match3-tile.hinted {
  outline: 3px solid var(--home-purple);
  outline-offset: 0;
  z-index: 2;
}
.match3-tile.hinted::after {
  content: '';
  position: absolute;
  inset: 3px;
  border: 2px dashed #49377e;
  border-radius: 5px;
  pointer-events: none;
}
.match3-tile.clearing {
  z-index: 3;
  animation: match3-reaction-pop 220ms ease-out both;
}
@keyframes match3-reaction-pop {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  45% {
    transform: scale(1.12);
    opacity: 1;
  }
  100% {
    transform: scale(0.76);
    opacity: 0.25;
  }
}
.match3-board-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  padding-top: 12px;
  font-size: 12px;
  color: var(--home-muted);
}
.match3-board-footer strong {
  font-variant-numeric: tabular-nums;
}
[data-character='deepseek'] {
  background: #bfe3ef;
}
[data-character='glm'] {
  background: #c6cfef;
}
[data-character='gpt'] {
  background: #bbe7ce;
}
[data-character='claude'] {
  background: #f3db9f;
}
[data-character='gemini'] {
  background: #dbcaf1;
}
[data-character='kimi'] {
  background: #f0c7d8;
}
.reduce-motion .match3-tile {
  transition: none;
}
.reduce-motion .match3-tile.clearing {
  transform: none;
  opacity: 1;
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .match3-tile {
    transition: none;
  }
  .match3-tile.clearing {
    transform: none;
    opacity: 1;
    animation: none;
  }
}
@media (max-width: 740px) {
  .match3 {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  .match3-summary {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px 16px;
  }
  .match3-summary,
  .match3-playfield {
    padding: 14px;
  }
  .match3-moves {
    margin: 0;
    gap: 6px;
  }
  .match3-moves strong {
    font-size: 30px;
  }
  .match3-moves > span {
    font-size: 12px;
  }
  .match3-summary h2,
  .match3-portrait {
    display: none;
  }
  .match3-goals {
    grid-column: 1 / -1;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .match3-goals li {
    grid-template-columns: 32px 1fr;
    gap: 4px;
  }
  .goal-token {
    width: 32px;
    height: 32px;
    font-size: 10px;
  }
  .match3-goals li > div {
    display: block;
    font-size: 11px;
  }
  .match3-goals li > div > span {
    display: none;
  }
  .match3-board {
    gap: 4px;
    padding: 6px;
  }
  .match3-tile {
    border-radius: 6px;
    font-size: 13px;
    padding: 1px;
  }
  .match3-board-bar {
    margin-bottom: 6px;
  }
}
</style>
