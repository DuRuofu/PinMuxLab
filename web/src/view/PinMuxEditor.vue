<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useChipStore } from '@/stores/chipStore'
import ChipPackage from '@/components/ChipPackage.vue'
import PeripheralList from '@/components/PeripheralList.vue'
import IconSun from '@/components/icons/IconSun.vue'
import IconMoon from '@/components/icons/IconMoon.vue'
import type { RenderedPin } from '@/utils/packageLayout'
import { exportConfigurationToCSV } from '@/utils/exportUtils'

// --- 芯片数据懒加载 ---

// 动态导入：每个 value 是 () => Promise<module>
const chipModules = import.meta.glob('@/assets/chips/**/*.json')

// 完整芯片数据缓存：path -> full JSON
const chipDataCache = new Map<string, any>()

// 菜单条目（仅元数据）
interface ChipEntry { path: string; vendor: string; family: string; name: string; package: string }

const allChipEntries = ref<ChipEntry[]>([])
const isLoadingChips = ref(true)

// 异步加载所有芯片元数据，构建菜单
async function loadAllChipEntries() {
  const entries: ChipEntry[] = []
  // 并行加载所有 JSON 文件（每个是独立 chunk）
  await Promise.all(Object.entries(chipModules).map(async ([path, loader]) => {
    try {
      const mod: any = await loader()
      const data = mod.default || mod
      chipDataCache.set(path, data)
      entries.push({
        path,
        vendor: data.meta?.vendor || 'Unknown',
        family: data.meta?.family || 'Unknown',
        name: data.meta?.name || path,
        package: data.meta?.package || 'Unknown',
      })
    } catch (e) {
      console.error(`Failed to load chip: ${path}`, e)
    }
  }))
  allChipEntries.value = entries
  isLoadingChips.value = false
}

// 根据菜单条目获取完整数据
function getChipData(entry: ChipEntry) {
  return chipDataCache.get(entry.path)
}

// 按 Vendor -> Family 分组
const menuStructure = computed(() => {
  const struct: Record<string, Record<string, ChipEntry[]>> = {}
  for (const entry of allChipEntries.value) {
    if (!struct[entry.vendor]) struct[entry.vendor] = {}
    if (!struct[entry.vendor][entry.family]) struct[entry.vendor][entry.family] = []
    struct[entry.vendor][entry.family].push(entry)
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
  return chips.sort((a, b) => a.name.localeCompare(b.name))
})

const chipStore = useChipStore()

// Selected Pin Logic (Linked to Store)
const selectedPin = computed(() => {
  if (!chipStore.selectedPinName || !chipStore.currentChip) return null
  // Find physical pin data
  const pin = chipStore.currentChip.package.pins.find(p => p.name === chipStore.selectedPinName)
  return pin || null
})

const selectedPinFunctions = computed(() => {
  if (!chipStore.selectedPinName) return []
  return chipStore.getPinFunctions(chipStore.selectedPinName)
})

// Context Menu State
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuPin = ref<RenderedPin | null>(null)
const contextMenuFunctions = ref<string[]>([])

// Dark Mode
const isDarkMode = ref(false)

function toggleDarkMode() {
  isDarkMode.value = !isDarkMode.value
  updateTheme()
}

function updateTheme() {
  if (isDarkMode.value) {
    document.body.classList.add('dark-mode')
    localStorage.setItem('theme', 'dark')
  } else {
    document.body.classList.remove('dark-mode')
    localStorage.setItem('theme', 'light')
  }
}

onMounted(async () => {
  // Initialize Theme
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDarkMode.value = true
  }
  updateTheme()

  // 异步加载所有芯片元数据
  await loadAllChipEntries()

  // 尝试恢复上次选择的芯片
  const lastSelection = localStorage.getItem('pinmux_last_selection')
  let loaded = false

  if (lastSelection) {
    try {
      const { vendor, family, chipName } = JSON.parse(lastSelection)
      if (vendor && family && chipName && menuStructure.value[vendor]?.[family]) {
        const entries = menuStructure.value[vendor][family]
        const entry = entries.find((e) => e.name === chipName)

        if (entry) {
          const chipData = getChipData(entry)
          if (chipData) {
            console.log('Restoring Last Chip...', chipData)
            selectedVendor.value = vendor
            selectedFamily.value = family
            chipStore.loadChip(chipData)
            loaded = true
          }
        }
      }
    } catch (e) {
      console.error('Failed to restore last selection', e)
    }
  }

  // 如果没有恢复成功，则加载默认第一个可用的芯片
  if (!loaded && vendorOptions.value.length > 0) {
    selectedVendor.value = vendorOptions.value[0] || ''

    const families = familyOptions.value
    if (families.length > 0) {
      selectedFamily.value = families[0] || ''

      const entries = chipOptions.value
      if (entries.length > 0) {
        const chipData = getChipData(entries[0])
        if (chipData) {
          console.log('Loading Default Chip...', chipData)
          chipStore.loadChip(chipData)
        }
      }
    }
  }

  // Close context menu on global click
  window.addEventListener('click', () => {
    showContextMenu.value = false
  })
})

