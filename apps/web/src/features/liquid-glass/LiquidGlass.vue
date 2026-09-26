<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { createGlassRenderer, type GlassSurface } from './renderer';
import landscapeBackdropUrl from '../../assets/images/bg_menu_landscape.png';
import portraitBackdropUrl from '../../assets/images/bg_menu_portrait.png';

const canvas = ref<HTMLCanvasElement>();
const rendererMode = ref<'webgl' | 'fallback'>('fallback');
const axes = ['x', 'y', 'scale', 'activity', 'pressed'] as const;
const neutral = () => ({ x: 0, y: 0, scale: 1, activity: 0, pressed: 0 });

type SurfaceState = {
  element: HTMLElement;
  parent: SurfaceState | undefined;
  value: ReturnType<typeof neutral>;
  velocity: ReturnType<typeof neutral>;
  pointerX: number;
  pointerY: number;
};

const surfaces = new Map<HTMLElement, SurfaceState>();
let platform: HTMLElement | null = null;
let renderer: ReturnType<typeof createGlassRenderer> = null;
let backdrop: HTMLImageElement | undefined;
let resizeObserver: ResizeObserver | undefined;
let mutationObserver: MutationObserver | undefined;
let motionPreference: MediaQueryList;
let backdropPreference: MediaQueryList;
let reducedMotion = false;
let frame = 0;
let previousTime = 0;
let animationTime = 0;
let disposed = false;
let hovered: HTMLElement | null = null;
let focused: HTMLElement | null = null;
let pointerPressed: HTMLElement | null = null;
let keyPressed: HTMLElement | null = null;
let activePointer: number | null = null;
let pointerX = 0;
let pointerY = 0;

function requestFrame() {
  if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(animate);
}

function closestSurface(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest<HTMLElement>('[data-glass]') : null;
  return element && surfaces.has(element) ? element : null;
}

function resetElement(element: HTMLElement) {
  element.style.removeProperty('--glass-x');
  element.style.removeProperty('--glass-y');
  element.style.removeProperty('--glass-scale');
  delete element.dataset.glassActive;
}

function collectSurfaces() {
  const elements = new Set(platform?.querySelectorAll<HTMLElement>('[data-glass]'));
  for (const [element] of surfaces) {
    if (!elements.has(element)) {
      resizeObserver?.unobserve(element);
      resetElement(element);
      surfaces.delete(element);
    }
  }
  for (const element of elements) {
    if (!surfaces.has(element)) {
      surfaces.set(element, {
        element,
        parent: undefined,
        value: neutral(),
        velocity: { ...neutral(), scale: 0 },
        pointerX: 0,
        pointerY: 0,
      });
      resizeObserver?.observe(element);
    }
  }
  for (const state of surfaces.values()) {
    const parent = state.element.parentElement?.closest<HTMLElement>('[data-glass]');
    state.parent = parent ? surfaces.get(parent) : undefined;
  }
  const ordered = [...elements].map((element) => surfaces.get(element)!);
  surfaces.clear();
  for (const state of ordered) surfaces.set(state.element, state);
  requestFrame();
}

