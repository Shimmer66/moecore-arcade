<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  MousePointer2,
  Square,
  Zap,
  User,
  DoorOpen,
  Star,
  Trash2,
  Undo2,
  Redo2,
  Play,
  Save,
  Copy,
  Upload,
  X,
  FilePlus2,
  Users,
} from '@lucide/vue';
import { GENERATED_WORLD_ART as art } from '@moecore/assets/generated-world';
import type { Room } from './campaign';
import type { Rect, TrapEffect } from './traps';
import {
  newDraft,
  loadDraft,
  saveDraft,
  encodeRoom,
  decodeRoom,
  editorProblem,
  createTrap,
  EFFECT_NAMES,
} from './editor';
import CharacterSprite from './CharacterSprite.vue';

const props = defineProps<{ paused: boolean; initial: Room | null }>();
const emit = defineEmits<{ play: [room: Room]; close: []; draft: [room: Room] }>();
const stored = loadDraft();
const draft = ref<Room>(JSON.parse(JSON.stringify(props.initial ?? stored.room)));
const worldWidth = computed(() => draft.value.width ?? 1000);
const tool = ref<'select' | 'floor' | 'trap' | 'spawn' | 'exit' | 'secret' | 'clone'>('select');
const effect = ref<TrapEffect>('spikes');
const selected = ref<{
  kind: 'floor' | 'trap' | 'spawn' | 'exit' | 'secret' | 'clone';
  index: number;
} | null>(null);
const history = ref<string[]>([]),
  future = ref<string[]>([]);
