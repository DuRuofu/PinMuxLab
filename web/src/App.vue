<script setup lang="ts">
import PinMuxEditor from '@/view/PinMuxEditor.vue'
</script>

<template>
  <div class="app-root">
    <PinMuxEditor />
  </div>
</template>

<style>
@import '@/styles/theme.css';
@import '@/styles/chip-theme.css';

/* 全局样式重置 */
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s, color 0.3s;
}

.app-root {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>