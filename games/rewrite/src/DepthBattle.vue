<script setup lang="ts">
import { computed } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';
import { teamPlayers, weapons, canCollect, type RunState } from './rules';
import ActorSprite from './ActorSprite.vue';
import ItemArt from './ItemArt.vue';
import FireballSprite from './FireballSprite.vue';
import EnemyArt from './EnemyArt.vue';
import CombatEffect from './CombatEffect.vue';
import BossArt from './BossArt.vue';
import StageProp from './StageProp.vue';
import StageMeme from './StageMeme.vue';
import {
  depthRoomTitle,
  depthTargetOpen,
  depthBossProtected,
  depthGuards,
  DEPTH_FIELD_Z,
  DEPTH_EXIT_Z,
} from './depth';
const props = defineProps<{ state: RunState; width: number; reduceMotion: boolean }>();
const base = computed(() => props.state.base!);
const players = computed(() => teamPlayers(props.state).filter((p) => p.lives > 0));
const targets = computed(() =>
  base.value.targets.filter((t) => t.hp > 0).sort((a, b) => b.z - a.z),
);
const scale = (z: number) =>
  1 /
  (1 +
    Math.max(
      0,
      z -
        (base.value.transition > 0 && !props.reduceMotion
          ? (1 - base.value.transition / 1.5) * 5
          : 0),
    ) /
      13);
