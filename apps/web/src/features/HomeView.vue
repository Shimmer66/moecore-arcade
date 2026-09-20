<script setup lang="ts">
import { ArrowUpRight, Grid2X2 } from '@lucide/vue';
import { games } from '../games/registry';

defineEmits<{ select: [gameId: string] }>();
</script>

<template>
  <section aria-labelledby="games-title">
    <div class="section-heading">
      <h1 id="games-title">小游戏</h1>
      <span>{{ games.length }} 款试玩</span>
    </div>
    <div class="game-catalog">
      <button
        v-for="game in games"
        :key="game.id"
        type="button"
        class="game-card"
        @click="$emit('select', game.id)"
      >
        <div class="game-cover" aria-hidden="true"><Grid2X2 :size="80" :stroke-width="1.25" /></div>
        <div class="game-card-info">
          <span>{{ game.category }}</span>
          <h2>{{ game.title }}</h2>
          <span class="game-card-command">开始游戏 <ArrowUpRight :size="18" /></span>
        </div>
      </button>
    </div>
  </section>
</template>