function animate(time: number) {
  frame = 0;
  if (disposed || document.hidden) return;
  const delta = previousTime ? Math.min((time - previousTime) / 1000, 1 / 30) : 1 / 60;
  previousTime = time;
  if (!reducedMotion) animationTime += delta;
  let moving = false;

  // Read all layout before writing transforms, including nested glass surfaces.
  const measurements = new Map(
    [...surfaces.values()].map((state) => {
      const rect = state.element.getBoundingClientRect();
      const style = getComputedStyle(state.element);
      const transform = new DOMMatrixReadOnly(
        style.transform === 'none' ? undefined : style.transform,
      );
      return [
        state,
        {
          rect,
          radius: parseFloat(style.borderTopLeftRadius) || 0,
          percentRadius: style.borderTopLeftRadius.includes('%'),
          visible: style.visibility !== 'hidden' && style.display !== 'none',
          before: { x: transform.e, y: transform.f, scale: transform.a },
        },
      ] as const;
    }),
  );

  for (const [state, { rect }] of measurements) {
    const { element } = state;
    const pointed = element === hovered || element === pointerPressed;
    const pressed = element === pointerPressed || element === keyPressed;
    const active = pointed || element === focused || pressed;
    if (pointed && rect.width && rect.height) {
      state.pointerX = Math.max(-1, Math.min(1, ((pointerX - rect.left) / rect.width) * 2 - 1));
      state.pointerY = Math.max(-1, Math.min(1, ((pointerY - rect.top) / rect.height) * 2 - 1));
    }

    const pull = Math.min(6, Math.min(rect.width, rect.height) * 0.055);
    const target = {
      x: pointed ? state.pointerX * pull : 0,
      y: pointed ? state.pointerY * pull : 0,
      scale: pressed ? 0.97 : pointed ? 1 + Math.min(0.025, 1.8 / Math.max(rect.height, 1)) : 1,
      activity: pressed ? 1 : pointed ? 0.72 : element === focused ? 0.38 : 0,
      pressed: pressed ? 1 : 0,
    };

    for (const axis of axes) {
      if (reducedMotion) {
        state.value[axis] = axis === 'scale' ? 1 : 0;
        state.velocity[axis] = 0;
        continue;
      }
      const distance = target[axis] - state.value[axis];
      state.velocity[axis] += (distance * 420 - state.velocity[axis] * 24) * delta;
      state.value[axis] += state.velocity[axis] * delta;
      if (Math.abs(distance) < 0.001 && Math.abs(state.velocity[axis]) < 0.01) {
        state.value[axis] = target[axis];
        state.velocity[axis] = 0;
      } else {
        moving = true;
      }
    }
    state.element.dataset.glassActive = String(active && !reducedMotion);
  }

  const visibleSurfaces: Array<GlassSurface & { layer: number }> = [];
  for (const [state, measurement] of measurements) {
    const { rect, visible } = measurement;
    if (!visible || !rect.width || !rect.height || state.element.dataset.glassOptics === 'false') {
      continue;
    }
    let centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;
    let width = rect.width;
    let height = rect.height;
    let totalScale = 1;
    let layer = Number(state.element.dataset.glassLayer) || 0;

    // Project the measured rectangle through this frame's transform changes.
    // This keeps text and refraction aligned without a second layout read.
    for (let ancestor: SurfaceState | undefined = state; ancestor; ancestor = ancestor.parent) {
      const measured = measurements.get(ancestor)!;
      let outerScale = 1;
      for (let parent = ancestor.parent; parent; parent = parent.parent) {
        outerScale *= measurements.get(parent)!.before.scale;
      }
      const ratio = ancestor.value.scale / measured.before.scale;
      const originX = measured.rect.left + measured.rect.width / 2;
      const originY = measured.rect.top + measured.rect.height / 2;
      centerX = originX + (centerX - originX) * ratio;
      centerY = originY + (centerY - originY) * ratio;
      centerX += (ancestor.value.x - measured.before.x) * outerScale;
      centerY += (ancestor.value.y - measured.before.y) * outerScale;
      width *= ratio;
      height *= ratio;
      totalScale *= ancestor.value.scale;
      layer = Math.max(layer, Number(ancestor.element.dataset.glassLayer) || 0);
    }

    const x = centerX - width / 2;
    const y = centerY - height / 2;
    if (x + width < -40 || y + height < -40 || x > innerWidth + 40 || y > innerHeight + 40) {
      continue;
    }
    const radius = measurement.percentRadius
      ? (measurement.radius / 100) * Math.min(width, height)
      : measurement.radius * totalScale;
    visibleSurfaces.push({
      x,
      y,
      width,
      height,
      radius: Math.min(radius, width / 2, height / 2),
      pointerX: reducedMotion ? 0 : state.pointerX,
      pointerY: reducedMotion ? 0 : state.pointerY,
      activity: Math.max(0, Math.min(1, state.value.activity)),
      pressed: Math.max(0, Math.min(1, state.value.pressed)),
      tint: Number(state.element.dataset.glassTint) || 0,
      layer,
    });
  }

  for (const state of surfaces.values()) {
    state.element.style.setProperty('--glass-x', `${state.value.x.toFixed(3)}px`);
    state.element.style.setProperty('--glass-y', `${state.value.y.toFixed(3)}px`);
    state.element.style.setProperty('--glass-scale', state.value.scale.toFixed(5));
  }
  // Stable sorting keeps each parent before its children within a compositing layer.
  visibleSurfaces.sort((left, right) => left.layer - right.layer);
  try {
    renderer?.render(visibleSurfaces, reducedMotion ? 0 : animationTime);
  } catch {
    useFallbackRenderer();
  }
  if (moving) requestFrame();
  else previousTime = 0;
}

function onPointerMove(event: PointerEvent) {
  if (activePointer !== null && activePointer !== event.pointerId) return;
  pointerX = event.clientX;
  pointerY = event.clientY;
  const previous = hovered;
  hovered = closestSurface(event.target);
  if (!reducedMotion && (hovered || previous || pointerPressed)) requestFrame();
}

function onPointerDown(event: PointerEvent) {
  if (
    !event.isPrimary ||
    event.button !== 0 ||
    (activePointer !== null && activePointer !== event.pointerId)
  ) {
    return;
  }
  onPointerMove(event);
  pointerPressed = closestSurface(event.target);
  activePointer = event.pointerId;
  if (!reducedMotion && pointerPressed) requestFrame();
}

function onPointerEnd(event: PointerEvent) {
  if (activePointer !== event.pointerId) return;
  pointerPressed = null;
  activePointer = null;
  if (event.pointerType === 'touch' || event.type === 'pointercancel') hovered = null;
  if (!reducedMotion) requestFrame();
}

function onPointerOut(event: PointerEvent) {
  const previous = hovered;
  hovered = closestSurface(event.relatedTarget);
  if (!reducedMotion && (hovered || previous)) requestFrame();
}

