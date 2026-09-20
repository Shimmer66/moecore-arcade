<script setup lang="ts">
import { ASSETS } from '@moecore/assets';
</script>

<template>
  <section aria-labelledby="games-title">
    <div class="section-heading">
      <h1 id="games-title">小游戏</h1>
      <span>尚未开放</span>
    </div>
    <div class="empty-state">
      <img :src="ASSETS.arcadeMark.url" alt="" width="112" height="112" />
      <h2>下一局，敬请期待</h2>
      <p>暂时还没有开放的游戏。</p>
    </div>
  </section>
</template>
