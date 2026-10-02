<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ArrowUpRight, ArrowRight, Play, Gamepad2, Crosshair } from '@lucide/vue';
import { HOME_ART, HOME_COVER_ART } from '@moecore/assets';
import { games } from '../games/registry';

const emit = defineEmits<{ select: [gameId: string] }>();
const filters = ['全部', '益智', '动作'] as const;
const selectedFilter = ref<(typeof filters)[number]>('全部');
const visibleGames = computed(() =>
  games.filter(
    (game) => selectedFilter.value === '全部' || game.tags.includes(selectedFilter.value),
  ),
);
const coverArt: Record<string, string> = {
  duel: HOME_ART.duel,
  steady: HOME_COVER_ART.match3,
  arena: HOME_COVER_ART.arena,
  match3: HOME_COVER_ART.match3,
  parkour: HOME_ART.parkour,
  sokoban: HOME_COVER_ART.sokoban,
  'whale-queue': HOME_COVER_ART.whaleQueue,
  rewrite: HOME_ART.rewrite,
};
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
        <span class="hero-eyebrow"><Gamepad2 :size="16" /> AI 角色小游戏合集</span>
        <h1 id="arcade-hero-title">给今天，<br /><span>留一点好玩的。</span></h1>
        <p>
          和熟悉的 AI 角色一起闯关、解谜、收集灵感。<br
            class="desktop-break"
          />无需下载，点开就能玩。
        </p>
        <a class="home-button home-button-primary" href="#games"
          >发现小游戏 <ArrowRight :size="17"
        /></a>
        <span class="hero-note">免费试玩 · 无需登录</span>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-halo"></div>
        <img
          class="hero-character hero-character-back"
          :src="HOME_COVER_ART.whaleQueue"
          alt=""
          width="512"
          height="512"
          decoding="async"
        />
        <img
          class="hero-character hero-character-front"
          :src="HOME_COVER_ART.match3"
          alt=""
          width="640"
          height="640"
          decoding="async"
          fetchpriority="high"
        />
        <span class="hero-art-caption"><span></span> 快乐，正在加载中</span>
      </div>
    </section>

    <section id="games" class="games-section" aria-labelledby="games-title">
      <div class="games-toolbar">
        <div class="games-intro">
          <h2 id="games-title">小游戏</h2>
          <span class="game-count">{{ games.length }} 款可玩</span>
        </div>
        <div class="game-filters" role="group" aria-label="游戏分类">
          <button
            v-for="filter in filters"
            :key="filter"
            type="button"
            :class="{ active: selectedFilter === filter }"
            :aria-pressed="selectedFilter === filter"
            @click="selectedFilter = filter"
          >
            {{ filter }}
          </button>
        </div>
      </div>
      <div class="game-catalog">
        <button
          v-for="game in visibleGames"
          :key="game.id"
          type="button"
          class="catalog-card"
          :class="`tone-${game.tone}`"
          @click="emit('select', game.id)"
        >
          <span class="catalog-cover" aria-hidden="true">
            <span class="cover-grid"></span>
            <span v-if="game.badge" class="catalog-badge">{{ game.badge }}</span>
            <img
              v-if="coverArt[game.id]"
              :src="coverArt[game.id]"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <Crosshair v-else class="catalog-fallback" :size="96" :stroke-width="1" />
            <span class="catalog-play"><Play :size="20" fill="currentColor" /></span>
          </span>
          <span class="catalog-body">
            <span class="catalog-category">{{ game.category }}</span>
            <span class="catalog-title-row"
              ><span class="catalog-title">{{ game.title }}</span
              ><ArrowUpRight :size="18"
            /></span>
            <span class="catalog-description">{{ game.description }}</span>
          </span>
        </button>
      </div>
    </section>

    <section id="about" class="contribute-banner" aria-labelledby="contribute-title">
      <div>
        <h2 id="contribute-title">一点灵感，就能开始。</h2>
        <p>摸鱼局是一个非官方 AI 角色小游戏企划。欢迎带着你的点子，一起做些好玩的。</p>
      </div>
      <a
        class="contribute-link"
        href="https://github.com/Shimmer66/moecore-arcade"
        target="_blank"
        rel="noreferrer"
        >在 GitHub 一起共创 <ArrowUpRight :size="17"
      /></a>
    </section>
  </div>
</template>
