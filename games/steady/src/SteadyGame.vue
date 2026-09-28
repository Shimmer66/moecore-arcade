<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import { STEADY_ART, STEADY_PROPS } from '@moecore/assets/steady';
import ArtSprite from './ArtSprite.vue';
import {
  GOAL_X,
  HEIGHT,
  CHALLENGES,
  TOOL_COST,
  available,
  challengeFor,
  isUnlocked,
  itemsUsed,
  starsFor,
  usedBudget,
  validateProgress,
  SHELF,
  STEP,
  TOOL_NAMES,
  USER,
  WIDTH,
  anchorPoint,
  createLayout,
  cutBalloons,
  goalY,
  moveProp,
  placeProp,
  removeProp,
  rotateProp,
  startScene,
  stepScene,
  toggleMagnets,
  type Layout,
  type Point,
  type Prop,
  type Scene,
  type Tool,
  type Progress,
} from './rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const PROGRESS_KEY = 'moecore:game:steady:v1:campaign';
const storageNote = ref('');
function readProgress(): Progress {
  try {
    return validateProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}'));
  } catch {
    return {};
  }
}
const progress = shallowRef<Progress>(readProgress());
const initialLevel =
  CHALLENGES.find((c) => !progress.value[c.id])?.id ??
  CHALLENGES.find((c) => (progress.value[c.id]?.stars ?? 0) < 3)?.id ??
  'free';
const layout = shallowRef<Layout>(createLayout(initialLevel));
const challenge = computed(() => challengeFor(layout.value));
const freePlay = computed(() => layout.value.levelId === 'free');
const nextChallenge = computed(
  () => CHALLENGES[CHALLENGES.findIndex((c) => c.id === layout.value.levelId) + 1],
);
const totalStars = computed(() =>
  Object.values(progress.value).reduce((sum, r) => sum + r.stars, 0),
);
const showTip = ref(false);
const artFailed = ref(false);
const scene = shallowRef<Scene | null>(null);
const history = shallowRef<Layout[]>([]);
const oldTrail = shallowRef<Point[]>([]);
const selected = ref<number | null>(null);
const tool = ref<Tool | null>(null);
const stage = ref<SVGSVGElement>();
const slow = ref(false);
const attempts = ref(0);
const discoveries = ref<string[]>([]);
const hint = ref('选一个亮起的道具，在房间里点一下，再拖动调整位置。');
const definitions: Array<{ tool: Tool; icon: string; note: string }> = [
  { tool: 'pad', icon: '↗', note: '落上去，弹出去' },
  { tool: 'balloon', icon: '↑', note: '绑在人或锅上' },
  { tool: 'pot', icon: '⌒', note: '戴上后会被磁铁吸' },
  { tool: 'magnet', icon: '∩', note: '所有铁锅都会被吸引' },
];
const toolSprites = {
  pad: STEADY_PROPS.pad,
  magnet: STEADY_PROPS.magnet,
  balloon: STEADY_PROPS.balloon,
  pot: STEADY_PROPS.pot,
};
const editing = computed(() => scene.value === null);
const running = computed(() => scene.value?.phase === 'running');
const selectedProp = computed(() => layout.value.props.find((p) => p.id === selected.value));
const user = computed(
  () =>
    scene.value?.bodies[0] ?? {
      ...USER,
      vx: 0,
      vy: 0,
      metal: layout.value.props.some((p) => p.tool === 'pot' && p.attach === 0),
      balloons: 0,
    },
);
const pots = computed(
  () =>
    scene.value?.bodies.filter((b) => b.type === 'pot' && b.x > 0) ??
    layout.value.props.filter((p) => p.tool === 'pot' && p.attach === null),
);
const balloons = computed(() =>
  scene.value
    ? scene.value.bodies.flatMap((b) =>
        scene.value?.cut || b.x < 0
          ? []
          : Array.from({ length: b.balloons }, (_, i) => ({
              id: `${b.id}-${i}`,
              x: b.x + (i - (b.balloons - 1) / 2) * 31,
              y: b.y - 65,
            })),
      )
    : layout.value.props
        .filter((p) => p.tool === 'balloon')
        .map((p) => {
          const anchor = anchorPoint(layout.value, p.attach);
          const siblings = layout.value.props.filter(
            (q) => q.tool === 'balloon' && q.attach === p.attach,
          );
          return {
            id: String(p.id),
            x:
              anchor.x +
              (siblings.findIndex((q) => q.id === p.id) - (siblings.length - 1) / 2) * 31,
            y: anchor.y - 65,
          };
        }),
);
const speech = computed(() => scene.value?.message ?? '我会稳稳地接住你。你……先别乱绑东西。');
const gptArt = computed(() =>
  scene.value?.phase === 'failed' ||
  (running.value && Math.hypot(user.value.vx, user.value.vy) > 350)
    ? STEADY_ART.gptStrain
    : STEADY_ART.gptReady,
);
let drag: { id: number; pointer: number; before: Layout } | null = null;
let raf = 0;
let last = 0;
let accumulator = 0;
let recorded = false;
const drafts = new Map<string, Layout>();

function selectChallenge(id: string) {
  if (running.value || props.paused || !isUnlocked(id, progress.value)) return;
  cancelDrag();
  drafts.set(layout.value.levelId, layout.value);
  layout.value = drafts.get(id) ?? createLayout(id);
  scene.value = null;
  history.value = [];
  oldTrail.value = [];
  selected.value = null;
  tool.value = null;
  attempts.value = 0;
  recorded = false;
  showTip.value = false;
  accumulator = 0;
  hint.value = challengeFor(layout.value).brief;
}

