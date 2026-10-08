<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { ArrowUp, CircleDot, Hand, Shield, Sparkles, Swords, Unplug, Zap } from '@lucide/vue';
import type { Action } from './rules';
import {
  JOYSTICK_CROUCH_RELEASE,
  JOYSTICK_CROUCH_THRESHOLD,
  JOYSTICK_JUMP_RELEASE,
  JOYSTICK_JUMP_THRESHOLD,
  resolveJoystick,
} from './touch-controls';

const props = defineProps<{
  visible: boolean;
  active: boolean;
  paused: boolean;
  standMode: 'attached' | 'detached' | 'vanished';
  canDetach: boolean;
  canUltimate: boolean;
  canFinger: boolean;
  canTimeStop: boolean;
  lightLabel: string;
  ultimateLabel: string;
}>();

const emit = defineEmits<{
  movement: [value: number];
  crouch: [active: boolean];
  guard: [active: boolean];
  jump: [];
  action: [action: Action];
  detach: [];
  timeStop: [];
}>();

const joystick = ref<HTMLElement>();
const stickX = ref(0);
const stickY = ref(0);
const stickTravel = ref(34);
const guardHeld = ref(false);
let joystickPointer: number | null = null;
let guardPointer: number | null = null;
let jumpLatched = false;
let crouchLatched = false;

const enabled = computed(() => props.active && !props.paused);

function capturePointer(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic events and older embedded browsers may not expose an active pointer.
  }
}

function updateStick(event: PointerEvent) {
  if (!joystick.value || event.pointerId !== joystickPointer) return;
  const bounds = joystick.value.getBoundingClientRect();
  const vector = resolveJoystick(event.clientX, event.clientY, bounds);
  stickTravel.value = Math.max(18, bounds.width * 0.29);
  stickX.value = vector.x;
  stickY.value = vector.y;
  emit('movement', vector.movement);
  if (props.standMode !== 'attached') {
    crouchLatched = false;
  } else if (vector.y >= JOYSTICK_CROUCH_THRESHOLD) {
    crouchLatched = true;
  } else if (vector.y <= JOYSTICK_CROUCH_RELEASE) {
    crouchLatched = false;
  }
  emit('crouch', props.standMode === 'attached' && crouchLatched);
  if (props.standMode === 'attached' && vector.y <= JOYSTICK_JUMP_THRESHOLD && !jumpLatched) {
    jumpLatched = true;
    pulse(8);
    emit('jump');
  } else if (vector.y >= JOYSTICK_JUMP_RELEASE) {
    jumpLatched = false;
  }
}

function pulse(duration = 6) {
  try {
    navigator.vibrate?.(duration);
  } catch {
    // Haptics are optional and unavailable on some embedded browsers.
  }
}

function startStick(event: PointerEvent) {
  if (!enabled.value || joystickPointer !== null) return;
  joystickPointer = event.pointerId;
  capturePointer(event.currentTarget as HTMLElement, event.pointerId);
  updateStick(event);
}

function releaseStick(event?: PointerEvent) {
  if (event && event.pointerId !== joystickPointer) return;
  joystickPointer = null;
  jumpLatched = false;
  crouchLatched = false;
  stickX.value = 0;
  stickY.value = 0;
  emit('movement', 0);
  emit('crouch', false);
}

function startGuard(event: PointerEvent) {
  if (!enabled.value || guardPointer !== null) return;
  guardPointer = event.pointerId;
  guardHeld.value = true;
  pulse(7);
  capturePointer(event.currentTarget as HTMLElement, event.pointerId);
  emit('guard', true);
}

function releaseGuard(event?: PointerEvent) {
  if (event && event.pointerId !== guardPointer) return;
  guardPointer = null;
  guardHeld.value = false;
  emit('guard', false);
}

function trigger(action: Action) {
  if (!enabled.value) return;
  pulse(action === 'heavy' || action === 'special' ? 10 : 6);
  emit('action', action);
}

function reset() {
  releaseStick();
  releaseGuard();
}

watch(
  () => [props.active, props.paused],
  ([active, paused]) => {
    if (!active || paused) reset();
  },
);

onUnmounted(reset);
</script>