function onFocus(event: FocusEvent) {
  focused = closestSurface(event.type === 'focusin' ? event.target : event.relatedTarget);
  if (keyPressed !== focused) keyPressed = null;
  if (!reducedMotion) requestFrame();
}

function onKeyDown(event: KeyboardEvent) {
  if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
    keyPressed = closestSurface(event.target);
    if (!reducedMotion) requestFrame();
  }
}

function onKeyUp(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    keyPressed = null;
    if (!reducedMotion) requestFrame();
  }
}

function releaseInput() {
  hovered = pointerPressed = keyPressed = null;
  activePointer = null;
  requestFrame();
}

function onVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  } else {
    requestFrame();
  }
}

function onMotionChange() {
  reducedMotion = motionPreference.matches;
  requestFrame();
}

function updateRenderer() {
  if (disposed) return;
  renderer?.dispose();
  renderer = null;
  try {
    if (canvas.value && backdrop?.complete && backdrop.naturalWidth) {
      renderer = createGlassRenderer(canvas.value, backdrop);
    }
  } catch {
    useFallbackRenderer();
    return;
  }
  rendererMode.value = renderer ? 'webgl' : 'fallback';
  if (platform) platform.dataset.glassRenderer = rendererMode.value;
  requestFrame();
}

function useFallbackRenderer() {
  if (disposed) return;
  renderer?.dispose();
  renderer = null;
  rendererMode.value = 'fallback';
  if (platform) platform.dataset.glassRenderer = 'fallback';
}

function updateBackdrop() {
  if (disposed) return;
  if (backdrop) {
    backdrop.onload = null;
    backdrop.onerror = null;
  }
  useFallbackRenderer();
  const image = new Image();
  backdrop = image;
  image.onload = () => {
    if (backdrop === image) updateRenderer();
  };
  image.onerror = () => {
    if (backdrop === image) useFallbackRenderer();
  };
  image.src = backdropPreference.matches ? portraitBackdropUrl : landscapeBackdropUrl;
}

function onContextLost(event: Event) {
  event.preventDefault();
  useFallbackRenderer();
}

onMounted(() => {
  // Game optics observe only the toolbar, never the game's animated DOM.
  platform = canvas.value?.closest<HTMLElement>('.game-toolbar, .platform-shell') ?? null;
  motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion = motionPreference.matches;
  resizeObserver = new ResizeObserver(requestFrame);
  mutationObserver = new MutationObserver(collectSurfaces);
  if (platform) {
    resizeObserver.observe(platform);
    mutationObserver.observe(platform, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'hidden',
        'data-glass',
        'data-glass-tint',
        'data-glass-layer',
        'data-glass-optics',
      ],
    });
  }
  collectSurfaces();
  backdropPreference = matchMedia('(max-width: 760px)');
  backdropPreference.addEventListener('change', updateBackdrop);
  updateBackdrop();
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerover', onPointerMove, { passive: true });
  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  document.addEventListener('pointerout', onPointerOut, { passive: true });
  document.addEventListener('focusin', onFocus);
  document.addEventListener('focusout', onFocus);
  window.addEventListener('pointerup', onPointerEnd, { passive: true });
  window.addEventListener('pointercancel', onPointerEnd, { passive: true });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseInput);
  window.addEventListener('resize', requestFrame, { passive: true });
  window.addEventListener('scroll', requestFrame, { passive: true, capture: true });
  document.addEventListener('visibilitychange', onVisibility);
  motionPreference.addEventListener('change', onMotionChange);
  canvas.value?.addEventListener('webglcontextlost', onContextLost);
  canvas.value?.addEventListener('webglcontextrestored', updateRenderer);
});

onBeforeUnmount(() => {
  disposed = true;
  if (backdrop) {
    backdrop.onload = null;
    backdrop.onerror = null;
  }
  cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
  renderer?.dispose();
  for (const element of surfaces.keys()) resetElement(element);
  surfaces.clear();
  if (platform) delete platform.dataset.glassRenderer;
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerover', onPointerMove);
  document.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('pointerout', onPointerOut);
  document.removeEventListener('focusin', onFocus);
  document.removeEventListener('focusout', onFocus);
  window.removeEventListener('pointerup', onPointerEnd);
  window.removeEventListener('pointercancel', onPointerEnd);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', releaseInput);
  window.removeEventListener('resize', requestFrame);
  window.removeEventListener('scroll', requestFrame, true);
  document.removeEventListener('visibilitychange', onVisibility);
  motionPreference?.removeEventListener('change', onMotionChange);
  backdropPreference?.removeEventListener('change', updateBackdrop);
  canvas.value?.removeEventListener('webglcontextlost', onContextLost);
  canvas.value?.removeEventListener('webglcontextrestored', updateRenderer);
});
</script>

<template>
  <canvas
    ref="canvas"
    class="liquid-glass-canvas"
    :data-renderer="rendererMode"
    aria-hidden="true"
  />
</template>
