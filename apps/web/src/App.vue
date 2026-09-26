<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { ASSETS } from '@moecore/assets';
import HomeView from './features/HomeView.vue';
import GameHost from './games/GameHost.vue';
import LiquidGlass from './features/liquid-glass/LiquidGlass.vue';
import LiquidDock from './features/liquid-glass/LiquidDock.vue';

const selectedGame = ref('');
const activeSection = ref<'home' | 'games' | 'about'>('home');
function readRoute() {
  const match = /^#\/games\/([a-z0-9-]+)$/.exec(window.location.hash);
  selectedGame.value = match?.[1] ?? '';
  activeSection.value =
    window.location.hash === '#about'
      ? 'about'
      : window.location.hash === '#games'
        ? 'games'
        : 'home';
}
function scrollToSection(behavior: 'auto' | 'smooth' = 'auto') {
  if (selectedGame.value) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    return;
  }
  if (activeSection.value === 'home') window.scrollTo({ top: 0, behavior });
  else document.getElementById(activeSection.value)?.scrollIntoView({ behavior, block: 'start' });
}
function sectionScrollBehavior(): 'auto' | 'smooth' {
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
async function onRouteChange() {
  readRoute();
  await nextTick();
  scrollToSection(sectionScrollBehavior());
}
function navigateSection(section: 'home' | 'games' | 'about') {
  // pushState preserves back/forward history without the browser's instant
  // anchor jump interrupting smooth scrolling after a drag is released.
  if (window.location.hash !== `#${section}`) {
    history.pushState(null, '', `#${section}`);
  }
  void onRouteChange();
}
function selectGame(id: string) {
  window.location.hash = `/games/${id}`;
}
function leaveGame() {
  window.location.hash = 'games';
}
readRoute();

onMounted(() => {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = ASSETS.arcadeMark.url;
  window.addEventListener('hashchange', onRouteChange);
  scrollToSection();
});
onUnmounted(() => window.removeEventListener('hashchange', onRouteChange));
</script>

<template>
  <div id="home" class="platform-shell" :class="selectedGame ? 'platform-game' : 'platform-home'">
    <LiquidGlass v-if="!selectedGame" />
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <header v-if="!selectedGame" class="site-header">
      <div class="wordmark">
        <img :src="ASSETS.arcadeMark.url" alt="" width="40" height="40" />
        <div>
          <span class="brand-name">萌芯游乐园</span>
          <span class="brand-subtitle" lang="en">MoeCore Arcade</span>
        </div>
      </div>
      <LiquidDock :active-section="activeSection" @select="navigateSection" />
      <span class="development-label"
        ><span aria-hidden="true" class="status-dot"></span>原型试玩</span
      >
    </header>

    <main id="main-content">
      <GameHost v-if="selectedGame" :key="selectedGame" :game-id="selectedGame" @exit="leaveGame" />
      <HomeView v-else @select="selectGame" />
    </main>

    <footer class="site-footer">MoeCore Arcade · 非官方同人项目</footer>
  </div>
</template>
