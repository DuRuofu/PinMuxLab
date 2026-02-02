<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PeripheralDefinition } from '@/types/chip'
import { useChipStore } from '@/stores/chipStore'

const props = defineProps<{
  name: string
  definition: PeripheralDefinition
  initialCollapsed?: boolean
}>()

const chipStore = useChipStore()
const isCollapsed = ref(props.initialCollapsed ?? true)

// Logic for multiple pinmaps (Remap/Alternate Configurations)
const selectedMapIndex = ref(0)
const hasMultipleMaps = computed(() => props.definition.pinmaps && props.definition.pinmaps.length > 1)

// Watcher to handle Pinmap Switching (Clear previous configuration)
watch(selectedMapIndex, (newVal, oldVal) => {
  // 1. Identify pins from the PREVIOUS map (oldVal)
  if (!props.definition.pinmaps || props.definition.pinmaps.length <= oldVal) return

  const oldMap = props.definition.pinmaps[oldVal]
  if (!oldMap) return
  
  // 2. Iterate through signals in the old map
  for (const [signal, pin] of Object.entries(oldMap)) {
    // 3. Check if the pin is currently assigned to THIS peripheral/signal
    // We use isPinSelected logic: if the pin's current function matches what this signal expects
    if (isPinSelected(pin, signal, oldVal)) {
      // 4. Unassign the pin
      chipStore.setPinFunction(pin, '') // or setPinConfiguration(pin, null)
    }
  }
  
  // Note: The UI for the NEW map will be rendered reactively, starting with empty/clean state
  // because we just cleared the conflicting assignments from the old map.
})

// Initialize the selected map based on current assignments
function detectInitialMap() {
  if (!props.definition.pinmaps || props.definition.pinmaps.length <= 1) return
  
  let bestMapIndex = 0
  let maxMatches = -1
  
  props.definition.pinmaps.forEach((map, index) => {
    let matches = 0
    for (const [signal, pin] of Object.entries(map)) {
      if (isPinSelected(pin, signal, index)) {
        matches++
      }
    }
    // Prefer the map with the most currently active pins
    if (matches > maxMatches) {
      maxMatches = matches
      bestMapIndex = index
    }
  })
  
  selectedMapIndex.value = bestMapIndex
}

// Run detection once on setup (or whenever definition changes)
detectInitialMap()


function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

interface SignalOption {
  pinName: string
  schemeIndex: number
}

// Group data by signal
const signals = computed(() => {
  const map = new Map<string, SignalOption[]>()
  
  // Strict Mode: If multiple pinmaps exist, ONLY show signals from the selected map
  if (props.definition.pinmaps && props.definition.pinmaps.length > 0) {
    const activeMap = props.definition.pinmaps[selectedMapIndex.value]
    // If strict mode, we only use the active map
    // If there is only one map, it's index 0, so it works the same.
    
    if (activeMap) {
      for (const [signal, pin] of Object.entries(activeMap)) {
        if (!map.has(signal)) {
          map.set(signal, [])
        }
        map.get(signal)!.push({ pinName: pin, schemeIndex: selectedMapIndex.value })
      }
    }
  } else {
    // Fallback for flat signals definition
    for (const [signal, pins] of Object.entries(props.definition.signals)) {
       map.set(signal, pins.map((p, i) => ({ pinName: p, schemeIndex: i })))
    }
  }
  
  return Array.from(map.entries()).map(([name, options]) => ({
    name,
    options
  }))
})

function getTargetFunction(pinName: string, signal: string, mapIndex: number = selectedMapIndex.value): string | undefined {
  const functions = chipStore.getPinFunctions(pinName)
  const suffix = mapIndex === 0 ? '' : `_${mapIndex}`

  // Try exact signal name match (with suffix)
  const direct = `${signal}${suffix}`
  if (functions.includes(direct)) return direct

  // Try composite name match (Peripheral_Signal + suffix)
  const composite = `${props.name}_${signal}${suffix}`
  if (functions.includes(composite)) return composite
  
  return undefined
}

// Card Status Logic
const cardStatus = computed(() => {
  // Check if all signals are fully blocked (RED)
  const allBlocked = signals.value.length > 0 && signals.value.every(s => isSignalFullyOccupied(s))
  if (allBlocked) return 'error'

  // Check if configured (GREEN) - Prioritize explicit user selection
  const hasSelection = signals.value.some(s => {
    // Check if any option for this signal is currently selected
    return s.options.some(opt => isPinSelected(opt.pinName, s.name, opt.schemeIndex))
  })

  // Check for conflicts/constraints (YELLOW)
  // Warning if:
  // 1. Not blocked (already checked above)
  // 2. But some options are occupied by others
  const hasInterference = signals.value.some(s => {
    // If a signal has ANY option occupied by another peripheral, it's a conflict/warning
    return s.options.some(opt => isPinOccupied(opt.pinName, s.name, opt.schemeIndex))
  })

  // User Logic:
  // "No conflict pin AND Selected -> Green"
  // "If conflict pin -> Yellow"
  // "If all conflict -> Red"

  if (hasInterference) {
    // Even if selected, if there are conflicts (on other pins or this pin was forced?), show Yellow
    // Actually, isPinOccupied returns FALSE if WE selected it. 
    // So hasInterference only checks pins occupied by OTHERS.
    // If I selected PA9 (Clean), and PB6 (Alt) is occupied by I2C. -> hasInterference is TRUE. -> Yellow.
    return 'warning'
  }

  if (hasSelection) return 'success'
  
  return 'default'
})