<template>
  <section
    class="mobile-touch-controls"
    :class="{
      visible,
      disabled: !enabled,
      'stand-control': standMode === 'detached',
    }"
    data-testid="stardust-mobile-controls"
    aria-label="玩家一触控操作"
  >
    <div class="touch-left">
      <div
        ref="joystick"
        class="touch-joystick"
        data-testid="stardust-touch-joystick"
        aria-label="移动摇杆"
        @pointerdown.prevent="startStick"
        @pointermove.prevent="updateStick"
        @pointerup.prevent="releaseStick"
        @pointercancel.prevent="releaseStick"
        @lostpointercapture="releaseStick"
      >
        <span
          :style="{
            transform: `translate(calc(-50% + ${stickX * stickTravel}px), calc(-50% + ${stickY * stickTravel}px))`,
          }"
        ></span>
        <small>{{ standMode === 'detached' ? '替身' : '移动' }}</small>
      </div>
      <div class="touch-utilities">
        <button
          type="button"
          data-testid="stardust-touch-detach"
          :disabled="!enabled || !canDetach"
          :aria-label="standMode === 'detached' ? '召回替身' : '替身离体'"
          :title="standMode === 'detached' ? '召回替身' : '替身离体'"
          @pointerdown.prevent="emit('detach')"
        >
          <Unplug :size="19" />
        </button>
        <button
          v-if="canFinger"
          type="button"
          data-testid="stardust-touch-finger"
          :disabled="!enabled || standMode === 'vanished'"
          aria-label="流星指刺"
          title="流星指刺"
          @pointerdown.prevent="trigger('finger')"
        >
          <Hand :size="19" />
        </button>
        <button
          v-if="canTimeStop"
          type="button"
          data-testid="stardust-touch-time-stop"
          :disabled="!enabled"
          aria-label="时停"
          title="时停"
          @pointerdown.prevent="emit('timeStop')"
        >
          <CircleDot :size="19" />
        </button>
      </div>
    </div>

    <div class="touch-actions">
      <button
        class="touch-action jump"
        type="button"
        data-testid="stardust-touch-jump"
        :disabled="!enabled || standMode === 'detached'"
        aria-label="跳跃"
        @pointerdown.prevent="emit('jump')"
      >
        <ArrowUp :size="22" /><span>跳</span>
      </button>
      <button
        class="touch-action light"
        type="button"
        data-testid="stardust-touch-light"
        :disabled="!enabled"
        :aria-label="lightLabel"
        @pointerdown.prevent="trigger('light')"
      >
        <Zap :size="21" /><span>{{ lightLabel }}</span>
      </button>
      <button
        class="touch-action heavy"
        type="button"
        data-testid="stardust-touch-heavy"
        :disabled="!enabled"
        aria-label="重击"
        @pointerdown.prevent="trigger('heavy')"
      >
        <Swords :size="22" /><span>重击</span>
      </button>
      <button
        class="touch-action barrage"
        type="button"
        data-testid="stardust-touch-barrage"
        :disabled="!enabled || standMode === 'vanished'"
        aria-label="替身连打"
        @pointerdown.prevent="trigger('stand')"
      >
        <Sparkles :size="22" /><span>连打</span>
      </button>
      <button
        class="touch-action ultimate"
        type="button"
        data-testid="stardust-touch-ultimate"
        :disabled="!enabled || !canUltimate"
        :aria-label="ultimateLabel"
        @pointerdown.prevent="trigger('special')"
      >
        <CircleDot :size="22" /><span>必杀</span>
      </button>
      <button
        class="touch-action guard"
        :class="{ held: guardHeld }"
        type="button"
        data-testid="stardust-touch-guard"
        :disabled="!enabled"
        aria-label="按住防御"
        @pointerdown.prevent="startGuard"
        @pointerup.prevent="releaseGuard"
        @pointercancel.prevent="releaseGuard"
        @lostpointercapture="releaseGuard"
      >
        <Shield :size="22" /><span>防御</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.mobile-touch-controls {
  display: none;
  grid-template-columns: minmax(132px, 0.78fr) minmax(180px, 1.22fr);
  gap: 12px;
  min-height: 156px;
  padding: 10px max(12px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom))
    max(12px, env(safe-area-inset-left));
  border-top: 1px solid rgb(255 255 255 / 14%);
  background: #171521;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.touch-left {
  display: flex;
  flex-direction: column;
  place-items: center;
  justify-content: center;
  gap: 7px;
}