function remember(next: Layout) {
  if (next === layout.value) return;
  history.value = [...history.value.slice(-29), layout.value];
  layout.value = next;
}
function choose(kind: Tool) {
  if (!editing.value || props.paused) return;
  tool.value = tool.value === kind ? null : kind;
  selected.value = null;
  hint.value =
    kind === 'balloon'
      ? '把气球点在人或锅上，它会一起升起来。'
      : kind === 'pot'
        ? '点在人头上就是头盔；点在空中就是一口会掉下来的锅。'
        : kind === 'pad'
          ? '放在人下面，再选中蹦床调整角度。'
          : '磁铁只吸铁锅。人戴着锅，也会一起被拉走。';
}
function addAt(point: Point) {
  if (!tool.value) return;
  const next = placeProp(layout.value, tool.value, point);
  if (next === layout.value) {
    hint.value =
      tool.value === 'balloon'
        ? '气球需要绑在人或锅上，靠近一点再放。'
        : '这个道具已经用完，或人头上已经有锅了。';
    return;
  }
  remember(next);
  selected.value = next.props[next.props.length - 1]!.id;
  tool.value = null;
  hint.value = '可以拖动调整位置。准备好了就放手，看看会发生什么。';
}
function defaultPlace() {
  if (!tool.value) return;
  addAt(
    tool.value === 'pad' ? { x: 125, y: 310 } : tool.value === 'magnet' ? { x: 543, y: 177 } : USER,
  );
}
function point(event: PointerEvent): Point {
  const r = stage.value!.getBoundingClientRect();
  return {
    x: ((event.clientX - r.left) / r.width) * WIDTH,
    y: ((event.clientY - r.top) / r.height) * HEIGHT,
  };
}
function selectProp(event: PointerEvent, p: Prop) {
  if (!editing.value || props.paused || drag) return;
  if (tool.value) {
    addAt(point(event));
    return;
  }
  if (p.fixed) {
    selected.value = null;
    hint.value = '这是本关指定的锅，起点固定。可以给它绑气球。';
    return;
  }
  event.preventDefault();
  selected.value = p.id;
  drag = { id: p.id, pointer: event.pointerId, before: layout.value };
  stage.value?.setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
  if (!drag || drag.pointer !== event.pointerId || props.paused) return;
  layout.value = moveProp(layout.value, drag.id, point(event));
}
function endDrag(event: PointerEvent) {
  if (!drag || drag.pointer !== event.pointerId) return;
  const before = drag.before;
  const id = drag.pointer;
  drag = null;
  if (JSON.stringify(before) !== JSON.stringify(layout.value))
    history.value = [...history.value.slice(-29), before];
  if (stage.value?.hasPointerCapture(id)) stage.value.releasePointerCapture(id);
}
function cancelDrag() {
  if (!drag) return;
  layout.value = drag.before;
  const id = drag.pointer;
  drag = null;
  if (stage.value?.hasPointerCapture(id)) stage.value.releasePointerCapture(id);
}
function stageDown(event: PointerEvent) {
  if (!editing.value || props.paused || (event.pointerType === 'mouse' && event.button !== 0))
    return;
  if (tool.value) addAt(point(event));
  else selected.value = null;
}
function nudge(event: KeyboardEvent, p: Prop) {
  if (!editing.value || props.paused || p.fixed) return;
  const moves: Record<string, Point> = {
    ArrowLeft: { x: -10, y: 0 },
    ArrowRight: { x: 10, y: 0 },
    ArrowUp: { x: 0, y: -10 },
    ArrowDown: { x: 0, y: 10 },
  };
  if (moves[event.key]) {
    event.preventDefault();
    const by = moves[event.key]!;
    remember(moveProp(layout.value, p.id, { x: p.x + by.x, y: p.y + by.y }));
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    remember(removeProp(layout.value, p.id));
    selected.value = null;
  } else if (event.key.toLowerCase() === 'q' || event.key.toLowerCase() === 'e') {
    event.preventDefault();
    remember(rotateProp(layout.value, p.id, event.key.toLowerCase() === 'q' ? -10 : 10));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selected.value = p.id;
  }
}
function undo() {
  if (!editing.value || !history.value.length) return;
  cancelDrag();
  layout.value = history.value[history.value.length - 1]!;
  history.value = history.value.slice(0, -1);
  selected.value = null;
  tool.value = null;
}
function run() {
  if (props.paused || !editing.value) return;
  cancelDrag();
  scene.value = startScene(layout.value);
  attempts.value += 1;
  selected.value = null;
  tool.value = null;
  recorded = false;
  accumulator = 0;
  last = 0;
}
function editAgain() {
  if (scene.value) oldTrail.value = scene.value.trail;
  scene.value = null;
  accumulator = 0;
  recorded = false;
  hint.value = '虚线是上次路线。移动一个道具、转个角度，再试一次。';
}
function report() {
  if (!scene.value || scene.value.phase !== 'success') return;
  emit('finish', {
    gameId: 'steady',
    sessionId: props.sessionId,
    outcome: 'win',
    durationMs: Math.round(scene.value.time * 1000),
    summary: `${challenge.value.title} · ${starsFor(layout.value, scene.value)} 星 · 尝试 ${attempts.value} 次 · 本地累计 ${totalStars.value}/15 星`,
    story: { title: '承诺兑现，过程离谱。', body: scene.value.message },
    stats: {
      attempts: attempts.value,
      gadgets: itemsUsed(layout.value),
      stars: starsFor(layout.value, scene.value),
      discoveries: discoveries.value.length,
      bounces: scene.value.bounces,
      pots: scene.value.caughtPots,
    },
  });
}
function recordResult() {
  if (recorded || scene.value?.phase !== 'success') return;
  recorded = true;
  if (!freePlay.value) {
    const old = progress.value[layout.value.levelId];
    progress.value = {
      ...progress.value,
      [layout.value.levelId]: {
        stars: Math.max(old?.stars ?? 0, starsFor(layout.value, scene.value)),
        time: Math.min(old?.time ?? 15, scene.value.time),
        items: Math.min(old?.items ?? 99, itemsUsed(layout.value)),
      },
    };
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress.value));
    } catch {
      storageNote.value = '浏览器未能保存进度，本次游玩仍可继续。';
    }
  }
  const found = [...discoveries.value];
  if (scene.value.bounces > 0) found.push('蹦床救场');
  if (layout.value.side === 'ceiling') found.push('上天接人');
  if (scene.value.magnetic) found.push('磁力甩锅');
  if (scene.value.caughtPots > 0) found.push('连锅兜底');
  discoveries.value = [...new Set(found)];
}
function frame(time: number) {
  const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
  last = time;
  if (!props.paused && running.value && scene.value) {
    accumulator += dt * (slow.value ? 0.5 : 1);
    while (accumulator >= STEP && scene.value.phase === 'running') {
      scene.value = stepScene(scene.value, layout.value);
      accumulator -= STEP;
    }
    recordResult();
  } else accumulator = 0;
  raf = requestAnimationFrame(frame);
}
watch(
  () => props.paused,
  () => {
    cancelDrag();
    accumulator = 0;
    last = 0;
  },
);
onMounted(() => {
  raf = requestAnimationFrame(frame);
});
onUnmounted(() => {
  cancelAnimationFrame(raf);
  cancelDrag();
});
</script>

