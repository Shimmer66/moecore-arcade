<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpRight, Search, Sparkles, X } from '@lucide/vue';
import { ARCADE_PORTRAITS } from '@moecore/assets';
import { games } from '../games/registry';

const emit = defineEmits<{ select: [gameId: string] }>();
const filters = ['全部', '益智', '动作', '文字', '卡牌', '多人'] as const;
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
</script>

<template>
  <div class="arcade-home">
    <section class="arcade-hero" aria-labelledby="arcade-hero-title">
      <div class="hero-copy">
        <h1 id="arcade-hero-title">今天，玩点<span>什么？</span></h1>
        <p>和 AI 娘一起，把大模型玩成小游戏。</p>
      </div>
      <div class="hero-note">
        <span class="note-sparkle" aria-hidden="true"
          ><Sparkles :size="25" :stroke-width="1.4"
        /></span>
        <p>一小局的时间，<br />给日常一点灵感。</p>
        <span>{{ games.length }} 款小游戏 · 免费试玩</span>
      </div>
    </section>

    <section id="games" class="games-section" aria-labelledby="games-title">
      <div class="games-toolbar">
        <div class="games-title-group">
          <h2 id="games-title">小游戏</h2>
          <span>随时开始你的下一局</span>
        </div>
        <div class="game-search" data-glass data-glass-layer="4">
          <Search :size="19" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            aria-label="搜索小游戏"
            placeholder="搜索你的下一份快乐"
          />
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
            />
          </div>
          <div class="catalog-body">
            <span class="catalog-category">{{ game.category }}</span>
            <h3>{{ game.title }}</h3>
            <p>{{ game.description }}</p>
            <div class="catalog-meta">
              <span class="catalog-ready"><span aria-hidden="true"></span>即点即玩</span>
              <span class="catalog-play" aria-hidden="true"><ArrowUpRight :size="19" /></span>
            </div>
          </div>
        </button>
      </div>
      <div v-if="visibleGames.length === 0" class="catalog-empty" role="status">
        <Search :size="28" :stroke-width="1.5" aria-hidden="true" />
        <h3>{{ search.trim() ? '还没有找到这款游戏' : '这个分类还在孵化中' }}</h3>
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
        <h2 id="contribute-title">下一款心动，由你创造。</h2>
        <p>想让你推的模型娘登场？带上游戏创意或角色设定，一起共创萌芯游乐园。</p>
      </div>
      <a
        class="home-button"
        href="https://github.com/Shimmer66/moecore-arcade"
        target="_blank"
        rel="noreferrer"
        >加入共创 <ArrowUpRight :size="17" aria-hidden="true"
      /></a>
    </section>
  </div>
</template>
