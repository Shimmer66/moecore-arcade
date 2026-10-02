<script setup lang="ts">
import { DUEL_ART } from '@moecore/assets/duel';
import { IDS, ROSTER } from './moves';
import { cloneLineups } from './teams';
import { isNewcomer } from './types';
import type { FighterId, Slot, TeamLineups } from './types';
import FighterSprite from './RasterFighter.vue';
const props = defineProps<{ modelValue: TeamLineups; local: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [lineups: TeamLineups];
  'update:local': [value: boolean];
}>();
function select(slot: Slot, index: number, event: Event) {
  const id = (event.target as HTMLSelectElement).value as FighterId;
  const next = cloneLineups(props.modelValue),
    row = next[slot];
  const existing = row.indexOf(id),
    old = row[index]!;
  row[index] = id;
  if (existing >= 0 && existing !== index) row[existing] = old;
  emit('update:modelValue', next);
}
function shift(slot: Slot, index: number, direction: -1 | 1) {
  const next = cloneLineups(props.modelValue),
    row = next[slot],
    target = index + direction;
  if (target < 0 || target >= 3) return;
  [row[index], row[target]] = [row[target]!, row[index]!];
  emit('update:modelValue', next);
}
</script>
<template>
  <section class="team-select" aria-label="三人队伍编成">
    <header>
      <div>
        <h3>三个人，一张饭卡。</h3>
        <p>先锋先试水，中坚接着揍，大将负责兜底。</p>
      </div>
      <div class="team-controller" role="group" aria-label="队伍对战方式">
        <button type="button" :aria-pressed="!local" @click="emit('update:local', false)">
          挑战电脑队
        </button>
        <button type="button" :aria-pressed="local" @click="emit('update:local', true)">
          双人队伍战
        </button>
      </div>
    </header>
    <div class="team-columns">
      <section v-for="slot in [0, 1] as const" :key="slot" :aria-label="`P${slot + 1}队伍`">
        <h4>{{ slot === 0 ? 'P1 · 干饭队' : local ? 'P2 · 抢饭队' : 'CPU · 抢饭队' }}</h4>
        <div
          v-for="(id, index) in modelValue[slot]"
          :key="index"
          class="team-member"
          :data-testid="`team-select-${slot}-${index}`"
        >
          <img v-if="!isNewcomer(id)" :src="DUEL_ART[id].base" alt="" />
          <svg v-else viewBox="-115 -175 230 185" aria-hidden="true">
            <FighterSprite :id="id" />
          </svg>
          <div class="team-member-main">
            <label :for="`team-${slot}-${index}`"
              >{{ ['先锋', '中坚', '大将'][index] }} · {{ 3 + index }}格上限</label
            >
            <select
              :id="`team-${slot}-${index}`"
              :value="id"
              :aria-label="`P${slot + 1}第${index + 1}位角色`"
              @change="select(slot, index, $event)"
            >
              <option v-for="candidate in IDS" :key="candidate" :value="candidate">
                {{ ROSTER[candidate].name }}
              </option>
            </select>
            <small>{{ ROSTER[id].role }}</small>
          </div>
          <div class="team-order">
            <button
              type="button"
              :disabled="index === 0"
              :aria-label="`P${slot + 1}第${index + 1}位前移`"
              @click="shift(slot, index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :disabled="index === 2"
              :aria-label="`P${slot + 1}第${index + 1}位后移`"
              @click="shift(slot, index, 1)"
            >
              ↓
            </button>
          </div>
        </div>
      </section>
    </div>
    <p class="team-rules">
      每队三人不重复，选到同队角色会交换位置。败者退场，胜者保留血量并回60–180血，能量继承；双倒或时间平局双方一起退场。打光对面三人才算赢。
    </p>
  </section>
</template>
<style scoped>
.team-select {
  padding: 20px;
  border: 1px solid #405473;
  border-radius: 12px;
  background: #132138;
  color: #e6efff;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
}
h3,
h4,
p {
  margin: 0;
}
h3 {
  font-size: 24px;
  color: #ffe0a1;
}
header p,
.team-rules {
  margin-top: 10px;
  color: #b5c9e5;
  font-size: 13px;
  line-height: 1.7;
}
.team-controller {
  display: flex;
  gap: 6px;
}
button,
select {
  font: inherit;
  color: inherit;
  border: 1px solid #637b9d;
  border-radius: 6px;
  background: #243c5c;
  padding: 9px;
  cursor: pointer;
}
button[aria-pressed='true'] {
  background: #ffe0a1;
  color: #162a42;
  border-color: #ffe0a1;
}
button:disabled {
  opacity: 0.3;
  cursor: default;
}
.team-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 20px;
}
h4 {
  margin-bottom: 10px;
  color: #9bd7ff;
}
.team-member {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 8px;
  border-top: 1px solid #3c4e66;
}
.team-member img,
.team-member svg {
  width: 65px;
  height: 82px;
  flex-shrink: 0;
  object-fit: contain;
}
.team-member-main {
  display: grid;
  gap: 5px;
  flex: 1;
  min-width: 0;
}
label,
small {
  font-size: 12px;
  color: #b7cce9;
}
select {
  width: 100%;
  min-width: 0;
}
.team-order {
  display: grid;
  gap: 5px;
}
.team-order button {
  min-width: 34px;
}
@media (max-width: 700px) {
  .team-columns {
    grid-template-columns: 1fr;
  }
  .team-select {
    padding: 14px;
  }
  .team-member img,
  .team-member svg {
    width: 50px;
  }
}
</style>