// 监听当前芯片变化，保存到 localStorage
watch(() => chipStore.currentChip, (newChip) => {
  if (newChip) {
    localStorage.setItem('pinmux_last_selection', JSON.stringify({
      vendor: newChip.meta.vendor,
      family: newChip.meta.family,
      chipName: newChip.meta.name
    }))
    
    // 同步更新下拉框选中状态 (以防芯片是从非下拉框途径加载的)
    if (selectedVendor.value !== newChip.meta.vendor) {
      selectedVendor.value = newChip.meta.vendor
    }
    if (selectedFamily.value !== newChip.meta.family) {
      selectedFamily.value = newChip.meta.family
    }
  }
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
  const entries = chipOptions.value
  if (entries.length > 0) {
    const chipData = getChipData(entries[0])
    if (chipData) {
      chipStore.loadChip(chipData)
      resetSelection()
    }
  }
}

function onChipSelect(event: Event) {
  const select = event.target as HTMLSelectElement
  const chipName = select.value
  const entry = chipOptions.value.find((e) => e.name === chipName)

  if (entry) {
    const chipData = getChipData(entry)
    if (chipData) {
      chipStore.loadChip(chipData)
      resetSelection()
    }
  }
}

function resetSelection() {
  chipStore.setSelectedPin(null)
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
  chipStore.setSelectedPin(pin.name)
  // Hide context menu if open
  showContextMenu.value = false
}

function onCanvasClick() {
  chipStore.setSelectedPin(null)
  showContextMenu.value = false
}

function handlePinContextMenu(pin: RenderedPin, event: MouseEvent) {
  console.log('Pin Right Clicked:', pin)
  // 同时也选中该引脚，方便侧边栏同步显示
  chipStore.setSelectedPin(pin.name)
  
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
          <option v-for="chip in chipOptions" :key="chip.name" :value="chip.name">
            {{ chip.name }} ({{ chip.package }})
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
        <button class="btn-icon" @click="toggleDarkMode" :title="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
          <!-- Sun Icon (for Dark Mode -> Switch to Light) -->
          <IconSun v-if="isDarkMode" />
          <!-- Moon Icon (for Light Mode -> Switch to Dark) -->
          <IconMoon v-else />
        </button>
        <button class="btn-secondary" @click="onClearConfig" :disabled="!chipStore.isLoaded || Object.keys(chipStore.pinConfigurations).length === 0" title="Clear all configurations">
          Clear
        </button>
        <button class="btn-primary" @click="onExportCSV" :disabled="!chipStore.isLoaded">
          Export CSV
        </button>
      </div>
    </header>

    <main>
      <aside class="sidebar left-sidebar">
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
                <div class="meta-item" v-if="chipStore.currentChip.meta.flash">
                   <span class="label">Flash</span>
                   <span class="value">{{ chipStore.currentChip.meta.flash }}</span>
                </div>
                <div class="meta-item" v-if="chipStore.currentChip.meta.sram">
                   <span class="label">SRAM</span>
                   <span class="value">{{ chipStore.currentChip.meta.sram }}</span>
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

      <div class="visualization-area">
        <div v-if="chipStore.isLoaded" class="usage-stats">
          {{ chipStore.usageStats.occupied }} / {{ chipStore.usageStats.total }}
        </div>
        <ChipPackage 
          v-if="chipStore.isLoaded"
          :key="chipStore.currentChip?.meta.name"
          :package-info="chipStore.currentChip!.package"
          :chip-meta="chipStore.currentChip!.meta"
          :pin-configurations="chipStore.pinConfigurations"
          :pin-capabilities="chipStore.currentChip?.pins"
          @pin-click="onPinClick"
          @pin-contextmenu="handlePinContextMenu"
          @canvas-click="onCanvasClick"
        />
        <div v-else class="loading">Loading...</div>
      </div>

      <aside class="sidebar right-sidebar">
        <PeripheralList />
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
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
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
  color: var(--text-primary);
}

.chip-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.chip-select {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--input-border);
  background-color: var(--input-bg);
  font-size: 14px;
  color: var(--text-secondary);
  outline: none;
  cursor: pointer;
  min-width: 120px;
}