const px = (x: number, z: number) => props.width / 2 + (x - 11) * (props.width / 24) * scale(z);
const py = (y: number, z: number) => 160 + (200 - y * 40) * scale(z);
const required = computed(() => targets.value.filter((t) => t.kind === 'core').length);
const guards = computed(() => depthGuards(base.value));
const nodeNames = ['计划', '执行', '反思', '复核'];
const nodeBox = (slot: number) => `${(slot % 2) * 627} ${Math.floor(slot / 2) * 627} 627 627`;
</script>
<template>
  <g
    class="depth-battle"
    :data-room="base.room + 1"
    :data-room-count="base.roomCount"
    :data-cores="required"
    :data-transition="base.transition > 0"
    :data-gate-open="base.gateOpen"
    :data-guards="guards.length"
  >
    <defs>
      <linearGradient id="depth-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#102b46" /><stop offset="1" stop-color="#091a2b" />
      </linearGradient>
      <radialGradient id="depth-door">
        <stop offset="0" stop-color="#276c79" /><stop offset="1" stop-color="#10273e" />
      </radialGradient>
    </defs>
    <rect :width="width" height="420" fill="#081525" />
    <image
      :href="REWRITE_ART.backgrounds[5]"
      :width="width"
      height="420"
      preserveAspectRatio="xMidYMid slice"
      opacity="0.23"
    />
    <g aria-hidden="true" opacity=".28">
      <StageProp
        v-for="slot in 4"
        :key="`depth-prop${slot}`"
        :stage="state.levelIndex"
        :prop-index="slot - 1"
        :x="width * (0.08 + (slot - 1) * 0.28)"
        :y="slot % 2 ? 184 : 236"
        width="74"
        height="74"
      />
    </g>
    <StageMeme
      aria-hidden="true"
      :stage="state.levelIndex"
      :x="width / 2 - 44"
      y="247"
      width="88"
      height="88"
      opacity=".24"
    />
    <polygon
      :points="`0,0 ${px(0, 18)},${py(8, 18)} ${px(0, 18)},${py(0, 18)} 0,420`"
      fill="#112c43"
      opacity="0.9"
    />
    <polygon
      :points="`${width},0 ${px(22, 18)},${py(8, 18)} ${px(22, 18)},${py(0, 18)} ${width},420`"
      fill="#142f47"
      opacity="0.9"
    />
    <polygon
      :points="`0,420 ${px(0, 18)},${py(0, 18)} ${px(22, 18)},${py(0, 18)} ${width},420`"
      fill="url(#depth-floor)"
    />
    <rect
      :x="px(0, 18)"
      :y="py(8, 18)"
      :width="px(22, 18) - px(0, 18)"
      :height="py(0, 18) - py(8, 18)"
      fill="url(#depth-door)"
      stroke="#56bdc6"
      stroke-width="2"
    />
    <g stroke="#437f99" fill="none" opacity="0.5">
      <path
        v-for="z in [0, 3, 6, 9, 12, 15, 18]"
        :key="z"
        :d="`M${px(0, z)},${py(8, z)}V${py(0, z)}H${px(22, z)}V${py(8, z)}`"
      />
      <path
        v-for="x in [0, 3, 6, 9, 12, 15, 18, 21]"
        :key="`floor${x}`"
        :d="`M${px(x, 0)},${py(0, 0)}L${px(x, 18)},${py(0, 18)}`"
      />
    </g>
    <text
      v-if="!state.arena"
      :x="width / 2"
      y="67"
      text-anchor="middle"
      fill="#c0f6ee"
      font-size="15"
      font-weight="800"
    >
      {{ depthRoomTitle(state) }}
    </text>
    <text :x="width / 2" y="87" text-anchor="middle" fill="#8fbece" font-size="10">
      机房 {{ base.room + 1 }} / {{ base.roomCount }} ·
      {{
        state.arena
          ? guards.length
            ? `主核心受保护 · 剩余 ${guards.length} 个外围节点`
            : '主核心已解除保护'
          : base.gateOpen
            ? '屏障断电 · W / 上方向键推进，K / 跳跃键起跳'
            : `屏障通电 · 剩余 ${required} 个安全核心`
      }}
    </text>
    <g v-if="state.arena" fill="none" stroke="#ad9ace" stroke-width="2" opacity=".55">
      <path
        v-for="t in guards"
        :key="`link${t.id}`"
        :d="`M${px(11, 18)} ${py(1.7, 18)}L${px(t.x, t.z)} ${py(t.y, t.z)}`"
        stroke-dasharray="4 4"
      />
    </g>
    <g v-for="t in targets" :key="t.id">
      <path
        v-if="t.aim"
        :d="`M${px(t.x, t.z)} ${py(t.y, t.z)}L${px(t.aim.x, t.aim.z)} ${py(t.aim.y, t.aim.z)}`"
        stroke="#ffac7e"
        stroke-dasharray="7 5"
        opacity="0.6"
      />
      <g
        :transform="`translate(${px(t.x, t.z)},${py(t.y, t.z)})`"
        :opacity="t.flash > 0 ? 0.55 : 1"
        :data-depth-target="t.kind"
        :data-target-x="t.x"
        :data-target-y="t.y"
        :data-target-hp="t.hp"
        :data-open="depthTargetOpen(base, t)"
        :data-slot="t.slot"
        :data-enemy="t.kind"
      >
        <template v-if="t.kind === 'boss'">
          <BossArt
            x="-67"
            y="-86"
            width="134"
            height="134"
            :stage="state.levelIndex"
            :state="t.flash > 0 ? 'hit' : t.hp < t.maxHp * 0.66 ? 'phase' : 'idle'"
            :opacity="depthBossProtected(base) ? 0.4 : 1"
          />
          <text
            y="-93"
            text-anchor="middle"
            :fill="depthTargetOpen(base, t) ? '#9df7cb' : '#ffc488'"
            font-size="11"
          >
            {{
              depthBossProtected(base)
                ? '链路保护 · 先拆外围'
                : depthTargetOpen(base, t)
                  ? '核心暴露'
                  : '思考装甲'
            }}
          </text>
        </template>
        <template v-else-if="t.kind === 'relay' || t.kind === 'head'">
          <circle
            r="22"
            :fill="depthTargetOpen(base, t) ? '#4ef0cb' : '#df945a'"
            fill-opacity=".12"
            :stroke="depthTargetOpen(base, t) ? '#90ffe0' : '#e4ab73'"
            :stroke-dasharray="depthTargetOpen(base, t) ? undefined : '4 3'"
          />
          <svg
            x="-25"
            y="-25"
            width="50"
            height="50"
            :viewBox="nodeBox(t.slot ?? 0)"
            overflow="hidden"
          >
            <image
              :href="REWRITE_ART.depthNodes.url"
              :width="REWRITE_ART.depthNodes.width"
              :height="REWRITE_ART.depthNodes.height"
            />
          </svg>
          <text
            v-if="t.kind === 'relay'"
            y="-29"
            text-anchor="middle"
            :fill="depthTargetOpen(base, t) ? '#a6ffdb' : '#ffd3a0'"
            font-size="10"
          >
            {{ nodeNames[t.slot ?? 0] }}
          </text>
        </template>
        <template v-else-if="t.kind === 'core'">
          <rect
            x="-20"
            y="-19"
            width="40"
            height="38"
            rx="5"
            fill="#102536"
            :stroke="depthTargetOpen(base, t) ? '#85ffe4' : '#f4b371'"
            stroke-width="2"
          />
          <path
            v-if="!depthTargetOpen(base, t)"
            d="M-14 -10H14M-14 -3H14M-14 4H14M-14 11H14"
            stroke="#efb87b"
            stroke-width="3"
          />
          <circle v-else r="10" fill="#8bffe1" opacity="0.9" />
          <text y="-29" text-anchor="middle" fill="#affbed" font-size="10">
            {{ t.y > 2 ? '高位核心' : '核心' }}
          </text>
        </template>
        <template v-else-if="t.kind === 'cache'">
          <ItemArt kind="cache" x="-25" y="-23" width="50" height="45" />
          <text y="-29" text-anchor="middle" fill="#b9f8df" font-size="10">补给节点</text>
        </template>
        <template v-else>
          <EnemyArt
            :kind="t.kind"
            :state="t.flash > 0 ? 'hit' : t.cooldown < 0.45 ? 'attack' : 'idle'"
            x="-25"
            y="-23"
            width="50"
            height="45"
          />
          <ellipse v-if="t.kind === 'drone'" cy="-22" rx="23" ry="5" fill="none" stroke="#eeadff" />
        </template>
        <rect
          v-if="t.kind !== 'boss'"
          x="-19"
          :y="t.kind === 'head' ? 26 + ((t.slot ?? 0) % 2) * 5 : 23"
          width="38"
          height="3"
          fill="#15202c"
        />
        <rect
          v-if="t.kind !== 'boss'"
          x="-19"
          :y="t.kind === 'head' ? 26 + ((t.slot ?? 0) % 2) * 5 : 23"
          :width="38 * Math.max(0, t.hp / t.maxHp)"
          height="3"
          fill="#ff987c"
        />
      </g>
    </g>
    <g v-if="!state.arena" data-testid="depth-energy-field" :data-powered="!base.gateOpen">
      <rect
        :x="px(0, DEPTH_FIELD_Z)"
        :y="py(4.8, DEPTH_FIELD_Z)"
        :width="px(22, DEPTH_FIELD_Z) - px(0, DEPTH_FIELD_Z)"
        :height="py(0, DEPTH_FIELD_Z) - py(4.8, DEPTH_FIELD_Z)"
        :fill="base.gateOpen ? '#5cf1c8' : '#ed8bff'"
        :fill-opacity="base.gateOpen ? 0.015 : !reduceMotion && base.fieldPulse > 0 ? 0.16 : 0.06"
        :stroke="base.gateOpen ? '#61d1bb' : '#e1a1ff'"
        :stroke-dasharray="base.gateOpen ? '3 10' : undefined"
      />
      <g v-if="!base.gateOpen">
        <path
          v-for="n in 7"
          :key="n"
          :d="`M${px(0, DEPTH_FIELD_Z)} ${py(n * 0.6, DEPTH_FIELD_Z)}h${px(22, DEPTH_FIELD_Z) - px(0, DEPTH_FIELD_Z)}`"
          stroke="#e5afff"
          stroke-width="2"
          :opacity="reduceMotion ? 0.6 : 0.45 + Math.sin(base.age * 6 + n) * 0.12"
        />
      </g>
      <text
        :x="width / 2"
        :y="py(4.8, DEPTH_FIELD_Z) - 9"
        text-anchor="middle"
        :fill="base.gateOpen ? '#a5ffe4' : '#edbcff'"
        font-size="12"
      >
        {{ base.gateOpen ? '通路开放 ↑' : '能源屏障 · 先拆核心' }}
      </text>
    </g>
    <g
      v-for="b in base.shots"
      :key="b.id"
      :data-shot="b.weapon"
      :data-shot-id="b.id"
      :data-shot-x="b.x.toFixed(3)"
      :data-shot-y="b.y.toFixed(3)"
      :data-shot-z="b.z.toFixed(3)"
    >
      <FireballSprite
        v-if="b.weapon === 'flame'"
        :transform="`translate(${px(b.x, b.z)},${py(b.y, b.z)}) scale(${scale(b.z)})`"
        :age="b.age ?? 0"
        :reduce-motion="reduceMotion"
        :angle="-90"
      />
      <line
        v-else
        :x1="px(b.x, b.z)"
        :y1="py(b.y, b.z)"
        :x2="px(b.x, Math.max(0, b.z - 2))"
        :y2="py(b.y, Math.max(0, b.z - 2))"
        :stroke="weapons[b.weapon].color"
        :stroke-width="b.weapon === 'laser' ? 3 : 2"
        stroke-linecap="round"
      />
    </g>
    <g v-for="(b, i) in base.hostile" :key="`enemy${i}`">
      <circle
        :cx="px(b.x, b.z)"
        :cy="py(b.y, b.z)"
        :r="3 + 5 * scale(b.z)"
        fill="#ff846e"
        stroke="#ffdd9a"
        stroke-width="1.5"
      />
      <circle
        v-if="b.z < 6"
        :cx="px(b.x, 0)"
        :cy="py(0, 0)"
        :r="8 + (6 - b.z) * 2"
        fill="none"
        stroke="#ef865f"
        opacity="0.5"
      />
    </g>
    <g
      v-for="(g, i) in base.grenades"
      :key="`grenade${i}`"
      :transform="`translate(${px(g.x, g.z)},${py(g.y, g.z)})`"
    >
      <circle :r="8 * scale(g.z) + 2" fill="#aaf9cd" stroke="white" /><text
        text-anchor="middle"
        y="3"
        font-size="8"
        fill="#193344"
      >
        G
      </text>
    </g>
    <g
      v-for="(drop, i) in state.supplies.filter((d) => !d.taken)"
      :key="`drop${i}`"
      :transform="`translate(${px(drop.x, 0)},${py(drop.y, 0)})`"
      :data-supply="drop.kind"
      :opacity="players.some((p) => canCollect(p, drop.kind, state.difficulty)) ? 1 : 0.45"
    >
      <circle r="16" fill="#143d4c" stroke="#8cefcc" stroke-dasharray="4 3" />
      <ItemArt :kind="drop.kind" x="-22" y="-22" width="44" height="44" />
    </g>
    <g
      v-for="p in players"
      :key="p.playerId"
      :data-testid="p.playerId === 1 ? 'rewrite-player' : 'rewrite-partner'"
      :data-x="p.x.toFixed(2)"
      :data-overclock="p.overclock.toFixed(2)"
      :data-barrier="p.barrier.toFixed(2)"
      :data-y="p.y.toFixed(2)"
      :data-depth-z="p.depthZ.toFixed(2)"
      :data-lives="p.lives"
      :data-weapon="p.weapon"
      :data-aim-y="p.aimY"
      :data-crouching="p.crouching"
      :transform="`translate(${px(p.x, p.depthZ)},${py(p.y, p.depthZ)}) scale(${scale(p.depthZ)})`"
      :opacity="p.invulnerable > 0 ? 0.72 : 1"
    >
      <ellipse :cy="p.y * 40" rx="23" ry="5" fill="#000" opacity="0.4" />
      <ActorSprite :player="p" :time="state.elapsed" :reduce-motion="reduceMotion" depth />
      <ellipse
        v-if="p.shield > 0 || p.barrier > 0"
        :cy="p.crouching ? -14 : -32"
        rx="29"
        :ry="p.crouching ? 22 : 40"
        fill="none"
        :stroke="p.barrier > 0 ? '#dca9ff' : '#92e4fa'"
        stroke-width="2"
      />
      <text
        v-if="state.partner"
        y="-82"
        text-anchor="middle"
        :fill="p.playerId === 1 ? '#9cffe0' : '#ffcd90'"
        font-size="12"
        font-weight="800"
      >
        P{{ p.playerId }}
      </text>
      <path d="M-8 -87L0 -94L8 -87" fill="none" stroke="#c5ffec" opacity="0.8" />
    </g>
    <text
      v-if="base.gateOpen && !state.arena && !base.transition"
      :x="width / 2"
      y="391"
      text-anchor="middle"
      fill="#b6f8e5"
      font-size="11"
    >
      {{
        players
          .map(
            (p) =>
              `P${p.playerId} ${p.depthZ >= DEPTH_EXIT_Z ? '已到出口' : `推进 ${Math.floor((p.depthZ / DEPTH_EXIT_Z) * 100)}%`}`,
          )
          .join(' · ')
      }}
    </text>
    <text
      v-if="state.arena && guards.length"
      :x="width / 2"
      y="391"
      text-anchor="middle"
      fill="#b6f8e5"
      font-size="11"
    >
      绿色可攻击 · 橙色保护 · 先拆外围
    </text>
    <g
      v-for="(e, i) in base.effects"
      :key="`fx${i}`"
      :transform="`translate(${px(e.x, e.z)},${py(e.y, e.z)})`"
    >
      <CombatEffect
        :kind="e.defeat ? 'defeat' : e.boom ? 'boom' : e.kind === 'muzzle' ? 'muzzle' : 'hit'"
        :weapon="e.weapon"
        :enemy="e.defeat ? 'boss' : undefined"
        :stage="state.levelIndex"
        :life="e.life"
        :reduce-motion="reduceMotion"
      />
    </g>
    <g v-if="base.transition > 0">
      <rect :width="width" height="420" fill="#72e1cf" :opacity="reduceMotion ? 0.05 : 0.1" />
      <rect
        :x="width / 2 - 130"
        y="170"
        width="260"
        height="70"
        rx="8"
        fill="#0b2437"
        stroke="#95ffe2"
      />
      <text
        :x="width / 2"
        y="198"
        text-anchor="middle"
        fill="#b7ffe7"
        font-size="18"
        font-weight="800"
      >
        防线已解除
      </text>
      <text :x="width / 2" y="221" text-anchor="middle" fill="#b1d5e5" font-size="12">
        正在向下一机房推进 →
      </text>
    </g>
  </g>
</template>
