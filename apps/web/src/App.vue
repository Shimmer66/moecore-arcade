<script setup lang="ts">
import { defineAsyncComponent, h, onMounted, onUnmounted, ref } from 'vue';
import { ASSETS } from '@moecore/assets';
import { ArrowUpRight } from '@lucide/vue';
import GameHost from './games/GameHost.vue';
const ViewLoading = {
  render: () => h('div', { class: 'view-loading', role: 'status' }, '正在加载…'),
};
const HomeView = defineAsyncComponent({
  loader: () => import('./features/HomeView.vue'),
  loadingComponent: ViewLoading,
  delay: 120,
});

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
    <a class="wordmark" href="#/" aria-label="摸鱼局首页">
      <img :src="ASSETS.arcadeMark.url" alt="" width="40" height="40" />
      <div>
        <span class="brand-name">摸鱼局</span>
      </div>
      <span class="brand-subtitle">玩点有趣的</span>
    </a>
    <nav class="site-nav" aria-label="主导航">
      <a href="#games">发现游戏</a>
      <a href="#about">关于</a>
      <a
        class="site-nav-cta"
        href="https://github.com/Shimmer66/moecore-arcade"
        target="_blank"
        rel="noreferrer"
        >GitHub <ArrowUpRight :size="15"
      /></a>
    </nav>
  </header>

  <main id="main-content">
    <GameHost v-if="selectedGame" :key="selectedGame" :game-id="selectedGame" @exit="leaveGame" />
    <HomeView v-else @select="selectGame" />
  </main>

  <footer class="site-footer">摸鱼局 · AI 角色小游戏合集 <span>非官方同人项目</span></footer>
</template>
