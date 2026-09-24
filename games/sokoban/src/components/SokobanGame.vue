<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, triggerRef, watch } from 'vue';
import type { GameEvents, GameProps, GameResult } from '@moecore/game-sdk';
import { Game, levels, plan, type Direction } from '../rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const settings = computed(() => props.settings);
const levelIndex = ref(0);
const game = shallowRef(new Game(levels[0]!));
const unlocked = ref(1);
const completed = ref<number[]>([]);
const best = ref<Record<number, number>>({});
const feedback = ref('点空地走过去，靠近后点箱子推一格。');
const busy = ref(false);
const showResult = ref(false);
const routeTarget = ref<number | null>(null);
const finished = ref(false);
const startedAt = performance.now();
const runToken = ref(0);
const assetUrls = ref<Record<string, string>>({});
const spriteFrame = ref('char_S_idle_01');
const timers: ReturnType<typeof setTimeout>[] = [];
const storageKey = 'moecore-sokoban-progress-v1';

const level = computed(() => levels[levelIndex.value]!);
const snapshot = computed(() => game.value.snapshot());
const canPlay = computed(() => !props.paused && !showResult.value && !game.value.won);
const placed = computed(
  () => snapshot.value.boxes.filter((box) => game.value.goals.has(box)).length,
);
const progress = computed(() => `${completed.value.length} / ${levels.length}`);
const boardStyle = computed(() => ({
  '--columns': String(snapshot.value.width),
  '--rows': String(snapshot.value.height),
}));
const cells = computed(() =>
  level.value.map.flatMap((row, y) =>
    [...row].map((character, x) => {
      const index = y * snapshot.value.width + x;
      return { index, wall: character === '#', goal: game.value.goals.has(index) };
    }),
  ),
);

