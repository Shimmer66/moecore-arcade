<script setup lang="ts">
import type { Lesson, LessonId, LessonProgress } from './lessons';
defineProps<{
  lessons: Lesson[];
  selected: LessonId | null;
  progress: LessonProgress | null;
  completed: LessonId[];
  disabled: boolean;
}>();
const emit = defineEmits<{ select: [id: LessonId | null]; retry: [] }>();
</script>
<template>
  <section
    class="practice-lessons"
    aria-label="逐步练招课程"
    :data-lesson="selected ?? 'free'"
    :data-status="progress?.status ?? 'free'"
    :data-step="progress?.step ?? 0"
  >
    <header>
      <div>
        <strong>练得会，再去嘴硬。</strong
        ><small>已通过 {{ completed.length }} / {{ lessons.length }} 课</small>
      </div>
      <label
        >练什么
        <select
          :value="selected ?? ''"
          :disabled="disabled"
          aria-label="选择练招课程"
          @change="
            emit('select', (($event.target as HTMLSelectElement).value || null) as LessonId | null)
          "
        >
          <option value="">自由练招</option>
          <option v-for="lesson in lessons" :key="lesson.id" :value="lesson.id">
            {{ completed.includes(lesson.id) ? '✓ ' : '' }}{{ lesson.title }}
          </option>
        </select>
      </label>
    </header>
    <template v-if="progress">
      <p>{{ progress.definition.intro }}</p>
      <ol>
        <li
          v-for="(step, index) in progress.definition.steps"
          :key="step.check"
          :class="{
            passed: index < progress.step,
            current: index === progress.step && progress.status !== 'failed',
          }"
        >
          <kbd>{{ step.key }}</kbd
          ><span>{{ step.label }}</span
          ><b v-if="index < progress.step">✓</b>
        </li>
      </ol>
      <div class="lesson-feedback" :class="progress.status" role="status" aria-live="polite">
        <b>{{
          progress.status === 'complete'
            ? '通过！'
            : progress.status === 'failed'
              ? '再来一次'
              : '下一步'
        }}</b>
        <span>{{ progress.hint }}</span>
      </div>
      <div class="lesson-buttons">
        <button type="button" :disabled="disabled" @click="emit('retry')">重试课程</button>
        <button type="button" :disabled="disabled" @click="emit('select', null)">自由练招</button>
      </div>
    </template>
    <p v-else>
      选一课会自动摆好站位和能量。按提示打出真实动作；空挥、被挡和断连会告诉你哪里没接上。
    </p>
  </section>
</template>
<style scoped>
.practice-lessons {
  padding: 16px 20px;
  background: #14263e;
  border-top: 1px solid #425d7f;
  color: #e2edff;
  font-size: 13px;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
header strong {
  display: block;
  font-size: 18px;
  color: #ffe1a1;
}
small {
  color: #a8c3e5;
}
label {
  display: flex;
  gap: 8px;
  align-items: center;
}
select,
button {
  padding: 9px 12px;
  border: 1px solid #5b789d;
  border-radius: 6px;
  background: #27405e;
  color: #eef4ff;
  font: inherit;
  cursor: pointer;
}
p {
  color: #bad0ed;
  line-height: 1.7;
  margin: 12px 0;
}
ol {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 9px 10px;
  background: #1d314c;
  border: 1px solid #47617d;
  border-radius: 6px;
  color: #a8bedb;
}
li.current {
  border-color: #ffe0a1;
  color: #fff0c3;
  background: #51452d;
}
li.passed {
  color: #b7edb0;
  border-color: #6b9666;
}
kbd {
  font: 700 14px system-ui;
  min-width: 24px;
  color: inherit;
}
.lesson-feedback {
  display: flex;
  gap: 9px;
  padding: 12px 0;
  line-height: 1.6;
}
.lesson-feedback b {
  white-space: nowrap;
  color: #ffe1a1;
}
.lesson-feedback.failed b {
  color: #ffb2a3;
}
.lesson-feedback.complete b {
  color: #b5ef9b;
}
.lesson-buttons {
  display: flex;
  gap: 8px;
}
button:disabled,
select:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 600px) {
  .practice-lessons {
    padding: 14px 12px;
  }
  header {
    align-items: stretch;
  }
  label,
  select {
    min-width: 0;
    max-width: 100%;
  }
  ol {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  li {
    font-size: 12px;
    padding: 8px 6px;
  }
  .lesson-feedback {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
