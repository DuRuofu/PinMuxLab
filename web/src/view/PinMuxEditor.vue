<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useChipStore } from '@/stores/chipStore'
import ChipPackage from '@/components/ChipPackage.vue'
import type { RenderedPin } from '@/utils/packageLayout'
import { exportConfigurationToCSV } from '@/utils/exportUtils'

// 导入示例数据
import ch32v003Data from '@/assets/WCH_CH32V003F4U6_QFN20.json'

const chipStore = useChipStore()
const selectedPin = ref<RenderedPin | null>(null)
const selectedPinFunctions = ref<string[]>([])

// Context Menu State
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuPin = ref<RenderedPin | null>(null)
const contextMenuFunctions = ref<string[]>([])

onMounted(() => {
  // 模拟从文件/API 加载
  console.log('Loading Chip Data...', ch32v003Data)
  chipStore.loadChip(ch32v003Data as any)
  
  // Close context menu on global click
  window.addEventListener('click', () => {
    showContextMenu.value = false
  })
})

function onExportCSV() {
  if (!chipStore.currentChip) return
  exportConfigurationToCSV(chipStore.currentChip, chipStore.pinConfigurations)
}

function onPinClick(pin: RenderedPin) {
  console.log('Pin Clicked:', pin)
  selectedPin.value = pin
  selectedPinFunctions.value = chipStore.getPinFunctions(pin.name)
  // Hide context menu if open
  showContextMenu.value = false
}

function handlePinContextMenu(pin: RenderedPin, event: MouseEvent) {
  console.log('Pin Right Clicked:', pin)
  // 同时也选中该引脚，方便侧边栏同步显示
  selectedPin.value = pin
  selectedPinFunctions.value = chipStore.getPinFunctions(pin.name)
  
  contextMenuPin.value = pin
  contextMenuFunctions.value = chipStore.getPinFunctions(pin.name)
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = true
}

function onFunctionSelect(func: string) {
  if (!selectedPin.value) return
  // Toggle: 如果点击的是当前已选的功能，则取消选择
  const current = chipStore.getPinConfiguration(selectedPin.value.name)
  if (current === func) {
    chipStore.setPinFunction(selectedPin.value.name, '')
  } else {
    chipStore.setPinFunction(selectedPin.value.name, func)
  }
}

// 获取当前选中引脚的配置功能
const currentFunction = computed(() => {
  if (!selectedPin.value) return undefined
  return chipStore.getPinConfiguration(selectedPin.value.name)
})
</script>

<template>
  <div class="editor-container">
    <header>
      <div class="brand">
        <img src="/logo.png" alt="PinMuxLab Logo" class="logo" />
        <h1>PinMuxLab</h1>
      </div>
      <div v-if="chipStore.isLoaded" class="chip-info">
        <span>{{ chipStore.currentChip?.meta.vendor }}</span>
        <a 
          v-if="chipStore.currentChip?.meta.datasheet"
          :href="chipStore.currentChip?.meta.datasheet" 
          target="_blank" 
          class="chip-name-link"
          title="View Datasheet"
        >
          {{ chipStore.currentChip?.meta.name }}
          <span class="icon">📄</span>
        </a>
        <span v-else>{{ chipStore.currentChip?.meta.name }}</span>
        <span>{{ chipStore.currentChip?.meta.package }}</span>
      </div>
      <div class="actions">
        <button class="btn-primary" @click="onExportCSV" :disabled="!chipStore.isLoaded">
          Export CSV
        </button>
      </div>
    </header>

    <main>
      <div class="visualization-area">
        <ChipPackage 
          v-if="chipStore.isLoaded"
          :package-info="chipStore.currentChip!.package"
          :chip-meta="chipStore.currentChip!.meta"
          :pin-configurations="chipStore.pinConfigurations"
          @pin-click="onPinClick"
          @pin-contextmenu="handlePinContextMenu"
        />
        <div v-else class="loading">Loading...</div>
      </div>

      <aside class="sidebar">
        <div v-if="selectedPin" class="pin-details">
          <div class="pin-header">
            <h2>{{ selectedPin.name }}</h2>
            <span class="pin-type badge">{{ chipStore.getPinType(selectedPin.name) }}</span>
          </div>
          <p class="pin-meta">Physical Pin: #{{ selectedPin.number }}</p>
          
          <h3>Function Selection</h3>
          <div class="function-list">
            <div 
              v-for="func in selectedPinFunctions" 
              :key="func"
              class="function-item"
              :class="{ 'is-selected': currentFunction === func }"
              @click="onFunctionSelect(func)"
            >
              <span class="radio-indicator"></span>
              <span class="func-name">{{ func }}</span>
            </div>
            <div v-if="selectedPinFunctions.length === 0" class="no-functions">
              No configurable functions
            </div>
          </div>
        </div>
        <div v-else class="placeholder">
          Click a pin to view details
        </div>
      </aside>

    <!-- Context Menu -->
    <div 
      v-if="showContextMenu" 
      class="context-menu"
      :style="{ top: `${contextMenuY}px`, left: `${contextMenuX}px` }"
      @click.stop
    >
      <div class="menu-header">Pin {{ contextMenuPin?.name }}</div>
      <div class="menu-list">
        <div 
          v-for="func in contextMenuFunctions" 
          :key="func"
          class="menu-item"
          :class="{ 'is-active': chipStore.getPinConfiguration(contextMenuPin!.name) === func }"
          @click="onFunctionSelect(func); showContextMenu = false"
        >
          {{ func }}
        </div>
        <div 
          v-if="contextMenuFunctions.length === 0" 
          class="menu-item disabled"
        >
          No functions available
        </div>
        <div 
            v-if="chipStore.getPinConfiguration(contextMenuPin!.name)"
            class="menu-separator"
        ></div>
        <div 
             v-if="chipStore.getPinConfiguration(contextMenuPin!.name)"
             class="menu-item danger"
             @click="onFunctionSelect(chipStore.getPinConfiguration(contextMenuPin!.name)!); showContextMenu = false"
        >
          Clear Configuration
        </div>
      </div>
    </div>
    </main>
  </div>