.touch-joystick {
  position: relative;
  width: 116px;
  max-width: 100%;
  aspect-ratio: 1;
  border: 2px solid rgb(133 222 255 / 48%);
  border-radius: 50%;
  background:
    linear-gradient(90deg, transparent 49%, rgb(255 255 255 / 9%) 50% 51%, transparent 52%),
    linear-gradient(transparent 49%, rgb(255 255 255 / 9%) 50% 51%, transparent 52%),
    rgb(28 31 45 / 82%);
  box-shadow: inset 0 0 20px rgb(74 212 255 / 12%);
}

.touch-joystick > span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 46%;
  aspect-ratio: 1;
  border: 2px solid #dff8ff;
  border-radius: 50%;
  background: #286a8d;
  box-shadow: 0 3px 10px rgb(0 0 0 / 48%);
  pointer-events: none;
}

.touch-joystick small {
  position: absolute;
  left: 50%;
  bottom: 5px;
  translate: -50% 0;
  color: rgb(255 255 255 / 68%);
  font-size: 10px;
  font-weight: 800;
}

.touch-utilities {
  display: grid;
  grid-auto-flow: column;
  gap: 7px;
}

.touch-utilities button,
.touch-action {
  display: grid;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 23%);
  color: #fff;
  background: #302d3f;
  box-shadow: 0 3px 0 #15131e;
  touch-action: none;
}

.touch-utilities button {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
}

.touch-actions {
  display: grid;
  min-width: 0;
  width: 100%;
  grid-template-columns: repeat(3, minmax(52px, 1fr));
  grid-template-rows: repeat(2, 62px);
  align-content: center;
  gap: 8px;
}

.touch-action {
  min-width: 0;
  padding: 4px;
  border-radius: 50%;
}

.touch-utilities button:active,
.touch-action:active {
  translate: 0 2px;
  filter: brightness(1.2);
  box-shadow: 0 1px 0 #15131e;
}

.touch-action span {
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  font-weight: 900;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.touch-action.light {
  color: #baffdf;
  border-color: #52da9b;
}

.touch-action.heavy {
  color: #ffe5a3;
  border-color: #e7ad48;
}

.touch-action.barrage {
  color: #c9baff;
  border-color: #8978e5;
}

.touch-action.ultimate {
  color: #fff2a0;
  border-color: #f2ce4f;
  background: #4b3b20;
}

.touch-action.guard {
  color: #bcecff;
  border-color: #6dcbe9;
}

.touch-action.guard.held {
  color: #fff;
  background: #247491;
  box-shadow: inset 0 0 14px rgb(190 245 255 / 45%);
  translate: 0 2px;
}

button:disabled,
.disabled button {
  opacity: 0.38;
}

.mobile-touch-controls.visible {
  display: grid;
}

@media (pointer: coarse) and (orientation: landscape) and (max-height: 540px) {
  .mobile-touch-controls {
    grid-template-columns: minmax(150px, 0.7fr) minmax(270px, 1.3fr);
    min-height: 128px;
    padding-top: 6px;
  }

  .touch-left {
    display: grid;
    grid-template-columns: 108px auto;
    justify-content: start;
  }

  .touch-joystick {
    width: 104px;
  }

  .touch-actions {
    grid-template-columns: repeat(6, minmax(48px, 1fr));
    grid-template-rows: 62px;
  }
}

@media (max-width: 360px) {
  .mobile-touch-controls {
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 6px;
    min-height: 140px;
    padding-right: max(8px, env(safe-area-inset-right));
    padding-left: max(8px, env(safe-area-inset-left));
  }

  .touch-left {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .touch-joystick {
    width: 78px;
  }

  .touch-joystick > span {
    width: 42%;
  }

  .touch-utilities {
    grid-auto-flow: column;
    gap: 5px;
  }

  .touch-utilities button {
    width: 34px;
    height: 34px;
  }

  .touch-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(3, 50px);
    gap: 5px;
  }

  .touch-action span {
    font-size: 9px;
  }
}
</style>
