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
:root {
  /* Light Mode Variables */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #f0f0f0;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #dee2e6;
  --input-bg: #ffffff;
  --input-border: #dcdfe6;
  --input-hover: #c0c4cc;
  --hover-bg: #e9ecef;
  --active-bg: #e6f4ea;
  --primary-color: #42b883;
  --primary-hover: #33a06f;
  --primary-disabled: #a8dcc5;
  --secondary-btn-bg: #6c757d;
  --secondary-btn-hover: #5a6268;
  --secondary-btn-disabled: #e2e6ea;
  --secondary-btn-text-disabled: #aeb5bc;
  --danger-color: #dc3545;
  --danger-bg-hover: #fff5f5;
  
  /* Chip Visualization Variables */
  --chip-viz-bg: #f0f0f0;
  --zoom-control-bg: #ffffff;
  --zoom-control-text: #555555;
  --zoom-control-hover: #f0f0f0;
  --zoom-control-border: #dddddd;
}

.dark-mode {
  /* Dark Mode Variables */
  --bg-primary: #1a1a1a;
  --bg-secondary: #242424;
  --bg-tertiary: #2a2a2a;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --border-color: #404040;
  --input-bg: #2a2a2a;
  --input-border: #404040;
  --input-hover: #505050;
  --hover-bg: #333333;
  --active-bg: #1e3a2f;
  --primary-color: #42b883;
  --primary-hover: #33a06f;
  --primary-disabled: #2d5242;
  --secondary-btn-bg: #4a4a4a;
  --secondary-btn-hover: #3a3a3a;
  --secondary-btn-disabled: #333333;
  --secondary-btn-text-disabled: #666666;
  --danger-color: #ff6b6b;
  --danger-bg-hover: #3a1e1e;
  
  /* Chip Visualization Variables */
  --chip-viz-bg: #121212;
  --zoom-control-bg: #333333;
  --zoom-control-text: #dddddd;
  --zoom-control-hover: #444444;
  --zoom-control-border: #555555;
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