</template>

<style scoped>
.editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

header {
  padding: 0.5rem 1rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  height: 32px;
  width: auto;
}

.brand h1 {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
}

.chip-info {
  display: flex;
  align-items: center;
}

.chip-info span {
  margin-left: 1rem;
  font-weight: bold;
  color: #666;
}

.chip-name-link {
  margin-left: 1rem;
  font-weight: bold;
  color: #42b883;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chip-name-link:hover {
  text-decoration: underline;
  color: #33a06f;
}

.chip-name-link .icon {
  font-size: 0.8em;
}

.actions {
  margin-left: auto;
  padding-left: 20px;
}

.btn-primary {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #33a06f;
}

.btn-primary:disabled {
  background-color: #a8dcc5;
  cursor: not-allowed;
}

main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.visualization-area {
  flex: 1;
  background-color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.loading {
  color: #666;
}

.sidebar {
  width: 300px;
  background-color: #f8f9fa;
  border-left: 1px solid #dee2e6;
  padding: 1rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.pin-details {
  display: flex;
  flex-direction: column;
}

.pin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.pin-header h2 {
  margin: 0;
  color: #2c3e50;
}

.badge {
  background-color: #e9ecef;
  color: #495057;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: normal;
}

.pin-meta {
  color: #666;
  font-size: 0.9rem;
  margin: 0 0 1.5rem 0;
}

.function-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.function-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.function-item:hover {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.function-item.is-selected {
  background-color: #e6f4ea; /* Vue Green Tint */
  border-color: #42b883;
  color: #2c3e50;
  font-weight: bold;
}

.radio-indicator {
  width: 16px;
  height: 16px;
  border: 2px solid #adb5bd;
  border-radius: 50%;
  margin-right: 10px;
  position: relative;
  flex-shrink: 0;
}

.function-item.is-selected .radio-indicator {
  border-color: #42b883;
  background-color: #42b883;
  box-shadow: inset 0 0 0 3px #fff;
}

.no-functions {
  color: #999;
  font-style: italic;
  font-size: 0.9rem;
}

.placeholder {
  color: #999;
  text-align: center;
  margin-top: 2rem;
}

/* Context Menu Styles */
.context-menu {
  position: fixed;
  z-index: 1000;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 150px;
  overflow: hidden;
  font-size: 14px;
}

.context-menu .menu-header {
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
  font-weight: bold;
  color: #666;
  font-size: 12px;
}

.context-menu .menu-list {
  padding: 4px 0;
  max-height: 300px;
  overflow-y: auto;
}

.context-menu .menu-item {
  padding: 8px 12px;
  cursor: pointer;
  color: #333;
  transition: background-color 0.1s;
}

.context-menu .menu-item:hover {
  background-color: #f0f0f0;
}

.context-menu .menu-item.is-active {
  background-color: #e6f4ea;
  color: #42b883;
  font-weight: bold;
}

.context-menu .menu-item.disabled {
  color: #999;
  cursor: default;
  font-style: italic;
}

.context-menu .menu-item.disabled:hover {
  background-color: transparent;
}

.context-menu .menu-separator {
  height: 1px;
  background-color: #eee;
  margin: 4px 0;
}

.context-menu .menu-item.danger {
  color: #dc3545;
}

.context-menu .menu-item.danger:hover {
  background-color: #fff5f5;
}
</style>