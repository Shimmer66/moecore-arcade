<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ASSETS } from '@moecore/assets';
import HomeView from './features/HomeView.vue';
import GameHost from './games/GameHost.vue';

const selectedGame = ref('');
function readRoute() {
  const match = /^#\/games\/([a-z0-9-]+)$/.exec(window.location.hash);
  selectedGame.value = match?.[1] ?? '';
}
function selectGame(id: string) {
  window.location.hash = `/games/${id}`;
}
function leaveGame() {
  window.location.hash = '/';
}
readRoute();

onMounted(() => {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = ASSETS.arcadeMark.url;
  window.addEventListener('hashchange', readRoute);
});
onUnmounted(() => window.removeEventListener('hashchange', readRoute));
</script>

<template>
  <header class="site-header">
    <div class="wordmark">
      <img :src="ASSETS.arcadeMark.url" alt="" width="40" height="40" />
      <div>
        <span class="brand-name">萌芯游乐园</span>
        <span class="brand-subtitle" lang="en">MoeCore Arcade</span>
      </div>
    </div>
    <nav class="site-nav" aria-label="主导航">
      <a href="#games">小游戏</a>
      <a href="#about">关于企划</a>
      <a
        class="site-nav-cta"
        href="https://github.com/Shimmer66/moecore-arcade"
        target="_blank"
        rel="noreferrer"
        >加入共创</a
      >
    </nav>
    <span class="development-label">原型试玩</span>
  </header>

  <main id="main-content">
    <GameHost v-if="selectedGame" :key="selectedGame" :game-id="selectedGame" @exit="leaveGame" />
    <HomeView v-else @select="selectGame" />
  </main>

  <footer class="site-footer">MoeCore Arcade · 非官方同人项目</footer>
</template>
