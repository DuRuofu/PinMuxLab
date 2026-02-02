<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChipStore } from '@/stores/chipStore'
import PeripheralCard from './PeripheralCard.vue'
import type { PeripheralDefinition } from '@/types/chip'

const chipStore = useChipStore()

// State for toggling groups - default to collapsed (track expanded)
const expandedGroups = ref<Record<string, boolean>>({})

function toggleGroup(groupName: string) {
  expandedGroups.value[groupName] = !expandedGroups.value[groupName]
}

function isGroupCollapsed(groupName: string) {
  return !expandedGroups.value[groupName]
}

interface PeripheralGroup {
  name: string
  description?: string
  items: {
    name: string
    def: PeripheralDefinition
  }[]
}

// Group peripherals by their 'group' property
const peripheralGroups = computed(() => {
  if (!chipStore.currentChip || !chipStore.currentChip.peripherals) return []

  const groups: Record<string, PeripheralGroup> = {}
  
  // Use a Map to preserve insertion order of groups as they appear in the source
  // However, Object.entries might not guarantee order, but typically it follows insertion for string keys
  
  Object.entries(chipStore.currentChip.peripherals).forEach(([name, def]) => {
    // Check if peripheral has ANY valid pins on this chip package
    // 1. Collect all pins referenced by this peripheral
    const referencedPins = new Set<string>()
    if (def.pinmaps && def.pinmaps.length > 0) {
      def.pinmaps.forEach(map => {
        Object.values(map).forEach(pin => referencedPins.add(pin))
      })
    } else {
      // Fallback for signals
      Object.values(def.signals).forEach(pins => {
        pins.forEach(pin => referencedPins.add(pin))
      })
    }
    
    // 2. Check if ANY of these pins exist in the physical package
    const physicalPins = chipStore.physicalPins
    const hasAnyValidPin = Array.from(referencedPins).some(pinName => 
      physicalPins.some(p => p.name === pinName)
    )
    
    // If no pins exist at all, skip this peripheral
    if (!hasAnyValidPin) return

    // If no group is defined (old format), treat it as 'Other' or use its type
    // But inferencer now adds 'group'. If missing, use 'Other'.
    const groupName = def.group || 'Other'
    
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        description: def.description,
        items: []
      }
    }
    
    groups[groupName].items.push({ name, def })
  })
  
  return Object.values(groups)
})
</script>

<template>
  <div class="peripheral-list-container">
    <div class="list-header">
      <h3>Peripheral Pin Configuration</h3>
    </div>
    <div class="peripheral-list">
      <div v-if="!chipStore.currentChip" class="empty-state">
        No chip loaded
      </div>
      <div v-else class="groups-container">
        <div 
          v-for="group in peripheralGroups" 
          :key="group.name" 
          class="peripheral-group"
        >
          <!-- Group Header -->
          <div class="group-header" @click="toggleGroup(group.name)">
            <div class="group-title">
              <span class="group-name">{{ group.name }}</span>
              <span class="group-count">({{ group.items.length }})</span>
            </div>
            <span class="collapse-icon">{{ isGroupCollapsed(group.name) ? '▼' : '▲' }}</span>
          </div>
          
          <!-- Group Content -->
          <div v-if="!isGroupCollapsed(group.name)" class="group-content">
            <PeripheralCard 
              v-for="item in group.items" 
              :key="item.name"
              :name="item.name"
              :definition="item.def"
              :initial-collapsed="group.items.length > 1"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.peripheral-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-secondary);
  overflow: hidden;
}

.list-header {
  padding: 12px 16px;
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.list-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.peripheral-list {
  padding: 10px;
  overflow-y: auto;
  flex: 1;
}

.groups-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.peripheral-group {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-primary);
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-tertiary);
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid transparent;
}

.peripheral-group:has(.group-content) .group-header {
  border-bottom-color: var(--border-color);
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.group-count {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.collapse-icon {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.group-content {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--bg-secondary);
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: var(--text-tertiary);
}
</style>