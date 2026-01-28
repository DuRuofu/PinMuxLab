<script setup lang="ts">
import PinMuxEditor from '@/view/PinMuxEditor.vue'
</script>

<template>
  <div class="app-root">
    <PinMuxEditor />
  </div>
</template>

<style>
/* 全局样式重置 */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

.app-root {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>