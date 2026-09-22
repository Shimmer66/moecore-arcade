<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpRight } from '@lucide/vue';
import { games } from '../games/registry';

const emit = defineEmits<{ select: [gameId: string] }>();
const filters = ['全部', '益智', '动作', '文字', '卡牌', '多人'] as const;
const selectedFilter = ref<(typeof filters)[number]>('全部');
const visibleGames = computed(() =>
  games.filter(
    (game) => selectedFilter.value === '全部' || game.tags.includes(selectedFilter.value),
  ),
);
</script>

<template>
  <div class="arcade-home">
    <div class="home-bubble home-bubble-peach" aria-hidden="true"></div>
    <div class="home-bubble home-bubble-mint" aria-hidden="true"></div>
    <div class="home-bubble home-bubble-lav" aria-hidden="true"></div>

    <section class="arcade-hero" aria-labelledby="arcade-hero-title">
      <span class="hero-tag">🌸 AI 大模型娘化企划 · 非官方同人</span>
      <h1 id="arcade-hero-title">和<span>AI 娘</span>一起，<br />把大模型玩成小游戏</h1>
      <p>消消乐、跑酷、推箱子……每款游戏都由一位模型角色担当主角，全部免费试玩。</p>
      <div class="hero-actions">
        <a class="home-button home-button-primary" href="#games">🎮 立即开玩</a>
        <a class="home-button home-button-ghost" href="#about">了解企划 →</a>
      </div>
      <div class="hero-stats" aria-label="游乐园数据">
        <div>
          <strong>{{ games.length }}</strong
          ><span>试玩游戏</span>
        </div>
        <div><strong>12</strong><span>娘化角色</span></div>
        <div><strong>8w+</strong><span>累计游玩</span></div>
      </div>
    </section>

    <section id="games" class="games-section" aria-labelledby="games-title">
      <div class="games-toolbar">
        <h2 id="games-title">小游戏</h2>
        <div class="game-filters" role="tablist" aria-label="游戏分类">
          <button
            v-for="filter in filters"
            :key="filter"
            type="button"
            :class="{ active: selectedFilter === filter }"
            role="tab"
            :aria-selected="selectedFilter === filter"
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
          @click="emit('select', game.id)"
        >
          <div class="catalog-cover" :class="`tone-${game.tone}`" aria-hidden="true">
            <span v-if="game.badge" class="catalog-badge">{{ game.badge }}</span>
            <span class="catalog-emoji">{{
              game.icon === 'box' ? '📦' : game.icon === 'runner' ? '🏃‍♀️' : '🧩'
            }}</span>
          </div>
          <div class="catalog-body">
            <span class="catalog-category">{{ game.category }}</span>
            <h3>{{ game.title }}</h3>
            <p>{{ game.description }}</p>
            <div class="catalog-meta">
              <div class="catalog-tags">
                <span v-for="tag in game.tags" :key="tag">{{ tag }}</span>
              </div>
              <span class="catalog-play" aria-hidden="true"><ArrowUpRight :size="18" /></span>
            </div>
          </div>
        </button>
      </div>
    </section>

    <section id="about" class="contribute-banner" aria-labelledby="contribute-title">
      <h2 id="contribute-title">想让你推的模型娘登场？</h2>
      <p>提交你的游戏创意或角色设定，被采纳即可上线游乐园并获得专属徽章。</p>
      <a
        class="home-button home-button-light"
        href="https://github.com/Shimmer66/moecore-arcade"
        target="_blank"
        rel="noreferrer"
        >✨ 加入共创</a
      >
    </section>
  </div>
</template>
