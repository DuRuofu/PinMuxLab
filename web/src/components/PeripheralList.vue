<script setup lang="ts">
import { computed } from 'vue'
import { useChipStore } from '@/stores/chipStore'
import PeripheralCard from './PeripheralCard.vue'

const chipStore = useChipStore()

// Use direct list to preserve JSON order
const peripheralList = computed(() => {
  if (!chipStore.currentChip || !chipStore.currentChip.peripherals) return []
  
  return Object.entries(chipStore.currentChip.peripherals).map(([name, def]) => ({
    name,
    def
  }))
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
      <div v-else class="cards-container">
        <PeripheralCard 
          v-for="item in peripheralList" 
          :key="item.name"
          :name="item.name"
          :definition="item.def"
        />
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
  overflow: hidden; /* Ensure container doesn't scroll */
}

.list-header {
  padding: 12px 16px;
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0; /* Prevent header from shrinking */
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
  flex: 1; /* Take remaining height */
}

.cards-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: var(--text-tertiary);
}
</style>