function loadProgress(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return;
    const saved = value as { unlocked?: unknown; completed?: unknown; best?: unknown };
    if (typeof saved.unlocked === 'number')
      unlocked.value = Math.max(1, Math.min(levels.length, Math.floor(saved.unlocked)));
    if (Array.isArray(saved.completed))
      completed.value = saved.completed.filter(
        (item): item is number => typeof item === 'number' && item >= 0 && item < levels.length,
      );
    if (saved.best && typeof saved.best === 'object')
      best.value = Object.fromEntries(
        Object.entries(saved.best).filter(
          ([, value]) => typeof value === 'number' && Number.isFinite(value),
        ),
      ) as Record<number, number>;
  } catch {
    /* Ignore an invalid local save. */
  }
}
function saveProgress(): void {
  if (typeof localStorage !== 'undefined')
    localStorage.setItem(
      storageKey,
      JSON.stringify({ unlocked: unlocked.value, completed: completed.value, best: best.value }),
    );
}
function cellStyle(index: number): Record<string, string> {
  const width = snapshot.value.width;
  return {
    gridColumn: String((index % width) + 1),
    gridRow: String(Math.floor(index / width) + 1),
  };
}
function assetUrl(id: string): string | undefined {
  return assetUrls.value[id];
}
function playerAsset(): string | undefined {
  return assetUrl(spriteFrame.value) ?? assetUrl('portrait_neutral');
}
function clearPath(): void {
  runToken.value += 1;
  while (timers.length) {
    const timer = timers.pop();
    if (timer !== undefined) clearTimeout(timer);
  }
  busy.value = false;
  routeTarget.value = null;
}
function announce(result: ReturnType<Game['move']>): void {
  const direction = game.value.facing;
  if (result.type === 'blocked') {
    feedback.value = '这里走不通，换个方向试试。';
    spriteFrame.value = `char_${direction}_blocked_02`;
  } else if (result.type === 'push') {
    feedback.value = result.becameWon
      ? '整理完成！这间小屋焕然一新。'
      : result.onGoal
        ? '放得刚刚好，圆环亮起来了。'
        : '呼……箱子又向前了一格。';
    spriteFrame.value = result.onGoal
      ? `char_${direction}_push_end_01`
      : `char_${direction}_push_loop_02`;
  } else {
    feedback.value = '慢慢走，先找到箱子的合适站位。';
    spriteFrame.value = `char_${direction}_walk_02`;
  }
  const timer = setTimeout(() => {
    spriteFrame.value = `char_${game.value.facing}_idle_01`;
  }, 260);
  timers.push(timer);
}
function completeLevel(): void {
  if (finished.value) return;
  finished.value = true;
  const index = levelIndex.value;
  if (!completed.value.includes(index))
    completed.value = [...completed.value, index].sort((a, b) => a - b);
  unlocked.value = Math.max(unlocked.value, Math.min(levels.length, index + 2));
  const moves = snapshot.value.moves;
  if (best.value[index] === undefined || moves < best.value[index]!)
    best.value = { ...best.value, [index]: moves };
  saveProgress();
  showResult.value = true;
  if (index === levels.length - 1) {
    const result: GameResult = {
      gameId: 'sokoban',
      sessionId: props.sessionId,
      outcome: 'completed',
      durationMs: Math.round(performance.now() - startedAt),
      summary: `五关完成 · 最后一关 ${moves} 步 · ${snapshot.value.pushes} 次推动`,
      stats: { level: index + 1, moves, pushes: snapshot.value.pushes },
      story: { title: '搬家清单全部完成', body: '大肥鱼把箱子稳稳地送回了它们的位置。' },
    };
    emit('finish', result);
  }
}
function applyMove(direction: Direction): void {
  const result = game.value.move(direction);
  triggerRef(game);
  announce(result);
  if (result.becameWon) completeLevel();
}
function execute(directions: readonly Direction[]): void {
  if (!directions.length) {
    routeTarget.value = null;
    return;
  }
  clearPath();
  busy.value = true;
  const token = runToken.value;
  const interval = props.settings.reduceMotion ? 0 : 110;
  directions.forEach((direction, index) => {
    const timer = setTimeout(() => {
      if (token !== runToken.value || props.paused) return;
      applyMove(direction);
      if (index === directions.length - 1) {
        busy.value = false;
        routeTarget.value = null;
      }
    }, index * interval);
    timers.push(timer);
  });
}
function tapCell(target: number): void {
  if (!canPlay.value) return;
  clearPath();
  routeTarget.value = target;
  const route = plan(game.value, target);
  if (route.type === 'box-too-far') {
    feedback.value = '先点箱子旁的空地，靠近后再点箱子推。';
    routeTarget.value = null;
  } else if (route.type === 'blocked' || route.type === 'invalid') {
    feedback.value = '这条路被墙或箱子挡住了。';
    routeTarget.value = null;
  } else execute(route.directions);
}
function selectLevel(index: number): void {
  if (index < 0 || index >= levels.length || index >= unlocked.value) return;
  clearPath();
  levelIndex.value = index;
  game.value = new Game(levels[index]!);
  finished.value = false;
  showResult.value = false;
  feedback.value = levels[index]!.subtitle;
  triggerRef(game);
}
function restart(): void {
  clearPath();
  game.value.reset();
  finished.value = false;
  showResult.value = false;
  feedback.value = '重新整理一下，这次一定能找到路线。';
  triggerRef(game);
}
function undo(): void {
  if (busy.value) clearPath();
  if (game.value.undo()) {
    finished.value = false;
    showResult.value = false;
    feedback.value = '退回上一步，再想想箱子的站位。';
    triggerRef(game);
  }
}
function nextLevel(): void {
  showResult.value = false;
  if (levelIndex.value + 1 < levels.length && levelIndex.value + 1 < unlocked.value)
    selectLevel(levelIndex.value + 1);
  else selectLevel(0);
}
function onKeydown(event: KeyboardEvent): void {
  if (props.paused || showResult.value) return;
  const keys: Record<string, Direction> = {
    ArrowUp: 'N',
    w: 'N',
    W: 'N',
    ArrowRight: 'E',
    d: 'E',
    D: 'E',
    ArrowDown: 'S',
    s: 'S',
    S: 'S',
    ArrowLeft: 'W',
    a: 'W',
    A: 'W',
  };
  if (event.key === 'z' || event.key === 'Z') {
    event.preventDefault();
    undo();
    return;
  }
  if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    restart();
    return;
  }
  const direction = keys[event.key];
  if (!direction || !canPlay.value) return;
  event.preventDefault();
  applyMove(direction);
}
watch(
  () => props.paused,
  (paused) => {
    if (paused) clearPath();
  },
);
onMounted(async () => {
  loadProgress();
  window.addEventListener('keydown', onKeydown);
  const ids = [
    'box_wood_01',
    'target_empty_01',
    'target_filled_01',
    'portrait_neutral',
    'portrait_effort',
    'portrait_happy',
    'portrait_proud',
    'portrait_confused',
    'portrait_reassuring',
    'char_N_idle_01',
    'char_E_idle_01',
    'char_S_idle_01',
    'char_W_idle_01',
    'char_N_walk_02',
    'char_E_walk_02',
    'char_S_walk_02',
    'char_W_walk_02',
    'char_N_push_loop_02',
    'char_E_push_loop_02',
    'char_S_push_loop_02',
    'char_W_push_loop_02',
    'char_N_push_end_01',
    'char_E_push_end_01',
    'char_S_push_end_01',
    'char_W_push_end_01',
    'char_N_blocked_02',
    'char_E_blocked_02',
    'char_S_blocked_02',
    'char_W_blocked_02',
  ];
  const { getSokobanAsset } = await import('@moecore/assets/sokoban');
  assetUrls.value = Object.fromEntries(ids.map((id) => [id, getSokobanAsset(id).url]));
});
onUnmounted(() => {
  clearPath();
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="sokoban" :class="{ 'reduce-motion': settings.reduceMotion }">
    <div class="sokoban-heading">
      <div>
        <span class="sokoban-kicker">大肥鱼 · 搬家日记</span>
        <h2>{{ level.title }}</h2>
        <p>{{ level.subtitle }}</p>
      </div>
      <div class="sokoban-progress">
        <strong>{{ progress }}</strong
        ><span>关卡完成</span>
      </div>
    </div>
    <div class="sokoban-layout">
      <section class="sokoban-board-panel" aria-label="推箱子棋盘">
        <div class="sokoban-levels" role="tablist" aria-label="选择关卡">
          <button
            v-for="(item, index) in levels"
            :key="item.id"
            type="button"
            :disabled="index >= unlocked"
            :class="{ active: index === levelIndex, completed: completed.includes(index) }"
            @click="selectLevel(index)"
          >
            {{ String(index + 1).padStart(2, '0') }}
          </button>
        </div>
        <div class="sokoban-board-wrap">
          <div
            class="sokoban-board"
            :style="boardStyle"
            role="grid"
            :aria-label="`第 ${levelIndex + 1} 关，${level.difficulty}`"
          >
            <button
              v-for="cell in cells"
              :key="cell.index"
              type="button"
              class="sokoban-cell"
              :class="{ wall: cell.wall, goal: cell.goal, target: routeTarget === cell.index }"
              :style="cellStyle(cell.index)"
              :aria-label="cell.wall ? '墙' : cell.goal ? '目标' : '地面'"
              @click="tapCell(cell.index)"
            >
              <img
                v-if="
                  cell.goal &&
                  assetUrl(game.boxes.has(cell.index) ? 'target_filled_01' : 'target_empty_01')
                "
                :src="assetUrl(game.boxes.has(cell.index) ? 'target_filled_01' : 'target_empty_01')"
                alt=""
              />
            </button>
            <div
              v-for="box in snapshot.boxes"
              :key="`box-${box}`"
              class="sokoban-entity sokoban-box"
              :class="{ placed: game.goals.has(box) }"
              :style="cellStyle(box)"
            >
              <img v-if="assetUrl('box_wood_01')" :src="assetUrl('box_wood_01')" alt="箱子" />
              <span v-else aria-hidden="true">📦</span>
            </div>
            <div class="sokoban-entity sokoban-player" :style="cellStyle(snapshot.player)">
              <img v-if="playerAsset()" :src="playerAsset()" alt="大肥鱼" />
              <span v-else aria-hidden="true">🐋</span>
            </div>
          </div>
        </div>
        <p class="sokoban-feedback" role="status" aria-live="polite">{{ feedback }}</p>
        <div class="sokoban-actions">
          <span
            >步数 {{ snapshot.moves }} · 推动 {{ snapshot.pushes }} · 已放 {{ placed }}/{{
              game.goals.size
            }}</span
          >
          <div>
            <button type="button" :disabled="!game.history.length" @click="undo">撤销</button
            ><button type="button" @click="restart">重开</button>
          </div>
        </div>
      </section>
      <aside class="sokoban-side" aria-label="大肥鱼提示">
        <div class="sokoban-portrait">
          <img
            v-if="assetUrl(showResult ? 'portrait_proud' : 'portrait_neutral')"
            :src="assetUrl(showResult ? 'portrait_proud' : 'portrait_neutral')"
            alt="陪你搬家的大肥鱼"
          />
          <span v-else aria-hidden="true">🐋</span>
        </div>
        <p>点空地走过去，靠近后点箱子推一格。</p>
        <small>电脑支持方向键 / WASD，Z 撤销，R 重开。</small>
        <details>
          <summary>给点思路</summary>
          <p>{{ level.hint }}</p>
        </details>
      </aside>
    </div>
    <div
      v-if="showResult && levelIndex < levels.length - 1"
      class="sokoban-level-result"
      role="status"
    >
      <strong>这一角，收拾好啦！</strong>
      <span>{{ snapshot.moves }} 步 · {{ snapshot.pushes }} 次推动</span>
      <button type="button" @click="nextLevel">继续下一关 →</button>
      <button type="button" @click="undo">撤销上一步</button>
    </div>
  </div>
</template>

<style scoped>
.sokoban {
  position: relative;
  padding: 24px;
  border: 1px solid #efe9df;
  border-radius: 24px;
  background: #fffdfa;
  color: #354a50;
}
.sokoban-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}
.sokoban-kicker {
  color: #839a96;
  font-size: 12px;
  letter-spacing: 2px;
}
.sokoban-heading h2 {
  margin: 4px 0;
  font-size: 26px;
}
.sokoban-heading p {
  margin: 0;
  color: #83908b;
  font-size: 13px;
}
.sokoban-progress {
  display: grid;
  text-align: right;
  font-size: 12px;
  color: #84968b;
}
.sokoban-progress strong {
  font-size: 22px;
  color: #46665b;
}
.sokoban-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 230px;
  gap: 24px;
  align-items: start;
}
.sokoban-board-panel {
  min-width: 0;
}
.sokoban-levels {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.sokoban-levels button,
.sokoban-actions button,
.sokoban-level-result button {
  min-width: 44px;
  min-height: 44px;
  border: 1px solid #dce9e0;
  border-radius: 12px;
  background: #fff;
  color: #527563;
  cursor: pointer;
}
.sokoban-levels .active {
  background: #5a8772;
  color: #fff;
}
.sokoban-levels .completed {
  border-color: #b3d2bd;
}
.sokoban-board-wrap {
  display: flex;
  justify-content: center;
  padding: 16px;
  border: 1px solid #e5eadc;
  border-radius: 20px;
  background: #eaf0e3;
}
.sokoban-board {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
  width: min(100%, 660px);
  aspect-ratio: var(--columns) / var(--rows);
  border-radius: 8px;
  overflow: hidden;
}
.sokoban-cell {
  min-width: 0;
  padding: 0;
  border: 1px solid rgb(166 189 149 / 24%);
  border-radius: 0;
  background: #eff4e7;
  cursor: pointer;
}
.sokoban-cell.wall {
  border-color: #aec7b3;
  background: linear-gradient(#b6cfbb, #a3c1aa);
  box-shadow: inset 0 -6px 0 #92b49b;
}
.sokoban-cell.goal {
  background: #f4edcf;
}
.sokoban-cell.target {
  box-shadow: inset 0 0 0 3px #9ebfaf;
}
.sokoban-cell img {
  width: 82%;
  height: 82%;
  object-fit: contain;
}
.sokoban-entity {
  display: grid;
  align-items: center;
  justify-items: center;
  pointer-events: none;
  z-index: 1;
  min-width: 0;
  min-height: 0;
}
.sokoban-entity img {
  width: 110%;
  height: 110%;
  object-fit: contain;
}
.sokoban-entity span {
  font-size: clamp(24px, 4vw, 58px);
}
.sokoban-box img {
  width: 94%;
  height: 94%;
}
.sokoban-box.placed {
  filter: drop-shadow(0 0 5px #e4b766);
}
.sokoban-player {
  z-index: 2;
}
.sokoban-feedback {
  min-height: 28px;
  margin: 14px 0 8px;
  font-size: 13px;
  color: #657e70;
}
.sokoban-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #74857a;
}
.sokoban-actions > div {
  display: flex;
  gap: 8px;
}
.sokoban-actions button {
  padding: 0 14px;
}
.sokoban-side {
  padding: 20px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid #eeeade;
}
.sokoban-portrait {
  display: grid;
  height: 210px;
  place-items: center;
  border-radius: 50%;
  background: radial-gradient(#e8f3eb, transparent 68%);
}
.sokoban-portrait img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.sokoban-portrait span {
  font-size: 90px;
}
.sokoban-side p {
  font-size: 14px;
  color: #60786c;
}
.sokoban-side small {
  color: #91a197;
}
.sokoban-side details {
  margin-top: 20px;
  font-size: 13px;
}
.sokoban-side summary {
  cursor: pointer;
}
.sokoban-level-result {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 22px;
  padding: 20px;
  border-radius: 18px;
  background: #eef6e9;
  color: #4b735b;
}
.sokoban-level-result button {
  padding: 0 18px;
}
@media (max-width: 760px) {
  .sokoban {
    padding: 14px;
  }
  .sokoban-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
  .sokoban-side {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 2px 14px;
    padding: 12px;
  }
  .sokoban-portrait {
    height: 76px;
    grid-row: span 3;
  }
  .sokoban-portrait span {
    font-size: 48px;
  }
  .sokoban-side p {
    margin: 3px 0;
  }
  .sokoban-side details {
    margin: 4px 0 0;
  }
  .sokoban-board-wrap {
    padding: 8px;
  }
  .sokoban-actions {
    align-items: flex-start;
  }
}
</style>