const status = ref('');
const shareCode = ref('');
const savedCode = ref(encodeRoom(stored.room));
const drag = ref<{
  x: number;
  y: number;
  originX: number;
  originY: number;
  recorded: boolean;
} | null>(null);
const problem = computed(() => editorProblem(draft.value));
const currentCode = computed(() => {
  try {
    return encodeRoom(draft.value);
  } catch {
    return '';
  }
});
const verified = computed(() =>
  Boolean(currentCode.value && stored.verified === currentCode.value),
);
const target = computed(() => {
  const item = selected.value;
  if (!item) return undefined;
  return item.kind === 'floor'
    ? draft.value.floors[item.index]
    : item.kind === 'trap'
      ? draft.value.traps[item.index]?.body
      : item.kind === 'clone'
        ? draft.value.cloneSpawns?.[item.index]
        : draft.value[item.kind];
});
const box = computed(() =>
  target.value && 'w' in target.value ? (target.value as Rect) : undefined,
);
const selectedTrap = computed(() =>
  selected.value?.kind === 'trap' ? draft.value.traps[selected.value.index] : undefined,
);
const tools = [
  { id: 'select', label: '选择与移动', icon: MousePointer2 },
  { id: 'floor', label: '放置地形', icon: Square },
  { id: 'trap', label: '放置机关', icon: Zap },
  { id: 'spawn', label: '放置起点', icon: User },
  { id: 'exit', label: '放置出口', icon: DoorOpen },
  { id: 'secret', label: '放置秘密', icon: Star },
  { id: 'clone', label: '放置分身', icon: Users },
] as const;
function snapshot() {
  const value = JSON.stringify(draft.value);
  if (history.value.at(-1) !== value) history.value.push(value);
  if (history.value.length > 50) history.value.shift();
  future.value = [];
}
function save() {
  if (props.paused) return;
  emit('draft', JSON.parse(JSON.stringify(draft.value)));
  if (saveDraft(draft.value, verified.value)) {
    savedCode.value = currentCode.value;
    status.value = '草稿已保存';
  } else status.value = '草稿未能保存，请检查数据或浏览器存储。';
}
function restore(undo: boolean) {
  const from = undo ? history.value : future.value;
  const to = undo ? future.value : history.value;
  const value = from.pop();
  if (!value) return;
  to.push(JSON.stringify(draft.value));
  draft.value = JSON.parse(value);
  selected.value = null;
  save();
}
function hit(rect: Rect, x: number, y: number) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
function lastHit(rectangles: Rect[], x: number, y: number) {
  for (let i = rectangles.length - 1; i >= 0; i--) if (hit(rectangles[i]!, x, y)) return i;
  return -1;
}
function point(event: PointerEvent) {
  const bounds = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        worldWidth.value,
        Math.round((((event.clientX - bounds.left) / bounds.width) * worldWidth.value) / 10) * 10,
      ),
    ),
    y: Math.max(
      0,
      Math.min(440, Math.round(((event.clientY - bounds.top) / bounds.height) * 44) * 10),
    ),
  };
}
function floorY(x: number, y: number) {
  return (
    [...draft.value.floors]
      .filter((floor) => x >= floor.x && x + 32 <= floor.x + floor.w)
      .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0]?.y ?? 354
  );
}
function down(event: PointerEvent) {
  if (props.paused) return;
  const { x, y } = point(event);
  if (tool.value === 'select') {
    selected.value = null;
    if (hit({ x: draft.value.spawn.x - 20, y: draft.value.spawn.y - 24, w: 72, h: 72 }, x, y))
      selected.value = { kind: 'spawn', index: 0 };
    else if (hit(draft.value.exit, x, y)) selected.value = { kind: 'exit', index: 0 };
    else if (Math.hypot(x - draft.value.secret.x, y - draft.value.secret.y) < 22)
      selected.value = { kind: 'secret', index: 0 };
    else {
      const cloneIndex = lastHit(
        (draft.value.cloneSpawns ?? []).map((point) => ({
          x: point.x - 20,
          y: point.y - 24,
          w: 72,
          h: 72,
        })),
        x,
        y,
      );
      if (cloneIndex >= 0) selected.value = { kind: 'clone', index: cloneIndex };
      const trapIndex = lastHit(
        draft.value.traps.map((trap) => trap.body),
        x,
        y,
      );
      if (!selected.value && trapIndex >= 0) selected.value = { kind: 'trap', index: trapIndex };
      else if (!selected.value) {
        const floorIndex = lastHit(draft.value.floors, x, y);
        if (floorIndex >= 0) selected.value = { kind: 'floor', index: floorIndex };
      }
    }
    if (target.value) {
      drag.value = { x, y, originX: target.value.x, originY: target.value.y, recorded: false };
      (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
    }
    return;
  }
  snapshot();
  if (tool.value === 'floor') {
    if (draft.value.floors.length >= 80) return;
    draft.value.floors.push({ x: Math.min(worldWidth.value - 120, x), y, w: 120, h: 20 });
    selected.value = { kind: 'floor', index: draft.value.floors.length - 1 };
  } else if (tool.value === 'trap') {
    if (draft.value.traps.length >= 40) return;
    let n = 1;
    while (draft.value.traps.some((trap) => trap.id === `trap-${n}`)) n++;
    draft.value.traps.push(
      createTrap(
        effect.value,
        Math.min(worldWidth.value - 100, x),
        y,
        `trap-${n}`,
        worldWidth.value,
      ),
    );
    selected.value = { kind: 'trap', index: draft.value.traps.length - 1 };
  } else if (tool.value === 'clone') {
    draft.value.cloneSpawns ??= [];
    if (draft.value.cloneSpawns.length >= 3) return;
    draft.value.cloneSpawns.push({
      x: Math.min(worldWidth.value - 32, x),
      y: floorY(Math.min(worldWidth.value - 32, x), y) - 48,
    });
    selected.value = { kind: 'clone', index: draft.value.cloneSpawns.length - 1 };
  } else if (tool.value === 'spawn') {
    draft.value.spawn = {
      x: Math.min(worldWidth.value - 32, x),
      y: floorY(Math.min(worldWidth.value - 32, x), y) - 48,
    };
    selected.value = { kind: 'spawn', index: 0 };
  } else if (tool.value === 'exit') {
    draft.value.exit = {
      x: Math.min(worldWidth.value - 64, x),
      y: floorY(Math.min(worldWidth.value - 64, x), y) - 62,
      w: 64,
      h: 62,
    };
    selected.value = { kind: 'exit', index: 0 };
  } else {
    draft.value.secret = { x, y };
    selected.value = { kind: 'secret', index: 0 };
  }
  save();
}
function move(event: PointerEvent) {
  if (!drag.value || !target.value || props.paused) return;
  const { x, y } = point(event);
  if (x === drag.value.x && y === drag.value.y) return;
  if (!drag.value.recorded) {
    snapshot();
    drag.value.recorded = true;
  }
  target.value.x = Math.max(
    0,
    Math.min(worldWidth.value - (box.value?.w ?? 32), drag.value.originX + x - drag.value.x),
  );
  target.value.y = Math.max(0, Math.min(440, drag.value.originY + y - drag.value.y));
}
function up() {
  if (!drag.value) return;
  if (!drag.value.recorded) {
    drag.value = null;
    return;
  }
  if (selected.value?.kind === 'spawn')
    draft.value.spawn.y = floorY(draft.value.spawn.x, draft.value.spawn.y + 48) - 48;
  if (selected.value?.kind === 'clone' && target.value)
    target.value.y = floorY(target.value.x, target.value.y + 48) - 48;
  drag.value = null;
  save();
}
function remove() {
  if (!selected.value || props.paused) return;
  snapshot();
  if (selected.value.kind === 'floor') draft.value.floors.splice(selected.value.index, 1);
  if (selected.value.kind === 'trap') draft.value.traps.splice(selected.value.index, 1);
  if (selected.value.kind === 'clone') draft.value.cloneSpawns?.splice(selected.value.index, 1);
  selected.value = null;
  save();
}
function play() {
  if (props.paused || problem.value) return;
  save();
  emit('play', JSON.parse(JSON.stringify(draft.value)));
}
function importCode() {
  try {
    const room = decodeRoom(shareCode.value);
    snapshot();
    draft.value = room;
    selected.value = null;
    save();
  } catch (error) {
    status.value = error instanceof Error ? error.message : '导入失败。';
  }
}
async function copyCode() {
  if (!verified.value) return;
  shareCode.value = currentCode.value;
  try {
    await navigator.clipboard.writeText(shareCode.value);
    status.value = '关卡代码已复制';
  } catch {
    status.value = '关卡代码已显示，可在下方选取。';
  }
}
function reset() {
  snapshot();
  draft.value = newDraft();
  selected.value = null;
  save();
}
function toggleOption(option: 'travel' | 'duration' | 'cycle', event: Event) {
  if (!selectedTrap.value) return;
  snapshot();
  if (!(event.target as HTMLInputElement).checked) delete selectedTrap.value[option];
  else if (option === 'travel')
    selectedTrap.value.travel = { x: 100, y: 0, ticks: 60, loop: false };
  else if (option === 'duration') selectedTrap.value.duration = 120;
  else selectedTrap.value.cycle = { active: 90, rest: 70 };
  save();
}
function toggleSecretMotion(event: Event) {
  snapshot();
  if ((event.target as HTMLInputElement).checked)
    draft.value.secretTravel = { x: 60, y: -20, ticks: 60, loop: true };
  else delete draft.value.secretTravel;
  save();
}
</script>

<template>
  <section class="arena-editor" :inert="paused">
    <header>
      <h2>玩家工坊</h2>
      <span role="status">{{ problem || (verified ? '已试玩通关' : '未试玩通关') }}</span>
      <button aria-label="保存草稿" title="保存草稿" @click="save"><Save /></button>
      <button :disabled="Boolean(problem)" @click="play"><Play />试玩</button>
      <button
        aria-label="关闭编辑器"
        title="关闭编辑器"
        @click="
          save();
          emit('close');
        "
      >
        <X />
      </button>
    </header>
    <div class="editor-meta">
      <label
        >关卡名称<input v-model="draft.title" maxlength="40" @focus="snapshot" @change="save"
      /></label>
      <label
        >开场台词<input v-model="draft.promise" maxlength="120" @focus="snapshot" @change="save"
      /></label>
    </div>
    <nav class="editor-tools" aria-label="编辑工具">
      <label
        >关卡宽度<input
          :value="worldWidth"
          type="number"
          min="1000"
          max="5000"
          step="100"
          @focus="snapshot"
          @change="
            draft.width = Number(($event.target as HTMLInputElement).value);
            save();
          "
      /></label>
      <button
        v-for="item in tools"
        :key="item.id"
        :aria-label="item.label"
        :title="item.label"
        :aria-pressed="tool === item.id"
        @click="tool = item.id"
      >
        <component :is="item.icon" />
      </button>
      <select v-model="effect" aria-label="机关类型" @change="tool = 'trap'">
        <option v-for="(name, id) in EFFECT_NAMES" :key="id" :value="id">{{ name }}</option>
      </select>
      <button
        aria-label="撤销编辑"
        title="撤销编辑"
        :disabled="!history.length"
        @click="restore(true)"
      >
        <Undo2 />
      </button>
      <button
        aria-label="重做编辑"
        title="重做编辑"
        :disabled="!future.length"
        @click="restore(false)"
      >
        <Redo2 />
      </button>
      <button
        aria-label="删除选中对象"
        title="删除选中对象"
        :disabled="!selected || !['floor', 'trap', 'clone'].includes(selected.kind)"
        @click="remove"
      >
        <Trash2 />
      </button>
      <button aria-label="新建空白关卡" title="新建空白关卡" @click="reset"><FilePlus2 /></button>
    </nav>
    <div class="editor-layout">
      <div class="editor-world" tabindex="0" aria-label="横向关卡画布">
        <svg
          class="editor-canvas"
          :viewBox="`0 0 ${worldWidth} 440`"
          :style="{ width: `${worldWidth / 10}%` }"
          role="img"
          aria-label="关卡编辑画布"
          @pointerdown.prevent="down"
          @pointermove="move"
          @pointerup="up"
          @pointercancel="up"
          @lostpointercapture="up"
        >
          <defs>
            <pattern id="arena-editor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke="#4c7275" stroke-width=".6" />
            </pattern>
          </defs>
          <image
            v-for="tile in Math.ceil(worldWidth / 1000)"
            :key="tile"
            :x="(tile - 1) * 1000"
            :href="art.serverArchive"
            width="1000"
            height="440"
            preserveAspectRatio="xMidYMid slice"
            opacity=".45"
          />
          <rect :width="worldWidth" height="440" fill="url(#arena-editor-grid)" />
          <rect
            v-for="(floor, i) in draft.floors"
            :key="`floor-${i}`"
            :x="floor.x"
            :y="floor.y"
            :width="floor.w"
            :height="floor.h"
            fill="#244447"
            stroke="#79dcbc"
            stroke-width="3"
          />
          <g v-for="trap in draft.traps" :key="trap.id">
            <rect
              :x="trap.body.x"
              :y="trap.body.y"
              :width="trap.body.w"
              :height="trap.body.h"
              fill="#e77982"
              fill-opacity=".7"
              stroke="#923748"
              stroke-width="2"
            />
            <text :x="trap.body.x + 3" :y="trap.body.y - 6" font-size="13" fill="#532c41">
              {{ EFFECT_NAMES[trap.effect] }}
            </text>
          </g>
          <rect
            :x="draft.exit.x"
            :y="draft.exit.y"
            :width="draft.exit.w"
            :height="draft.exit.h"
            fill="#30574e"
            stroke="#84f2c1"
            stroke-width="4"
          />
          <text :x="draft.exit.x + 12" :y="draft.exit.y + 40" fill="white" font-size="30">→</text>
          <text :x="draft.secret.x" :y="draft.secret.y" fill="#ffcd62" font-size="28">✦</text>
          <g
            v-for="(clone, i) in draft.cloneSpawns ?? []"
            :key="`clone-${i}`"
            :transform="`translate(${clone.x + 16},${clone.y + 48})`"
            style="filter: hue-rotate(45deg)"
            opacity=".8"
          >
            <CharacterSprite :art="art.deepseekIdle" />
          </g>
          <g :transform="`translate(${draft.spawn.x + 16},${draft.spawn.y + 48})`">
            <CharacterSprite :art="art.deepseekIdle" />
          </g>
          <rect
            v-if="selectedTrap"
            :x="selectedTrap.trigger.x"
            :y="selectedTrap.trigger.y"
            :width="selectedTrap.trigger.w"
            :height="selectedTrap.trigger.h"
            fill="none"
            stroke="#885ac7"
            stroke-dasharray="8 5"
            stroke-width="2"
          />
          <rect
            v-if="target"
            :x="target.x - 3"
            :y="target.y - 3"
            :width="(box?.w ?? 32) + 6"
            :height="(box?.h ?? 48) + 6"
            fill="none"
            stroke="#ffcc58"
            stroke-width="3"
            pointer-events="none"
          />
        </svg>
      </div>
      <aside class="editor-inspector">
        <h3>选中对象</h3>
        <template v-if="target">
          <div class="fields">
            <label
              >横坐标<input
                v-model.number="target.x"
                type="number"
                @focus="snapshot"
                @change="save" /></label
            ><label
              >纵坐标<input
                v-model.number="target.y"
                type="number"
                @focus="snapshot"
                @change="save"
            /></label>
            <label v-if="box"
              >宽度<input
                v-model.number="box.w"
                type="number"
                min="4"
                @focus="snapshot"
                @change="save" /></label
            ><label v-if="box"
              >高度<input
                v-model.number="box.h"
                type="number"
                min="4"
                @focus="snapshot"
                @change="save"
            /></label>
          </div>
          <template v-if="selectedTrap">
            <label
              >机关台词<input
                v-model="selectedTrap.line"
                maxlength="120"
                @focus="snapshot"
                @change="save"
            /></label>
            <div class="fields">
              <label
                >触发横坐标<input
                  v-model.number="selectedTrap.trigger.x"
                  type="number"
                  @focus="snapshot"
                  @change="save" /></label
              ><label
                >触发宽度<input
                  v-model.number="selectedTrap.trigger.w"
                  type="number"
                  @focus="snapshot"
                  @change="save"
              /></label>
              <label
                >触发纵坐标<input
                  v-model.number="selectedTrap.trigger.y"
                  type="number"
                  @focus="snapshot"
                  @change="save" /></label
              ><label
                >触发高度<input
                  v-model.number="selectedTrap.trigger.h"
                  type="number"
                  @focus="snapshot"
                  @change="save"
              /></label>
              <label
                >预告帧数<input
                  v-model.number="selectedTrap.delay"
                  type="number"
                  min="0"
                  @focus="snapshot"
                  @change="save"
              /></label>
              <label
                >触发动作<select v-model="selectedTrap.triggerOn" @focus="snapshot" @change="save">
                  <option :value="undefined">进入区域</option>
                  <option value="jump">起跳</option>
                  <option value="land">落地</option>
                  <option value="left">向左</option>
                  <option value="right">向右</option>
                </select></label
              >
            </div>
            <label
              >前置机关<select v-model="selectedTrap.after" @focus="snapshot" @change="save">
                <option :value="undefined">无</option>
                <option
                  v-for="trap in draft.traps.filter((entry) => entry.id !== selectedTrap?.id)"
                  :key="trap.id"
                  :value="trap.id"
                >
                  {{ trap.id }} · {{ EFFECT_NAMES[trap.effect] }}
                </option>
              </select></label
            >
            <div class="fields">
              <label
                ><input
                  type="checkbox"
                  :checked="Boolean(selectedTrap.travel)"
                  @change="toggleOption('travel', $event)"
                />移动</label
              >
              <label
                ><input
                  type="checkbox"
                  :checked="Boolean(selectedTrap.duration)"
                  @change="toggleOption('duration', $event)"
                />限时</label
              >
              <label
                ><input
                  type="checkbox"
                  :checked="Boolean(selectedTrap.cycle)"
                  @change="toggleOption('cycle', $event)"
                />周期</label
              >
              <label
                ><input
                  v-model="selectedTrap.rearm"
                  type="checkbox"
                  @change="save"
                />可再次触发</label
              >
              <label
                ><input
                  v-model="selectedTrap.initiallyActive"
                  type="checkbox"
                  @change="save"
                />触发前生效</label
              >
            </div>
            <label v-if="selectedTrap.duration !== undefined"
              >持续帧数<input
                v-model.number="selectedTrap.duration"
                type="number"
                min="1"
                @focus="snapshot"
                @change="save"
            /></label>
            <details v-if="selectedTrap.travel" open>
              <summary>移动轨迹</summary>
              <div class="fields">
                <label
                  >水平位移<input
                    v-model.number="selectedTrap.travel.x"
                    type="number"
                    @focus="snapshot"
                    @change="save" /></label
                ><label
                  >垂直位移<input
                    v-model.number="selectedTrap.travel.y"
                    type="number"
                    @focus="snapshot"
                    @change="save"
                /></label>
                <label
                  >移动帧数<input
                    v-model.number="selectedTrap.travel.ticks"
                    type="number"
                    min="1"
                    @focus="snapshot"
                    @change="save" /></label
                ><label
                  ><input
                    v-model="selectedTrap.travel.loop"
                    type="checkbox"
                    @change="save"
                  />往返</label
                >
              </div>
            </details>
            <div v-if="selectedTrap.cycle" class="fields">
              <label
                >开启帧数<input
                  v-model.number="selectedTrap.cycle.active"
                  type="number"
                  @focus="snapshot"
                  @change="save" /></label
              ><label
                >关闭帧数<input
                  v-model.number="selectedTrap.cycle.rest"
                  type="number"
                  @focus="snapshot"
                  @change="save"
              /></label>
            </div>
          </template>
          <template v-if="selected?.kind === 'secret'">
            <label
              ><input
                type="checkbox"
                :checked="Boolean(draft.secretTravel)"
                @change="toggleSecretMotion"
              />移动灵感</label
            >
            <div v-if="draft.secretTravel" class="fields">
              <label
                >水平位移<input
                  v-model.number="draft.secretTravel.x"
                  type="number"
                  @focus="snapshot"
                  @change="save"
              /></label>
              <label
                >垂直位移<input
                  v-model.number="draft.secretTravel.y"
                  type="number"
                  @focus="snapshot"
                  @change="save"
              /></label>
              <label
                >移动帧数<input
                  v-model.number="draft.secretTravel.ticks"
                  type="number"
                  min="1"
                  @focus="snapshot"
                  @change="save"
              /></label>
              <label
                ><input
                  v-model="draft.secretTravel.loop"
                  type="checkbox"
                  @change="save"
                />往返</label
              >
            </div>
            <label
              >生长幅度<input
                :value="draft.secretGrowth ?? 0"
                type="number"
                min="0"
                max="30"
                @focus="snapshot"
                @input="draft.secretGrowth = Number(($event.target as HTMLInputElement).value)"
                @change="save"
            /></label>
          </template>
        </template>
      </aside>
    </div>
    <footer>
      <button :disabled="!verified" @click="copyCode"><Copy />复制关卡</button>
      <button @click="importCode"><Upload />导入关卡</button>
      <span role="status">{{ status || (savedCode !== currentCode ? '草稿未保存' : '') }}</span>
      <textarea
        v-model="shareCode"
        aria-label="关卡代码"
        placeholder="关卡代码"
        maxlength="64000"
        rows="3"
      />
    </footer>
  </section>
</template>

<style scoped>
.arena-editor {
  background: #183238;
  color: #edf7ee;
  padding: 14px;
}
header,
.editor-tools,
footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
h2 {
  font-size: 20px;
  margin: 0 auto 0 0;
}
h3 {
  font-size: 14px;
  margin: 0 0 10px;
}
header > span,
footer > span {
  font-size: 12px;
  color: #f4cb8b;
}
button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  min-width: 40px;
  border: 1px solid #64877c;
  background: #294f48;
  color: white;
  border-radius: 5px;
  padding: 8px;
  cursor: pointer;
}
button svg {
  width: 19px;
  height: 19px;
  flex: none;
}
button[aria-pressed='true'] {
  background: #91633a;
  border-color: #ffd386;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
button:focus-visible {
  outline: 3px solid #ffd386;
}
input,
select,
textarea {
  box-sizing: border-box;
  max-width: 100%;
  min-width: 0;
  padding: 7px;
  color: #eff8ef;
  background: #244047;
  border: 1px solid #617e7b;
  border-radius: 4px;
  font: inherit;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
label:has(input[type='checkbox']) {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
input[type='checkbox'] {
  width: 16px;
  height: 16px;
  margin: 0;
  padding: 0;
}
.editor-meta {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 10px;
  margin: 14px 0;
}
.editor-tools {
  margin-bottom: 12px;
}
.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 230px;
  gap: 14px;
}
.editor-canvas {
  width: 100%;
  height: auto;
  background: #c6e2d5;
  touch-action: none;
  align-self: start;
}
.editor-world {
  overflow-x: auto;
  min-width: 0;
}
.editor-tools label {
  width: 100px;
}
.editor-inspector {
  min-width: 0;
  padding-left: 12px;
  border-left: 1px solid #537371;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 8px 0;
}
summary {
  cursor: pointer;
  font-size: 12px;
  margin-top: 12px;
}
footer {
  margin-top: 14px;
}
textarea {
  flex-basis: 100%;
  width: 100%;
  font-size: 12px;
}
@media (max-width: 700px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
  .editor-inspector {
    border-left: 0;
    padding-left: 0;
    border-top: 1px solid #537371;
    padding-top: 12px;
  }
  .editor-meta {
    grid-template-columns: 1fr;
  }
}
</style>
