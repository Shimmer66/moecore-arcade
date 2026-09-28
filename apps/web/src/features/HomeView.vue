<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ArrowUpRight, Search, Sparkles, X } from '@lucide/vue';
import { ARCADE_PORTRAITS } from '@moecore/assets';
import { games } from '../games/registry';

const emit = defineEmits<{ select: [gameId: string] }>();
const filters = ['全部', '益智', '动作'] as const;
const selectedFilter = ref<(typeof filters)[number]>('全部');
const search = ref('');
const visibleGames = computed(() =>
  games.filter(
    (game) =>
      (selectedFilter.value === '全部' || game.tags.includes(selectedFilter.value)) &&
      `${game.title} ${game.description} ${game.tags.join(' ')}`
        .toLocaleLowerCase()
        .includes(search.value.trim().toLocaleLowerCase()),
  ),
);
function resetFilters() {
  selectedFilter.value = '全部';
  search.value = '';
}
onMounted(() => {
  const section = window.location.hash.slice(1);
  if (section === 'games' || section === 'about') {
    document.getElementById(section)?.scrollIntoView();
  }
});
</script>

<template>
  <div class="arcade-home">
    <section class="arcade-hero" aria-labelledby="arcade-hero-title">
      <div class="hero-copy">
        <h1 id="arcade-hero-title">给今天，<br /><span>留一点好玩的。</span></h1>
        <p>和熟悉的 AI 角色一起闯关、解谜、收集灵感。无需下载，点开就能玩。</p>
      </div>
      <div class="hero-note">
        <span class="note-sparkle" aria-hidden="true"
          ><Sparkles :size="25" :stroke-width="1.4"
        /></span>
        <p>快乐，<br />正在加载中。</p>
        <span>{{ games.length }} 款可玩 · 免费试玩</span>
      </div>
    </section>

    <section id="games" class="games-section" aria-labelledby="games-title">
      <div class="games-toolbar">
        <div class="games-title-group">
          <h2 id="games-title">小游戏</h2>
          <span>{{ games.length }} 款可玩</span>
        </div>
        <div class="game-search" data-glass data-glass-layer="4">
          <Search :size="19" aria-hidden="true" />
          <input v-model="search" type="search" aria-label="搜索小游戏" placeholder="搜索小游戏" />
          <button v-if="search" type="button" aria-label="清除搜索" @click="search = ''">
            <X :size="16" />
          </button>
        </div>
      </div>
      <div class="game-filters" role="group" aria-label="游戏分类">
        <button
          v-for="filter in filters"
          :key="filter"
          data-glass
          data-glass-layer="5"
          :data-glass-tint="selectedFilter === filter ? 1 : 0"
          type="button"
          :class="{ active: selectedFilter === filter }"
          :aria-pressed="selectedFilter === filter"
          @click="selectedFilter = filter"
        >
          {{ filter }}
        </button>
      </div>

      <div class="game-catalog">
        <button
          v-for="(game, index) in visibleGames"
          :key="game.id"
          type="button"
          class="catalog-card"
          data-glass
          data-glass-layer="2"
          @click="emit('select', game.id)"
        >
          <div class="catalog-cover" :class="`tone-${game.tone}`" aria-hidden="true">
            <span class="app-index">0{{ index + 1 }}</span>
            <span v-if="game.badge" class="catalog-badge">{{ game.badge }}</span>
            <img
              :src="ARCADE_PORTRAITS[game.id]"
              class="catalog-portrait"
              alt=""
              width="164"
              height="164"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div class="catalog-body">
            <span class="catalog-category">{{ game.category }}</span>
            <h3>{{ game.title }}</h3>
            <p>{{ game.description }}</p>
            <div class="catalog-meta">
              <span class="catalog-ready"><span aria-hidden="true"></span>免费试玩</span>
              <span class="catalog-play" aria-hidden="true"><ArrowUpRight :size="19" /></span>
            </div>
          </div>
        </button>
      </div>
      <div v-if="visibleGames.length === 0" class="catalog-empty" role="status">
        <Search :size="28" :stroke-width="1.5" aria-hidden="true" />
        <h3>还没有找到这款游戏</h3>
        <p>换个关键词，或先看看其他小游戏吧。</p>
        <button type="button" class="home-button" data-glass @click="resetFilters">
          查看全部游戏
        </button>
      </div>
    </section>

    <section
      id="about"
      class="contribute-banner"
      aria-labelledby="contribute-title"
      data-glass
      data-glass-layer="3"
    >
      <div class="contribute-symbol" aria-hidden="true">
        <Sparkles :size="29" :stroke-width="1.4" />
      </div>
      <div class="contribute-copy">
        <h2 id="contribute-title">一点灵感，就能开始。</h2>
        <p>摸鱼局是一个非官方 AI 角色小游戏企划。欢迎带着你的点子，一起做些好玩的。</p>
      </div>
      <a
        class="home-button"
        href="https://github.com/Shimmer66/moecore-arcade"
        target="_blank"
        rel="noreferrer"
        >在 GitHub 一起共创 <ArrowUpRight :size="17" aria-hidden="true"
      /></a>
    </section>
  </div>
</template>