const statusIcon = computed(() => {
  switch (cardStatus.value) {
    case 'error': return '✕' // Cross
    case 'warning': return '!' // Exclamation
    case 'success': return '✓' // Check
    default: return ''
  }
})

// Check if a specific pin is currently selected for this signal
function isPinSelected(pinName: string, signal: string, mapIndex: number = selectedMapIndex.value): boolean {
  const currentFunc = chipStore.getPinConfiguration(pinName)
  const targetFunc = getTargetFunction(pinName, signal, mapIndex)
  return currentFunc === targetFunc
}

// Check if any pin is selected for this signal (for dropdown value)
function getSelectedPinForSignal(signal: string, options: SignalOption[]): string {
  for (const opt of options) {
    if (isPinSelected(opt.pinName, signal, opt.schemeIndex)) return opt.pinName
  }
  return ''
}

// Check availability (occupied by others)
function isPinOccupied(pinName: string, signal: string, mapIndex: number = selectedMapIndex.value): boolean {
  const currentFunc = chipStore.getPinConfiguration(pinName)
  const targetFunc = getTargetFunction(pinName, signal, mapIndex)
  // Occupied if it has a function AND it is NOT the target function
  return !!currentFunc && currentFunc !== targetFunc
}

// Check if ALL options for a signal are occupied (conflict state)
function isSignalFullyOccupied(signal: { name: string, options: SignalOption[] }): boolean {
  if (signal.options.length === 0) return true
  return signal.options.every(opt => isPinOccupied(opt.pinName, signal.name, opt.schemeIndex))
}

function onCheckboxChange(signal: string, pinName: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    const targetFunc = getTargetFunction(pinName, signal)
    if (targetFunc) chipStore.setPinFunction(pinName, targetFunc)
  } else {
    chipStore.setPinFunction(pinName, '')
  }
}

function onSelectChange(signal: string, event: Event) {
  const newPin = (event.target as HTMLSelectElement).value
  
  // 1. Clear previous selection for this signal (if any)
  // We need to find if any other pin was selected for this signal and clear it
  // Actually, we can just clear all pins in the options list that were selected for this signal
  const options = signals.value.find(s => s.name === signal)?.options || []
  for (const opt of options) {
    if (isPinSelected(opt.pinName, signal) && opt.pinName !== newPin) {
      chipStore.setPinFunction(opt.pinName, '')
    }
  }

  // 2. Set new pin
  if (newPin) {
    const targetFunc = getTargetFunction(newPin, signal)
    if (targetFunc) chipStore.setPinFunction(newPin, targetFunc)
  }
}

// Check if all available signals (that CAN be selected) are currently selected
const isAllSelected = computed(() => {
  if (signals.value.length === 0) return false
  
  return signals.value.every(signal => {
    // 1. Is it currently selected?
    const currentPin = getSelectedPinForSignal(signal.name, signal.options)
    if (currentPin) return true
    
    // 2. If not selected, does it have any valid option?
    // If it has NO valid options (all occupied), we consider it "as satisfied as possible"
    // so it doesn't block the "All Selected" state.
    const hasAvailableOption = signal.options.some(opt => !isPinOccupied(opt.pinName, signal.name))
    
    // If it has available options but is not selected -> NOT all selected
    if (hasAvailableOption) return false
    
    // If no available options -> Ignored (count as selected/satisfied)
    return true
  })
})

function onHeaderCheckboxChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  
  if (checked) {
    // Select All Available
    signals.value.forEach(signal => {
      // Check if already selected
      const currentPin = getSelectedPinForSignal(signal.name, signal.options)
      if (currentPin) return // Already configured
      
      // Find candidate (first non-occupied option)
      const candidate = signal.options.find(opt => !isPinOccupied(opt.pinName, signal.name))
      
      // If we have a candidate, select it
      if (candidate) {
        const targetFunc = getTargetFunction(candidate.pinName, signal.name)
        if (targetFunc) {
          chipStore.setPinFunction(candidate.pinName, targetFunc)
        }
      }
    })
  } else {
    // Deselect All
    signals.value.forEach(signal => {
      const currentPin = getSelectedPinForSignal(signal.name, signal.options)
      if (currentPin) {
        chipStore.setPinFunction(currentPin, '')
      }
    })
  }
}

function handleRowClick(signal: any) {
  // 1. If a pin is currently configured/selected for this signal, show it
  const currentPin = getSelectedPinForSignal(signal.name, signal.options)
  if (currentPin) {
    chipStore.setSelectedPin(currentPin)
    return
  }

  // 2. If only one option exists, show it (even if not configured)
  if (signal.options.length === 1 && signal.options[0]) {
    chipStore.setSelectedPin(signal.options[0].pinName)
  }
}
</script>