<template>
  <section
    class="workshop"
    :data-phase="scene?.phase ?? 'editing'"
    :data-level="layout.levelId"
    data-testid="steady-workshop"
  >
    <header class="workshop-heading">
      <div>
        <span class="eyebrow">承诺实验室 / 你负责整活</span>
        <h2>稳稳<span>接住你。</span></h2>
      </div>
      <div class="progress-badge">
        <span>救援档案</span><strong>★ {{ totalStars }}<small> / 15</small></strong>
      </div>
    </header>
    <nav class="challenge-list" aria-label="救援挑战">
      <button
        v-for="(c, i) in CHALLENGES"
        :key="c.id"
        type="button"
        :disabled="running || !isUnlocked(c.id, progress)"
        :aria-pressed="layout.levelId === c.id"
        :aria-label="`${i + 1}. ${c.title}`"
        :title="c.title"
        @click="selectChallenge(c.id)"
      >
        <span>{{ String(i + 1).padStart(2, '0') }}</span
        ><b>{{ c.title }}</b
        ><small
          >{{ '★'.repeat(progress[c.id]?.stars ?? 0)
          }}{{ '☆'.repeat(3 - (progress[c.id]?.stars ?? 0)) }}</small
        >
      </button>
      <button
        type="button"
        :disabled="running"
        :aria-pressed="freePlay"
        @click="selectChallenge('free')"
      >
        <span>∞</span><b>自由整活</b><small>全部道具</small>
      </button>
    </nav>
    <div class="challenge-brief">
      <div>
        <b>{{ challenge.title }}</b
        ><span>{{ challenge.brief }}</span>
      </div>
      <button type="button" :aria-expanded="showTip" @click="showTip = !showTip">
        {{ showTip ? '收起提示' : '给点思路' }}
      </button>
      <p v-if="showTip" class="mission-tip">{{ challenge.tip }}</p>
    </div>
    <div class="workshop-layout">
      <div
        class="room-column"
        :class="{
          'is-observing': !editing,
          'is-running': running,
          'is-failed': scene?.phase === 'failed',
          'is-won': scene?.phase === 'success',
        }"
      >
        <div class="room-status">
          <b>{{
            editing
              ? '布置中'
              : running
                ? '救援进行中'
                : scene?.phase === 'success'
                  ? '接住了！'
                  : '差一点，改改布置'
          }}</b
          ><span>{{
            scene
              ? scene.time.toFixed(1) + 's'
              : freePlay
                ? itemsUsed(layout) + ' 件道具'
                : `预算 ${usedBudget(layout)} / ${challenge.budget}`
          }}</span>
        </div>
        <div class="tool-grid room-palette">
          <button
            v-for="item in definitions"
            :key="item.tool"
            type="button"
            :class="{ chosen: tool === item.tool }"
            :disabled="!editing || available(layout, item.tool) <= 0"
            :aria-pressed="tool === item.tool"
            :aria-label="`添加${TOOL_NAMES[item.tool]}`"
            :title="`${item.note} · ${TOOL_COST[item.tool]} 点预算`"
            @click="choose(item.tool)"
          >
            <svg class="tool-art" :viewBox="toolSprites[item.tool].viewBox" aria-hidden="true">
              <image
                :href="toolSprites[item.tool].url"
                :width="toolSprites[item.tool].width"
                :height="toolSprites[item.tool].height"
              />
            </svg>
            <strong>{{ TOOL_NAMES[item.tool] }}</strong
            ><small>{{
              available(layout, item.tool) > 0 ? '× ' + available(layout, item.tool) : '不可用'
            }}</small
            ><span>{{ item.note }}</span>
          </button>
        </div>
        <svg
          ref="stage"
          class="room"
          :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
          role="application"
          aria-label="承诺实验室：选择道具后点击放置，拖动道具调整位置。"
          data-testid="workshop-room"
          @pointerdown="stageDown"
          @pointermove="move"
          @pointerup="endDrag"
          @pointercancel="cancelDrag"
          @lostpointercapture="cancelDrag"
          @contextmenu.prevent
        >
          <image
            :href="STEADY_ART.room"
            width="640"
            height="610"
            preserveAspectRatio="xMidYMid slice"
          />
          <rect
            x="24"
            y="54"
            width="592"
            height="523"
            rx="12"
            fill="#11182a18"
            stroke="#7581b9"
            stroke-width="2"
            opacity=".8"
          />
          <g v-if="challenge.wind" opacity=".48" aria-hidden="true">
            <path
              v-for="y in [200, 270, 410]"
              :key="y"
              :d="`M45 ${y}h90m-15-6 15 6-15 6 M415 ${y}h130m-15-6 15 6-15 6`"
              stroke="#83a8b7"
              stroke-width="3"
              fill="none"
              stroke-linecap="round"
            />
            <text x="325" y="52" text-anchor="middle" fill="#6d96a5" font-size="13">
              穿堂风持续往右吹 →
            </text>
          </g>
          <rect x="59" y="71" width="132" height="90" rx="6" fill="#606fb647" opacity=".6" />
          <text x="125" y="83" text-anchor="middle" font-size="19" fill="#e0e6ff">放手起点</text>
          <path
            v-if="editing"
            d="M125 55v43"
            stroke="#a2b6ef"
            stroke-width="2"
            stroke-dasharray="4 4"
          />
          <ArtSprite
            :art="STEADY_PROPS.shelf"
            :x="SHELF.x"
            :y="SHELF.y - 1"
            :width="SHELF.width"
            :height="22"
          />
          <path
            d="M36 580l14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12 14-12 14 12"
            stroke="#e7949e"
            stroke-width="3"
            fill="none"
          />
          <text x="210" y="602" text-anchor="middle" font-size="17" fill="#edb6c6">落空区域</text>
          <polyline
            v-if="oldTrail.length && editing"
            :points="oldTrail.map((p) => `${p.x},${p.y}`).join(' ')"
            fill="none"
            stroke="#cba4ef"
            stroke-width="2.5"
            stroke-dasharray="4 6"
            opacity=".55"
          />
          <polyline
            v-if="scene"
            :points="scene.trail.map((p) => `${p.x},${p.y}`).join(' ')"
            fill="none"
            stroke="#95f2d3"
            stroke-width="2"
            stroke-dasharray="3 6"
            opacity=".65"
          />
          <g :transform="`translate(${GOAL_X}, ${goalY(layout.side)})`" data-testid="workshop-goal">
            <rect
              :x="-challenge.goalWidth - 2"
              :y="layout.side === 'floor' ? -52 : 0"
              :width="challenge.goalWidth * 2 + 4"
              height="53"
              rx="15"
              fill="#80e1c426"
              stroke="#84edcf"
              stroke-dasharray="5 5"
            />
            <path
              :d="`M${-challenge.goalWidth} 0H${challenge.goalWidth}`"
              stroke="#9ffbe2"
              stroke-width="4"
              stroke-linecap="round"
            />
            <svg
              x="-28"
              :y="layout.side === 'floor' ? 16 : -62"
              width="56"
              height="56"
              viewBox="280 170 700 700"
            >
              <image :href="gptArt" width="1254" height="1254" />
            </svg>
            <text
              :y="layout.side === 'floor' ? 86 : 74"
              text-anchor="middle"
              font-size="18"
              font-weight="800"
              fill="#bafbe5"
            >
              GPT 接应
            </text>
          </g>

          <g
            v-for="p in layout.props.filter((p) => p.tool === 'magnet')"
            :key="p.id"
            :transform="`translate(${p.x},${p.y})`"
            role="button"
            :tabindex="editing ? 0 : -1"
            :aria-label="`磁铁 ${p.id}，可拖动`"
            :data-testid="`prop-${p.id}`"
            @pointerdown.stop="selectProp($event, p)"
            @keydown="nudge($event, p)"
          >
            <circle
              r="44"
              fill="transparent"
              :stroke="selected === p.id ? '#ddc5ff' : 'none'"
              stroke-dasharray="4 4"
            />
            <circle
              v-if="scene?.powered && scene.phase === 'running'"
              r="64"
              fill="none"
              stroke="#edb3ef"
              opacity=".35"
              stroke-dasharray="5 7"
            />
            <ArtSprite :art="STEADY_PROPS.magnet" :x="-32" :y="-32" :width="64" :height="64" />
            <text v-if="editing" y="45" text-anchor="middle" fill="#e2b9ff" font-size="11">
              {{ scene && !scene.powered ? '已断电' : '只吸铁锅' }}
            </text>
          </g>
          <g
            v-for="p in layout.props.filter((p) => p.tool === 'pad')"
            :key="p.id"
            :transform="`translate(${p.x},${p.y}) rotate(${p.angle})`"
            role="button"
            :tabindex="editing ? 0 : -1"
            :aria-label="`蹦床 ${p.id}，角度 ${p.angle} 度，可拖动`"
            :data-testid="`prop-${p.id}`"
            @pointerdown.stop="selectProp($event, p)"
            @keydown="nudge($event, p)"
          >
            <rect
              x="-83"
              y="-31"
              width="166"
              height="62"
              rx="10"
              fill="transparent"
              :stroke="selected === p.id ? '#ddc5ff' : 'none'"
              stroke-dasharray="4 4"
            />
            <ArtSprite :art="STEADY_PROPS.pad" :x="-78" :y="-2" :width="156" :height="36" />
          </g>

          <g
            v-for="p in pots"
            :key="p.id"
            :transform="`translate(${p.x},${p.y})`"
            :data-testid="`pot-${p.id}`"
          >
            <g
              v-if="editing"
              role="button"
              tabindex="0"
              :aria-label="`锅 ${p.id}，${layout.props.find((q) => q.id === p.id)?.fixed ? '指定起点不可移动' : '可拖动'}`"
              @pointerdown.stop="
                selectProp(
                  $event,
                  layout.props.find((q) => q.id === p.id)!,
                )
              "
              @keydown="
                nudge(
                  $event,
                  layout.props.find((q) => q.id === p.id)!,
                )
              "
            >
              <circle
                r="38"
                fill="transparent"
                :stroke="selected === p.id ? '#ddc5ff' : 'none'"
                stroke-dasharray="4 4"
              />
            </g>
            <ArtSprite :art="STEADY_PROPS.pot" :x="-31" :y="-21" :width="62" :height="42" />
            <text
              v-if="editing && layout.props.find((q) => q.id === p.id)?.fixed"
              y="-34"
              text-anchor="middle"
              fill="#fee1af"
              font-size="11"
              pointer-events="none"
            >
              指定的锅
            </text>
          </g>
          <g
            :transform="`translate(${user.x},${user.y})`"
            data-testid="workshop-user"
            :data-caught="scene?.bodies[0]?.caught ?? false"
          >
            <circle r="30" fill="transparent" />
            <svg
              v-if="!artFailed"
              x="-26"
              y="-45"
              width="52"
              height="78"
              viewBox="245 45 790 1200"
              class="player-sprite"
            >
              <image
                :href="STEADY_ART.user"
                width="1254"
                height="1254"
                data-testid="steady-user-art"
                @error="artFailed = true"
              />
            </svg>
            <g v-else>
              <rect x="-17" y="0" width="34" height="24" rx="10" fill="#bca0c8" />
              <circle cy="-8" r="18" fill="#ffe0bb" stroke="#84624b" stroke-width="2" />
              <path d="M-18-12q-2-23 19-18 13 0 17 17-11-2-19-9-4 9-17 10" fill="#705343" />
              <circle cx="-6" cy="-8" r="2" fill="#654535" />
              <circle cx="6" cy="-8" r="2" fill="#654535" />
              <path d="M-4 1q4 4 8 0" stroke="#b87966" stroke-width="2" fill="none" />
            </g>
            <g
              v-if="user.metal"
              role="button"
              :tabindex="editing ? 0 : -1"
              aria-label="锅头盔，可拖动或移除"
              @pointerdown.stop="
                editing &&
                selectProp(
                  $event,
                  layout.props.find((p) => p.tool === 'pot' && p.attach === 0)!,
                )
              "
              @keydown="
                editing &&
                nudge(
                  $event,
                  layout.props.find((p) => p.tool === 'pot' && p.attach === 0)!,
                )
              "
            >
              <circle cy="-28" r="29" fill="transparent" />
              <g transform="rotate(180 0 -39)">
                <ArtSprite :art="STEADY_PROPS.pot" :x="-31" :y="-58" :width="62" :height="38" />
              </g>
            </g>
            <text
              v-if="editing || running"
              y="42"
              text-anchor="middle"
              fill="#e4eaff"
              font-size="12"
            >
              {{ user.metal ? '戴锅的用户' : '用户' }}
            </text>
          </g>
          <g
            v-for="b in balloons"
            :key="b.id"
            :transform="`translate(${b.x},${b.y})`"
            role="button"
            :tabindex="editing ? 0 : -1"
            :aria-label="`气球 ${b.id}，可拖动`"
            @pointerdown.stop="
              editing &&
              selectProp(
                $event,
                layout.props.find((p) => p.id === Number(b.id))!,
              )
            "
            @keydown="
              editing &&
              nudge(
                $event,
                layout.props.find((p) => p.id === Number(b.id))!,
              )
            "
          >
            <circle r="31" fill="transparent" />
            <path d="M0 21v44" stroke="#e6d6f5" stroke-width="1.8" />
            <ArtSprite :art="STEADY_PROPS.balloon" :x="-18" :y="-22" :width="36" :height="44" />
          </g>
          <g v-if="editing && tool">
            <rect
              x="77"
              y="397"
              width="330"
              height="40"
              rx="15"
              fill="#fff"
              fill-opacity=".93"
              stroke="#9380d1"
            />
            <text x="242" y="422" text-anchor="middle" fill="#735aa6" font-size="14">
              点击房间放置{{ TOOL_NAMES[tool] }}
            </text>
          </g>
        </svg>
        <div v-if="editing" class="edit-controls">
          <div class="tools-heading">
            <span class="eyebrow">{{
              selectedProp ? '调整道具' : tool ? '选择放置位置' : '选择道具 · 拖动布置'
            }}</span
            ><button type="button" :disabled="!editing || !history.length" @click="undo">
              ↶ 撤销
            </button>
          </div>
          <p class="build-hint" role="status">{{ hint }}</p>
          <button v-if="tool && editing" class="suggestion" type="button" @click="defaultPlace">
            放到建议位置
          </button>
          <div v-if="selectedProp && !selectedProp.fixed && editing" class="selected-prop">
            <strong
              >{{ TOOL_NAMES[selectedProp.tool] }}
              {{ selectedProp.tool === 'pad' ? selectedProp.angle + '°' : '' }}</strong
            >
            <div v-if="selectedProp.tool === 'pad'" class="rotate-controls">
              <button
                type="button"
                aria-label="蹦床逆时针旋转"
                @click="remember(rotateProp(layout, selectedProp.id, -10))"
              >
                <span>↶ -10°</span>
              </button>
              <button
                type="button"
                aria-label="蹦床顺时针旋转"
                @click="remember(rotateProp(layout, selectedProp.id, 10))"
              >
                ↷ +10°
              </button>
            </div>
            <button
              type="button"
              @click="
                remember(removeProp(layout, selectedProp.id));
                selected = null;
              "
            >
              移走这个道具
            </button>
          </div>
        </div>
        <div class="experiment-actions">
          <button v-if="editing" class="primary" type="button" @click="run">放手，看看 ↗</button>
          <button v-else class="primary" type="button" @click="editAgain">
            {{ running ? '停下，改布置' : '改一点，再试' }}
          </button>
          <button
            v-if="running"
            type="button"
            :disabled="scene!.cut || !scene!.bodies.some((b) => b.balloons)"
            @click="scene = cutBalloons(scene!)"
          >
            ✂ 剪断气球
          </button>
          <button
            v-if="running"
            type="button"
            :disabled="!layout.props.some((p) => p.tool === 'magnet')"
            @click="scene = toggleMagnets(scene!)"
          >
            {{ scene!.powered ? '磁铁断电' : '磁铁通电' }}
          </button>
          <button v-if="scene?.phase === 'success'" type="button" @click="report">
            完成这次实验
          </button>
          <button
            v-if="scene?.phase === 'success' && !freePlay && nextChallenge"
            type="button"
            class="primary"
            @click="selectChallenge(nextChallenge.id)"
          >
            下一关 →
          </button>
          <label class="slow"><input v-model="slow" type="checkbox" />慢放</label>
        </div>
        <div class="speech">
          <img :src="gptArt" alt="GPT 白龙娘的反应" width="68" height="68" />
          <div>
            <b>GPT</b><span role="status">{{ speech }}</span>
          </div>
        </div>
        <div
          v-if="scene && !running"
          class="result-note"
          :class="{ won: scene.phase === 'success' }"
          data-testid="workshop-result"
        >
          <strong>{{
            scene.phase === 'success' ? '这条离谱路线，成立。' : '这次没接住。轨迹已经留下了。'
          }}</strong>
          <div
            v-if="scene.phase === 'success' && !freePlay"
            class="earned-stars"
            :aria-label="`本关 ${starsFor(layout, scene)} 星`"
          >
            {{ '★'.repeat(starsFor(layout, scene)) }}{{ '☆'.repeat(3 - starsFor(layout, scene)) }}
          </div>
          <span>{{
            scene.phase === 'success'
              ? '还可以改一件道具，看看会不会产生另一种结果。'
              : '回到布置，虚线会显示上次怎么走偏的。'
          }}</span>
        </div>
      </div>

      <aside class="workshop-tools">
        <details class="mission-card">
          <summary>三星目标与玩法</summary>
          <ul v-if="!freePlay">
            <li>★ 完成本关救援</li>
            <li>★ 自放道具不超过 {{ challenge.parItems }} 件</li>
            <li>★ 剪绳、断电等调整不超过 {{ challenge.parActions }} 次</li>
          </ul>
          <p>锅会导磁，气球提供浮力，蹦床按角度反弹。</p>
        </details>
        <div v-if="freePlay" class="catch-choice">
          <span>让 GPT 在哪接？</span>
          <div>
            <button
              type="button"
              :disabled="!editing"
              :aria-pressed="layout.side === 'floor'"
              @click="remember({ ...layout, side: 'floor' })"
            >
              <span>↓ 地面</span>
            </button>
            <button
              type="button"
              :disabled="!editing"
              :aria-pressed="layout.side === 'ceiling'"
              @click="remember({ ...layout, side: 'ceiling' })"
            >
              ↑ 天花板
            </button>
          </div>
          <label
            ><input
              type="checkbox"
              :checked="layout.allPots"
              :disabled="!editing"
              @change="remember({ ...layout, allPots: !layout.allPots })"
            />连松散的锅也要接住</label
          >
        </div>
        <div class="discoveries">
          <span class="eyebrow">试出你自己的路线 · {{ discoveries.length }}/4</span
          ><span
            v-for="name in ['蹦床救场', '上天接人', '磁力甩锅', '连锅兜底']"
            :key="name"
            :class="{ found: discoveries.includes(name) }"
            >{{ discoveries.includes(name) ? '✓' : '○' }} {{ name }}</span
          >
        </div>
        <p class="footnote">
          <span v-if="storageNote">{{ storageNote }}<br /></span>
          方向键微调 · Q / E 旋转<br />原创戏仿 · 本地物理 · 无模型调用
        </p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.workshop {
  --ink: #eef0ff;
  --muted: #aab4d0;
  color: var(--ink);
  background: #191f36;
  padding: 22px;
  border: 1px solid #343d60;
  border-radius: 22px;
  box-shadow: 0 16px 42px #15192d20;
}
.workshop-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0 auto 20px;
  max-width: 1000px;
}
.eyebrow {
  color: #a9b6d9;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 1px;
}
.workshop-heading h2 {
  color: #fff;
  font-size: 32px;
  line-height: 1.2;
  letter-spacing: -1px;
  margin: 6px 0 0;
}
.workshop-heading h2 span {
  color: #8ae8cf;
}
.progress-badge {
  display: grid;
  gap: 5px;
  text-align: right;
  flex-shrink: 0;
}
.progress-badge > span {
  font-size: 12px;
  color: var(--muted);
}
.progress-badge strong {
  color: #f5d38a;
  font-size: 22px;
}
.progress-badge small {
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}
button {
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  color: #ecedff;
  background: #303a5d;
  border: 1px solid #46527a;
  border-radius: 10px;
  padding: 9px 12px;
  min-height: 44px;
  cursor: pointer;
  transition:
    background 0.12s,
    border-color 0.12s;
}
button:hover:not(:disabled) {
  background: #404b75;
  border-color: #b3a6ff;
}
button:disabled {
  color: #929cb9;
  background: #242b44;
  border-color: #353e5c;
  cursor: default;
  opacity: 1;
}
button:focus-visible,
summary:focus-visible {
  outline: 3px solid #8eedd2;
  outline-offset: 3px;
}
.challenge-list {
  display: flex;
  gap: 7px;
  max-width: 1000px;
  margin: 0 auto 14px;
}
.challenge-list button {
  flex: 1;
  display: grid;
  grid-template-columns: 22px 1fr;
  align-items: center;
  gap: 4px 6px;
  min-width: 0;
  padding: 10px;
  text-align: left;
  background: #222a45;
}
.challenge-list button > span {
  grid-row: span 2;
  color: #b5c2e4;
  font-size: 13px;
  text-align: center;
}
.challenge-list b {
  font-size: 12px;
  line-height: 1.5;
}
.challenge-list small {
  font-size: 11px;
  letter-spacing: 1px;
  color: #e7c77c;
}
.challenge-list button[aria-pressed='true'] {
  border-color: #ad9fff;
  background: #494273;
  box-shadow: inset 0 0 0 1px #a496fa;
}
.challenge-list button:disabled small {
  color: #7e8aaa;
}
.challenge-brief {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  max-width: 1000px;
  margin: 0 auto 16px;
  padding: 12px 14px;
  border-left: 3px solid #7ce0c7;
  border-radius: 0 10px 10px 0;
  background: #27314a;
}
.challenge-brief > div {
  flex: 1;
  min-width: 140px;
  display: grid;
  gap: 3px;
}
.challenge-brief b {
  color: #a4efda;
  font-size: 15px;
}
.challenge-brief span {
  color: #c3cfe5;
  font-size: 14px;
  line-height: 1.6;
}
.challenge-brief button {
  background: transparent;
  font-size: 13px;
  padding: 8px 10px;
}
.mission-tip {
  flex-basis: 100%;
  margin: 4px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #576586;
  color: #e0d8ff;
  font-size: 14px;
  line-height: 1.7;
}
.workshop-layout {
  display: grid;
  grid-template-columns: minmax(0, 640px) minmax(210px, 260px);
  justify-content: center;
  gap: 18px;
  max-width: 1000px;
  margin: auto;
  align-items: start;
}
.room-column {
  min-width: 0;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid #515e84;
  background: #252d49;
  box-shadow: 0 6px 0 #10172b;
}
.room-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 13px;
  min-height: 42px;
  font-size: 13px;
  background: #323b5b;
  color: #dbe3ff;
}
.room-status b::before {
  content: '';
  display: inline-block;
  vertical-align: middle;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ab9eff;
  margin-right: 8px;
}
.room-status span {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #c5d0ed;
}
.is-running .room-status b::before {
  background: #89e5c8;
}
.is-failed .room-status {
  color: #ffd8cb;
  background: #493342;
}
.is-failed .room-status b::before {
  background: #fcae96;
}
.is-won .room-status {
  color: #caffec;
  background: #294d4e;
}
.room-palette {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  padding: 9px;
  background: #202940;
  border-bottom: 1px solid #404b70;
}
.room-palette button {
  position: relative;
  min-width: 0;
  min-height: 74px;
  padding: 7px 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: #313a59;
  border-color: #46516f;
}
.room-palette .tool-art {
  width: 42px;
  height: 32px;
  overflow: visible;
}
.room-palette strong {
  font-size: 13px;
}
.room-palette small {
  position: absolute;
  right: 5px;
  top: 4px;
  font-size: 11px;
  color: #d2dcf3;
  background: #202840;
  border-radius: 4px;
  padding: 1px 3px;
}
.room-palette button > span {
  display: none;
}
.room-palette button.chosen {
  border-color: #beafff;
  background: #504478;
  box-shadow: inset 0 0 0 1px #beafff;
}
.room-palette button:disabled {
  background: #242d47;
  border-color: #343e5a;
}
.room-palette button:disabled .tool-art {
  opacity: 0.45;
  filter: saturate(0.25);
}
.room-palette button:disabled small {
  color: #a1acc7;
}
/* Keep the canvas in place when switching between editing and simulation. */
.room-column.is-observing .room-palette {
  pointer-events: none;
}
.room {
  width: 100%;
  display: block;
  touch-action: none;
  user-select: none;
  background: #202643;
}
.room [role='button'] {
  cursor: grab;
  outline: none;
}
.room [role='button']:focus-visible {
  outline: 2px dashed #ac99ff;
  outline-offset: 4px;
}
.sprite {
  pointer-events: none;
}
.player-sprite {
  filter: drop-shadow(0 1px 1px #fff6);
}
.edit-controls {
  padding: 10px 12px;
  background: #252e49;
  border-top: 1px solid #445073;
}
.tools-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tools-heading button {
  font-size: 13px;
  padding: 6px 10px;
}
.build-hint {
  color: #bdc9e5;
  font-size: 13px;
  line-height: 1.6;
  margin: 5px 0 0;
}
.suggestion {
  width: 100%;
  border-style: dashed;
  border-color: #8896bf;
  background: #313c5d;
  margin-top: 9px;
}
.selected-prop {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px solid #465274;
}
.selected-prop > strong {
  font-size: 14px;
  color: #e9ddff;
  margin-right: auto;
}
.rotate-controls {
  display: flex;
  gap: 6px;
}
.rotate-controls button {
  padding: 8px;
  font-size: 13px;
}
.selected-prop > button {
  font-size: 13px;
  background: transparent;
  color: #f0c5d6;
  padding: 8px;
}
.experiment-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: #20283f;
  border-top: 1px solid #3b4669;
}
.experiment-actions button {
  min-height: 46px;
  font-size: 14px;
}
.experiment-actions .primary {
  flex: 1;
  background: #94ecd3;
  border-color: #b3ffe8;
  color: #173936;
  font-weight: 850;
  box-shadow: 0 3px 0 #3f9281;
}
.experiment-actions .primary:hover:not(:disabled) {
  background: #b3ffe8;
  border-color: #d1fff0;
  color: #153e36;
}
.slow {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #c2cce4;
  padding: 0 4px;
}
.slow input {
  accent-color: #99e9d4;
  width: 17px;
  height: 17px;
}
.speech {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 68px;
  padding: 8px 12px;
  border-top: 1px solid #445073;
  background: #27314b;
}
.speech img {
  width: 54px;
  height: 54px;
  object-fit: contain;
  flex-shrink: 0;
}
.speech > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.speech b {
  font-size: 12px;
  color: #86e2c7;
  letter-spacing: 1px;
}
.speech span {
  font-size: 14px;
  line-height: 1.6;
  color: #edf0ff;
}
.result-note {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #473345;
  padding: 15px;
  color: #ffd3c2;
  font-size: 14px;
  line-height: 1.7;
}
.result-note span {
  font-size: 13px;
  color: #e8bdb0;
}
.result-note.won {
  background: #254b47;
  color: #c8ffe9;
}
.result-note.won span {
  color: #a6d9c7;
}
.earned-stars {
  color: #ffd477;
  font-size: 24px;
  letter-spacing: 5px;
}
.workshop-tools {
  min-width: 0;
}
.mission-card {
  padding: 0 15px;
  border: 1px solid #475276;
  border-radius: 12px;
  background: #28314d;
}
.mission-card summary {
  padding: 15px 0;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
}
.mission-card p {
  color: #bfcae3;
  font-size: 14px;
  line-height: 1.8;
}
.mission-card ul {
  list-style: none;
  padding: 10px 0;
  margin: 0;
  border-top: 1px solid #424e70;
  font-size: 13px;
  line-height: 2;
  color: #e6d39b;
}
.catch-choice {
  border: 1px solid #455174;
  padding: 15px;
  margin-top: 14px;
  border-radius: 12px;
  background: #222b45;
}
.catch-choice > span {
  font-size: 14px;
  color: #d8e1f5;
}
.catch-choice > div {
  display: flex;
  gap: 8px;
  margin: 10px 0;
}
.catch-choice button {
  flex: 1;
  padding: 8px;
  font-size: 13px;
}
.catch-choice button[aria-pressed='true'] {
  color: #b8ffdf;
  border-color: #74bca1;
  background: #304b48;
}
.catch-choice label {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: 7px;
  font-size: 13px;
  line-height: 1.7;
  color: #c0cde9;
}
.catch-choice input {
  accent-color: #83dabe;
}
.discoveries {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 8px;
  margin-top: 18px;
  padding: 16px 0;
  border-bottom: 1px solid #455174;
}
.discoveries .eyebrow {
  grid-column: span 2;
  font-size: 12px;
  letter-spacing: 0;
}
.discoveries > span:not(.eyebrow) {
  font-size: 13px;
  color: #a5b1ce;
}
.discoveries .found {
  color: #9df2ce;
  font-weight: 750;
}
.footnote {
  font-size: 12px;
  line-height: 1.9;
  color: #9fadd0;
  margin: 14px 0 0;
}
@media (min-width: 1001px) and (max-height: 900px) {
  .workshop-layout {
    grid-template-columns: minmax(0, min(580px, calc((100dvh - 270px) * 1.049))) 260px;
  }
}
@media (max-width: 1000px) {
  .workshop-layout {
    grid-template-columns: minmax(0, 1fr);
    max-width: 640px;
  }
  .workshop-tools {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .workshop-tools > * {
    margin: 0;
  }
  .catch-choice {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
  .challenge-list b {
    display: none;
  }
  .challenge-list button {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 3px;
    padding: 8px 4px;
  }
  .challenge-list button > span {
    grid-row: auto;
    font-size: 16px;
  }
  .challenge-list button:last-child {
    flex: 1.4;
  }
  .challenge-list button:last-child b {
    white-space: nowrap;
    display: block;
    font-size: 12px;
  }
  .challenge-list button:last-child small {
    display: none;
  }
}
@media (max-width: 600px) {
  .workshop {
    padding: 14px 9px;
    border-radius: 16px;
  }
  .workshop-heading {
    margin: 0 4px 15px;
  }
  .workshop-heading h2 {
    font-size: 27px;
  }
  .workshop-heading .eyebrow {
    font-size: 11px;
    letter-spacing: 0.5px;
  }
  .progress-badge strong {
    font-size: 19px;
  }
  .challenge-list {
    gap: 5px;
    margin-bottom: 10px;
  }
  .challenge-list small {
    font-size: 11px;
    letter-spacing: 0;
  }
  .challenge-brief {
    padding: 10px;
    margin-bottom: 12px;
    gap: 6px;
  }
  .challenge-brief > div {
    min-width: 0;
  }
  .challenge-brief span {
    font-size: 13px;
  }
  .challenge-brief button {
    padding: 6px;
    font-size: 12px;
  }
  .room-column {
    border-radius: 12px;
  }
  .room-palette {
    gap: 5px;
    padding: 7px;
  }
  .room-palette button {
    min-height: 72px;
  }
  .room-palette .tool-art {
    width: 37px;
    height: 30px;
  }
  .edit-controls {
    padding: 8px 10px;
  }
  .build-hint {
    font-size: 12px;
  }
  .selected-prop {
    gap: 6px;
  }
  .selected-prop > strong {
    width: 100%;
  }
  .selected-prop > button {
    margin-left: auto;
  }
  .experiment-actions {
    padding: 10px;
    gap: 6px;
  }
  .experiment-actions button {
    padding: 8px;
    font-size: 13px;
  }
  .speech {
    padding: 8px 10px;
  }
  .speech img {
    width: 45px;
    height: 48px;
  }
  .speech span {
    font-size: 13px;
  }
  .workshop-tools {
    width: 100%;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .catch-choice {
    grid-column: auto;
    grid-row: auto;
  }
  .discoveries {
    padding: 6px 4px 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
}
</style>
