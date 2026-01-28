<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useChipStore } from '@/stores/chipStore'
import ChipPackage from '@/components/ChipPackage.vue'
import type { RenderedPin } from '@/utils/packageLayout'

// 导入示例数据
import ch32v003Data from '@/assets/WCH_CH32V003F4U6_QFN20.json'

const chipStore = useChipStore()
const selectedPin = ref<RenderedPin | null>(null)
const selectedPinFunctions = ref<string[]>([])

onMounted(() => {
  // 模拟从文件/API 加载
  console.log('Loading Chip Data...', ch32v003Data)
  chipStore.loadChip(ch32v003Data as any)
})

function onPinClick(pin: RenderedPin) {
  console.log('Pin Clicked:', pin)
  selectedPin.value = pin
  selectedPinFunctions.value = chipStore.getPinFunctions(pin.name)
}
</script>

<template>
  <div class="app-container">
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
    </header>

    <main>
      <div class="visualization-area">
        <ChipPackage 
          v-if="chipStore.isLoaded"
          :package-info="chipStore.currentChip!.package"
          :chip-meta="chipStore.currentChip!.meta"
          @pin-click="onPinClick"
        />
        <div v-else class="loading">Loading...</div>
      </div>

      <aside class="sidebar">
        <div v-if="selectedPin" class="pin-details">
          <h2>{{ selectedPin.name }}</h2>
          <p>Pin No: {{ selectedPin.number }}</p>
          <p>Type: {{ chipStore.getPinType(selectedPin.name) }}</p>
          
          <h3>Available Functions:</h3>
          <ul>
            <li v-for="func in selectedPinFunctions" :key="func">
              {{ func }}
            </li>
          </ul>
        </div>
        <div v-else class="placeholder">
          Click a pin to view details
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
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
  overflow: auto;
}

.sidebar {
  width: 300px;
  background-color: #f8f9fa;
  border-left: 1px solid #e9ecef;
  padding: 1rem;
  overflow-y: auto;
}

.pin-details h2 {
  margin-top: 0;
  color: #42b883;
}

.placeholder {
  color: #999;
  text-align: center;
  margin-top: 2rem;
}

ul {
  padding-left: 1.2rem;
}
</style>