<template>
  <div class="peripheral-card">
    <div class="card-header" @click="toggleCollapse" :class="`status-${cardStatus}`">
      <div class="header-title">
        <span class="periph-name">{{ name }} Pin Config</span>
        <span class="status-icon" v-if="statusIcon">{{ statusIcon }}</span>
      </div>
      <div class="header-controls">
        <input 
          type="checkbox" 
          :checked="isAllSelected" 
          @click.stop 
          @change="onHeaderCheckboxChange"
          title="Select All Available"
        />
        <span class="collapse-icon">{{ isCollapsed ? '▼' : '▲' }}</span>
      </div>
    </div>
    
    <div v-if="!isCollapsed" class="card-content">
      <!-- Pin Map Selector -->
      <div v-if="hasMultipleMaps" class="map-selector">
        <span class="map-selector-label">Configuration:</span>
        <div class="map-options">
          <label 
            v-for="(map, index) in definition.pinmaps" 
            :key="index" 
            class="map-option-btn"
            :class="{ active: selectedMapIndex === index }"
          >
            <input 
              type="radio" 
              :name="`map-${name}`" 
              :value="index" 
              v-model="selectedMapIndex"
              class="hidden-radio"
            >
            {{ index === 0 ? 'Default' : `${index}` }}
          </label>
        </div>
      </div>

      <div class="signals-list">
        <div 
          v-for="signal in signals" 
          :key="signal.name" 
          class="signal-row"
          :class="{ 'conflict-row': isSignalFullyOccupied(signal) }"
          @click="handleRowClick(signal)"
        >
          <div class="signal-label">{{ signal.name }}</div>
          
          <!-- Case 1: Single Option (Checkbox) -->
          <div v-if="signal.options.length === 1 && signal.options[0]" class="control-single">
            <span class="pin-name">
              {{ signal.options[0].pinName }}
            </span>
            <input 
              type="checkbox" 
              :checked="isPinSelected(signal.options[0].pinName, signal.name)"
              :disabled="isPinOccupied(signal.options[0].pinName, signal.name)"
              @change="onCheckboxChange(signal.name, signal.options[0].pinName, $event)"
              @click.stop
            />
          </div>

          <!-- Case 2: Multiple Options (Dropdown) -->
          <div v-else class="control-multi">
            <select 
              :value="getSelectedPinForSignal(signal.name, signal.options)"
              @change="onSelectChange(signal.name, $event)"
              @click.stop
              :class="{ 'occupied-bg': getSelectedPinForSignal(signal.name, signal.options) && isPinOccupied(getSelectedPinForSignal(signal.name, signal.options), signal.name) }"
            >
            <option value="">Not Selected</option>
            <option 
              v-for="opt in signal.options" 
              :key="opt.pinName" 
              :value="opt.pinName"
              :disabled="isPinOccupied(opt.pinName, signal.name)"
              :class="{ 'occupied-option': isPinOccupied(opt.pinName, signal.name) }"
            >
              {{ opt.pinName }} {{ isPinOccupied(opt.pinName, signal.name) ? '(Occupied)' : '' }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.peripheral-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0;
  overflow: hidden;
}

.card-header {
  background-color: var(--bg-tertiary);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-icon {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.periph-name {
  font-weight: 600;
  font-size: 0.85rem;
  /* color inherited from parent/status class */
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.map-selector {
  padding: 8px 12px;
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.map-selector-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.map-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.map-option-btn {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s;
}

.map-option-btn:hover {
  background: var(--hover-bg);
}

.map-option-btn.active {
  background: #2196F3;
  color: white;
  border-color: #2196F3;
}

.hidden-radio {
  display: none;
}


.occupied-bg {
  background-color: #ffebee; /* Light red background */
  padding: 2px 4px;
  border-radius: 4px;
  color: #c62828; /* Darker red text for contrast */
}

/* For dark mode compatibility, we might need to adjust this, but let's stick to the requested "light red" */
:global(body.dark-mode) .occupied-bg {
  background-color: #3e2723; /* Darker red background for dark mode */
  color: #ffcdd2; /* Lighter red text for dark mode */
}

.occupied-option {
  background-color: #ffebee;
  color: #c62828;
}

:global(body.dark-mode) .occupied-option {
  background-color: #3e2723;
  color: #ffcdd2;
}

.signals-list {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.signal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.1s;
}

.signal-row:hover {
  background-color: var(--hover-bg);
}

.signal-label {
  font-weight: 500;
  color: var(--text-secondary);
}

.conflict-row .signal-label,
.conflict-row .pin-name {
  color: inherit;
}

.control-single {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pin-name {
  color: var(--text-primary);
  font-family: monospace;
}

.control-multi select {
  padding: 2px 4px;
  font-size: 0.8rem;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
  border-radius: 3px;
  max-width: 120px;
}
</style>