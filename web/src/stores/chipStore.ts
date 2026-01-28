import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChipDefinition, PinCapability } from '@/types/chip'

export const useChipStore = defineStore('chip', () => {
  // State
  const currentChip = ref<ChipDefinition | null>(null)
  const isLoaded = computed(() => !!currentChip.value)

  // Actions
  function loadChip(data: ChipDefinition) {
    currentChip.value = data
  }

  /**
   * 根据引脚名称获取引脚能力定义
   * @param pinName 引脚名称 (如 "PA1")
   */
  function getPinFunctions(pinName: string): string[] {
    if (!currentChip.value) return []
    const pin = currentChip.value.pins[pinName]
    return pin ? pin.functions : []
  }

  /**
   * 获取引脚的类型（gpio/power/reset等）
   */
  function getPinType(pinName: string): string {
    if (!currentChip.value) return 'unknown'
    const pin = currentChip.value.pins[pinName]
    return pin ? pin.type : 'unknown'
  }

  /**
   * 获取物理引脚信息（编号和名称）
   */
  const physicalPins = computed(() => {
    if (!currentChip.value) return []
    return currentChip.value.package.pins
  })

  return {
    currentChip,
    isLoaded,
    physicalPins,
    loadChip,
    getPinFunctions,
    getPinType
  }
})