.chip-select:hover {
  border-color: var(--input-hover);
}

.chip-select:focus {
  border-color: var(--primary-color);
}

.chip-name-link {
  color: var(--primary-color);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.chip-name-link:hover {
  text-decoration: underline;
  color: var(--primary-hover);
}

.chip-name-link .icon {
  font-size: 0.8em;
}

.actions {
  margin-left: auto;
  padding-left: 20px;
  display: flex;
  align-items: center;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: var(--primary-hover);
}

.btn-primary:disabled {
  background-color: var(--primary-disabled);
  cursor: not-allowed;
}

.btn-secondary {
  background-color: var(--secondary-btn-bg);
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
  background-color: var(--secondary-btn-hover);
}

.btn-secondary:disabled {
  background-color: var(--secondary-btn-disabled);
  color: var(--secondary-btn-text-disabled);
  cursor: not-allowed;
}

.btn-icon {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin-right: 10px;
}

.btn-icon:hover {
  background-color: var(--hover-bg);
  color: var(--text-primary);
}

main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.visualization-area {
  flex: 1;
  background-color: var(--bg-primary);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.loading {
  color: var(--text-secondary);
}

.usage-stats {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: var(--bg-tertiary);
  padding: 6px 12px;
  border-radius: 6px;
  font-family: monospace;
  font-weight: 600;
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sidebar {
  /* width: 300px; - Removed fixed width for base class */
  background-color: var(--bg-secondary);
  padding: 1rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.left-sidebar {
  width: 250px; /* Narrower left sidebar */
  border-right: 1px solid var(--border-color);
}

.right-sidebar {
  width: 350px; /* Wider right sidebar */
  border-left: 1px solid var(--border-color);
  padding: 0; /* PeripheralList has its own padding */
  overflow-y: hidden;
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
  color: var(--text-primary);
}

.badge {
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: normal;
}

.badge.fixed {
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 1rem;
  padding: 4px 12px;
  display: inline-block;
  margin-bottom: 10px;
}

.fixed-function-display {
  padding: 10px;
  background-color: var(--bg-secondary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.hint {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-style: italic;
}

.pin-meta {
  color: var(--text-secondary);
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
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary);
}

.function-item:hover {
  background-color: var(--hover-bg);
  border-color: var(--input-hover);
}

.function-item.is-selected {
  background-color: var(--active-bg);
  border-color: var(--primary-color);
  color: var(--text-primary);
  font-weight: bold;
}

.radio-indicator {
  width: 16px;
  height: 16px;
  border: 2px solid var(--input-hover);
  border-radius: 50%;
  margin-right: 10px;
  position: relative;
  flex-shrink: 0;
}

.function-item.is-selected .radio-indicator {
  border-color: var(--primary-color);
  background-color: var(--primary-color);
  box-shadow: inset 0 0 0 3px #fff;
}

.no-functions {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.9rem;
}

.placeholder {
  color: var(--text-secondary);
  text-align: center;
  margin-top: 2rem;
}

/* Context Menu Styles */
.context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 150px;
  overflow: hidden;
  font-size: 14px;
}

.context-menu .menu-header {
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-weight: bold;
  color: var(--text-secondary);
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
  color: var(--text-primary);
  transition: background-color 0.1s;
}

.context-menu .menu-item:hover {
  background-color: var(--hover-bg);
}

.context-menu .menu-item.is-active {
  background-color: var(--active-bg);
  color: var(--primary-color);
  font-weight: bold;
}

.context-menu .menu-item.disabled {
  color: var(--text-secondary);
  cursor: default;
  font-style: italic;
}

.context-menu .menu-item.disabled:hover {
  background-color: transparent;
}

.context-menu .menu-separator {
  height: 1px;
  background-color: var(--border-color);
  margin: 4px 0;
}

.context-menu .menu-item.danger {
  color: var(--danger-color);
}

.context-menu .menu-item.danger:hover {
  background-color: var(--danger-bg-hover);
}

.chip-meta-info {
  /* padding: 1rem; */ /* Sidebar already has padding */
}

.chip-meta-info h2 {
  font-size: 1.2rem;
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-color);
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
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.meta-item .label {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.meta-item .value {
  font-weight: 500;
  color: var(--text-primary);
}

.meta-item .value.highlight {
  color: var(--primary-color);
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
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.datasheet-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background-color: var(--active-bg);
}

.datasheet-btn .icon {
  font-size: 1.1rem;
}
</style>