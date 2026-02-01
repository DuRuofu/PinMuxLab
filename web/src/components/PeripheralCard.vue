<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PeripheralDefinition } from '@/types/chip'
import { useChipStore } from '@/stores/chipStore'

const props = defineProps<{
  name: string
  definition: PeripheralDefinition
}>()

const chipStore = useChipStore()
const isCollapsed = ref(true)

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
  
  if (props.definition.pinmaps && props.definition.pinmaps.length > 0) {
    props.definition.pinmaps.forEach((pinmap, index) => {
      for (const [signal, pin] of Object.entries(pinmap)) {
        if (!map.has(signal)) {
          map.set(signal, [])
        }
        // Avoid duplicates if multiple schemes use same pin for same signal?
        // Usually schemes are distinct, but let's check.
        // Actually, for dropdown we want distinct options.
        const existing = map.get(signal)!
        if (!existing.some(opt => opt.pinName === pin)) {
           existing.push({ pinName: pin, schemeIndex: index })
        }
      }
    })
  } else {
    // Fallback if no pinmaps (should not happen with new logic but for safety)
    for (const [signal, pins] of Object.entries(props.definition.signals)) {
       map.set(signal, pins.map((p, i) => ({ pinName: p, schemeIndex: i })))
    }
  }
  
  return Array.from(map.entries()).map(([name, options]) => ({
    name,
    options
  }))
})

function getTargetFunction(pinName: string, signal: string): string | undefined {
  const functions = chipStore.getPinFunctions(pinName)
  if (functions.includes(signal)) return signal
  const composite = `${props.name}_${signal}`
  if (functions.includes(composite)) return composite
  return undefined
}

// Check if a specific pin is currently selected for this signal
function isPinSelected(pinName: string, signal: string): boolean {
  const currentFunc = chipStore.getPinConfiguration(pinName)
  const targetFunc = getTargetFunction(pinName, signal)
  return currentFunc === targetFunc
}

// Check if any pin is selected for this signal (for dropdown value)
function getSelectedPinForSignal(signal: string, options: SignalOption[]): string {
  for (const opt of options) {
    if (isPinSelected(opt.pinName, signal)) return opt.pinName
  }
  return ''
}

// Check availability (occupied by others)
function isPinOccupied(pinName: string, signal: string): boolean {
  const currentFunc = chipStore.getPinConfiguration(pinName)
  const targetFunc = getTargetFunction(pinName, signal)
  // Occupied if it has a function AND it is NOT the target function
  return !!currentFunc && currentFunc !== targetFunc
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
</script>

<template>
  <div class="peripheral-card">
    <div class="card-header" @click="toggleCollapse">
      <span class="periph-name">{{ name }} Pin Config</span>
      <span class="collapse-icon">{{ isCollapsed ? '▼' : '▲' }}</span>
    </div>
    
    <div v-if="!isCollapsed" class="signals-list">
      <div v-for="signal in signals" :key="signal.name" class="signal-row">
        <div class="signal-label">{{ signal.name }}</div>
        
        <!-- Case 1: Single Option (Checkbox) -->
        <div v-if="signal.options.length === 1 && signal.options[0]" class="control-single">
          <span 
            class="pin-name" 
            :class="{ 'occupied-bg': isPinOccupied(signal.options[0].pinName, signal.name) }"
          >
            {{ signal.options[0].pinName }}
          </span>
          <input 
            type="checkbox" 
            :checked="isPinSelected(signal.options[0].pinName, signal.name)"
            :disabled="isPinOccupied(signal.options[0].pinName, signal.name)"
            @change="onCheckboxChange(signal.name, signal.options[0].pinName, $event)"
          />
        </div>

        <!-- Case 2: Multiple Options (Dropdown) -->
        <div v-else class="control-multi">
          <select 
            :value="getSelectedPinForSignal(signal.name, signal.options)"
            @change="onSelectChange(signal.name, $event)"
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
}

.collapse-icon {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.periph-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-primary);
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
}

.signal-label {
  font-weight: 500;
  color: var(--text-secondary);
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