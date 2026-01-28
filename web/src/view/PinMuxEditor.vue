<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useChipStore } from '@/stores/chipStore'
import ChipPackage from '@/components/ChipPackage.vue'
import type { RenderedPin } from '@/utils/packageLayout'
import { exportConfigurationToCSV } from '@/utils/exportUtils'

// 导入芯片数据 (Vite Glob Import) - Load from nested structure
const chipModules = import.meta.glob('@/assets/chips/**/*.json', { eager: true })
const allChips = Object.values(chipModules).map((mod: any) => mod.default || mod)

// Group chips by Vendor -> Family
const menuStructure = computed(() => {
  const struct: Record<string, Record<string, any[]>> = {}
  
  for (const chip of allChips) {
    const vendor = chip.meta.vendor || 'Unknown'
    const family = chip.meta.family || 'Unknown'
    
    if (!struct[vendor]) struct[vendor] = {}
    if (!struct[vendor][family]) struct[vendor][family] = []
    
    struct[vendor][family].push(chip)
  }
  return struct
})

const selectedVendor = ref('')
const selectedFamily = ref('')

const vendorOptions = computed(() => Object.keys(menuStructure.value).sort())

const familyOptions = computed(() => {
  const vendorData = menuStructure.value[selectedVendor.value]
  if (!selectedVendor.value || !vendorData) return []
  return Object.keys(vendorData).sort()
})

const chipOptions = computed(() => {
  if (!selectedVendor.value || !selectedFamily.value) return []
  const vendorData = menuStructure.value[selectedVendor.value]
  if (!vendorData) return []
  const chips = vendorData[selectedFamily.value] || []
  return chips.sort((a: any, b: any) => a.meta.name.localeCompare(b.meta.name))
})

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
  // 默认加载第一个可用的芯片
  if (vendorOptions.value.length > 0) {
    selectedVendor.value = vendorOptions.value[0] || ''
    
    const families = familyOptions.value
    if (families.length > 0) {
      selectedFamily.value = families[0] || ''
      
      const chips = chipOptions.value
      if (chips.length > 0) {
        console.log('Loading Default Chip...', chips[0])
        chipStore.loadChip(chips[0])
      }
    }
  }
  
  // Close context menu on global click
  window.addEventListener('click', () => {
    showContextMenu.value = false
  })
})

function onVendorChange() {
  // When vendor changes, select first family and its first chip
  const families = familyOptions.value
  if (families.length > 0) {
    selectedFamily.value = families[0] || ''
    onFamilyChange()
  } else {
    selectedFamily.value = ''
  }
}

function onFamilyChange() {
  // When family changes, select first chip
  const chips = chipOptions.value
  if (chips.length > 0) {
    chipStore.loadChip(chips[0])
    resetSelection()
  }
}

function onChipSelect(event: Event) {
  const select = event.target as HTMLSelectElement
  const chipName = select.value
  // Find chip in current vendor/family list
  const chipData = chipOptions.value.find((c: any) => c.meta.name === chipName)
  
  if (chipData) {
    chipStore.loadChip(chipData)
    resetSelection()
  }
}

function resetSelection() {
  selectedPin.value = null
  selectedPinFunctions.value = []
}


function onExportCSV() {
  if (!chipStore.currentChip) return
  exportConfigurationToCSV(chipStore.currentChip, chipStore.pinConfigurations)
}

