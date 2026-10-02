<script setup lang="ts">
import { computed, ref } from 'vue';
import AdvancedMotionSprite from './AdvancedMotionSprite.vue';
import { advancedFrame } from './advanced-frame';
import { normalFrame } from './normal-frame';
import { grappleFrame } from './grapple-frame';
import { signatureFrame } from './signature-frame';
import LegacyRasterFighter from './LegacyRasterFighter.vue';
import NewcomerSprite from './NewcomerSprite.vue';
import { isNewcomer } from './types';
import type { Action, FighterId, SuperTier } from './types';
const props = withDefaults(
  defineProps<{
    id: FighterId;
    action?: Action;
    frame?: number;
    age?: number;
    facing?: number;
    reduced?: boolean;
    crouched?: boolean;
    grounded?: boolean;
    stun?: number;
    vy?: number;
    landing?: boolean;
    enhanced?: boolean;
    superTier?: SuperTier;
    rollDirection?: number;
    parcelReturnDistance?: number | null;
    commandGrabAge?: number | null;
  }>(),
  {
    action: 'idle',
    frame: 0,
    age: 0,
    facing: 1,
    reduced: false,
    crouched: false,
    grounded: true,
    stun: 36,
    vy: 0,
    landing: false,
    enhanced: false,
    superTier: 1,
    rollDirection: 1,
    parcelReturnDistance: null,
    commandGrabAge: null,
  },
);
const failedAdvanced = ref(new Set<FighterId>());
const failedNormal = ref(new Set<FighterId>());
const failedGrapple = ref(false);
const failedSignature = ref(false);
const grapple = computed(() => grappleFrame(props.id, props.action, props.age));
const signature = computed(() =>
  signatureFrame(
    props.id,
    props.action,
    props.age,
    props.parcelReturnDistance,
    props.commandGrabAge,
  ),
);
const normal = computed(() => normalFrame(props.id, props.action, props.age));
const advanced = computed(() => advancedFrame(props.id, props.action, props.age, props.reduced));
function advancedFailed(id: FighterId) {
  failedAdvanced.value = new Set([...failedAdvanced.value, id]);
}
function normalFailed(id: FighterId) {
  failedNormal.value = new Set([...failedNormal.value, id]);
}
</script>
<template>
  <AdvancedMotionSprite
    v-if="signature !== null && !failedSignature"
    :id="id"
    family="signature"
    :frame="signature"
    :facing="facing"
    @unavailable="failedSignature = true"
  />
  <AdvancedMotionSprite
    v-else-if="grapple !== null && !failedGrapple"
    :id="id"
    family="grapple"
    :frame="grapple"
    :facing="facing"
    @unavailable="failedGrapple = true"
  />
  <AdvancedMotionSprite
    v-else-if="normal !== null && !failedNormal.has(id)"
    :id="id"
    family="normal"
    :frame="normal"
    :facing="facing"
    @unavailable="normalFailed"
  />
  <AdvancedMotionSprite
    v-else-if="advanced !== null && !failedAdvanced.has(id)"
    :id="id"
    :frame="advanced"
    :facing="action === 'roll' ? rollDirection : facing"
    @unavailable="advancedFailed"
  />
  <NewcomerSprite
    v-else-if="isNewcomer(id)"
    :id="id"
    :action="action"
    :frame="frame"
    :age="age"
    :facing="facing"
    :reduced="reduced"
    :crouched="crouched"
    :grounded="grounded"
    :stun="stun"
    :vy="vy"
    :landing="landing"
    :enhanced="enhanced"
    :super-tier="superTier"
  />
  <LegacyRasterFighter
    v-else
    :id="id"
    :action="action"
    :frame="frame"
    :age="age"
    :facing="facing"
    :reduced="reduced"
    :crouched="crouched"
    :grounded="grounded"
    :stun="stun"
    :enhanced="enhanced"
    :super-tier="superTier"
    :landing="landing"
  />
</template>