function onClearConfig() {
  if (Object.keys(chipStore.pinConfigurations).length === 0) return
  if (confirm('Are you sure you want to clear all configurations?')) {
    chipStore.clearConfigurations()
  }
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

const isSelectedPinFixed = computed(() => {
  if (!selectedPin.value || !chipStore.currentChip) return false
  const pinCap = chipStore.currentChip.pins[selectedPin.value.name]
  return !!pinCap?.fixed
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
        <!-- Vendor Select -->
        <select class="chip-select vendor-select" v-model="selectedVendor" @change="onVendorChange">
           <option v-for="vendor in vendorOptions" :key="vendor" :value="vendor">
             {{ vendor }}
           </option>
        </select>

        <!-- Family Select -->
        <select class="chip-select family-select" v-model="selectedFamily" @change="onFamilyChange">
           <option v-for="family in familyOptions" :key="family" :value="family">
             {{ family }}
           </option>
        </select>

        <!-- Chip Select -->
        <select 
          class="chip-select" 
          :value="chipStore.currentChip?.meta.name"
          @change="onChipSelect"
        >
          <option v-for="chip in chipOptions" :key="chip.meta.name" :value="chip.meta.name">
            {{ chip.meta.name }} ({{ chip.meta.package }})
          </option>
        </select>

        <a 
          v-if="chipStore.currentChip?.meta.datasheet"
          :href="chipStore.currentChip?.meta.datasheet" 
          target="_blank" 
          class="chip-name-link"
          title="View Datasheet"
        >
          <span class="icon">📄</span> Datasheet
        </a>
      </div>
      <div class="actions">
        <button class="btn-secondary" @click="onClearConfig" :disabled="!chipStore.isLoaded || Object.keys(chipStore.pinConfigurations).length === 0" title="Clear all configurations">
          Clear
        </button>
        <button class="btn-primary" @click="onExportCSV" :disabled="!chipStore.isLoaded">
          Export CSV
        </button>
      </div>
    </header>

    <main>
      <div class="visualization-area">
        <ChipPackage 
          v-if="chipStore.isLoaded"
          :key="chipStore.currentChip?.meta.name"
          :package-info="chipStore.currentChip!.package"
          :chip-meta="chipStore.currentChip!.meta"
          :pin-configurations="chipStore.pinConfigurations"
          :pin-capabilities="chipStore.currentChip?.pins"
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
          
          <div v-if="isSelectedPinFixed">
             <h3>Fixed Function</h3>
             <div class="fixed-function-display">
                <span class="badge fixed">{{ selectedPinFunctions[0] || 'Unknown' }}</span>
                <p class="hint">This pin has a fixed function and cannot be remapped.</p>
             </div>
          </div>
          <div v-else>
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
        </div>
        <div v-else class="chip-details-sidebar">
          <div v-if="chipStore.currentChip" class="chip-meta-info">
             <h2>Chip Information</h2>
             <div class="meta-group">
                <div class="meta-item">
                   <span class="label">Name</span>
                   <span class="value highlight">{{ chipStore.currentChip.meta.name }}</span>
                </div>
                <div class="meta-item">
                   <span class="label">Vendor</span>
                   <span class="value">{{ chipStore.currentChip.meta.vendor }}</span>
                </div>
                <div class="meta-item">
                   <span class="label">Family</span>
                   <span class="value">{{ chipStore.currentChip.meta.family }}</span>
                </div>
                <div class="meta-item">
                   <span class="label">Core</span>
                   <span class="value">{{ chipStore.currentChip.meta.core }}</span>
                </div>
                <div class="meta-item">
                   <span class="label">Package</span>
                   <span class="value">{{ chipStore.currentChip.meta.package }}</span>
                </div>
             </div>
             
             <div class="datasheet-section" v-if="chipStore.currentChip.meta.datasheet">
                <a :href="chipStore.currentChip.meta.datasheet" target="_blank" class="datasheet-btn">
                  <span class="icon">📄</span> View Datasheet
                </a>
             </div>
          </div>
          <div v-else class="placeholder">
            Loading chip data...
          </div>
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
  margin-right: 20px;
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
  gap: 15px;
}

.chip-select {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  background-color: white;
  font-size: 14px;
  color: #606266;
  outline: none;
  cursor: pointer;
  min-width: 120px;
}

.chip-select:hover {
  border-color: #c0c4cc;
}

.chip-select:focus {
  border-color: #42b883;
}

.chip-name-link {
  color: #42b883;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
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

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
  margin-right: 10px;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.btn-secondary:disabled {
  background-color: #e2e6ea;
  color: #aeb5bc;
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

.badge.fixed {
  background-color: #e9ecef;
  color: #495057;
  font-size: 1rem;
  padding: 4px 12px;
  display: inline-block;
  margin-bottom: 10px;
}

.fixed-function-display {
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.hint {
  margin: 0;
  font-size: 0.9rem;
  color: #6c757d;
  font-style: italic;
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

.chip-meta-info {
  /* padding: 1rem; */ /* Sidebar already has padding */
}

.chip-meta-info h2 {
  font-size: 1.2rem;
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 0.5rem;
}

.meta-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f9f9f9;
  padding-bottom: 8px;
}

.meta-item .label {
  color: #666;
  font-size: 0.9rem;
}

.meta-item .value {
  font-weight: 500;
  color: #333;
}

.meta-item .value.highlight {
  color: #42b883;
  font-weight: bold;
}

.datasheet-section {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
}

.datasheet-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: #f8f9fa;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  color: #606266;
  text-decoration: none;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.datasheet-btn:hover {
  border-color: #42b883;
  color: #42b883;
  background-color: #e6f4ea;
}

.datasheet-btn .icon {
  font-size: 1.1rem;
}
</style>