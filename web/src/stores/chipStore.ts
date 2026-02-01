import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChipDefinition, PinCapability } from '@/types/chip'
import { inferChipData } from '@/utils/chipInferencer'

export const useChipStore = defineStore('chip', () => {
  // State
  const currentChip = ref<ChipDefinition | null>(null)
  const pinConfigurations = ref<Record<string, string>>({}) // Key: PinName, Value: SelectedFunction
  const isLoaded = computed(() => !!currentChip.value)

  // Actions
  function loadChip(rawData: any) {
    const data = inferChipData(rawData)
    currentChip.value = data
    // 尝试从 localStorage 加载配置
    const storageKey = `pinmux_config_${data.meta.name}`
    const savedConfig = localStorage.getItem(storageKey)
    if (savedConfig) {
      try {
        pinConfigurations.value = JSON.parse(savedConfig)
      } catch (e) {
        console.error('Failed to parse saved configuration', e)
        pinConfigurations.value = {}
      }
    } else {
      pinConfigurations.value = {} // 重置配置
    }
  }

  function saveConfigurations() {
    if (!currentChip.value) return
    const storageKey = `pinmux_config_${currentChip.value.meta.name}`
    localStorage.setItem(storageKey, JSON.stringify(pinConfigurations.value))
  }

  function clearConfigurations() {
    pinConfigurations.value = {}
    if (currentChip.value) {
      const storageKey = `pinmux_config_${currentChip.value.meta.name}`
      localStorage.removeItem(storageKey)
    }
  }

  function setPinFunction(pinName: string, func: string) {
    if (!currentChip.value) return
    
    // 如果选择的是默认功能或空，则移除配置
    if (!func) {
      const { [pinName]: _, ...rest } = pinConfigurations.value
      pinConfigurations.value = rest
    } else {
      // 检查该引脚是否支持该功能
      const supported = getPinFunctions(pinName)
      if (supported.includes(func)) {
        pinConfigurations.value = {
          ...pinConfigurations.value,
          [pinName]: func
        }
      }
    }
    // 保存到 localStorage
    saveConfigurations()
  }

  function getPinConfiguration(pinName: string): string | undefined {
    return pinConfigurations.value[pinName]
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
   * 获取引脚占用统计
   */
  const usageStats = computed(() => {
    if (!currentChip.value) return { occupied: 0, total: 0 }
    
    const allPins = currentChip.value.package.pins
    const total = allPins.length
    let occupied = 0
    
    for (const pin of allPins) {
      const pinCap = currentChip.value.pins[pin.name]
      if (!pinCap) continue // Should not happen
      
      // 1. 固定功能的引脚（如电源、地、复位等）默认视为占用
      if (pinCap.fixed) {
        occupied++
        continue
      }
      
      // 2. 被用户配置了功能的引脚
      // 注意：getPinConfiguration 返回 undefined 表示未配置
      if (pinConfigurations.value[pin.name]) {
        occupied++
      }
    }
    
    return { occupied, total }
  })

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
    pinConfigurations,
    loadChip,
    setPinFunction,
    getPinConfiguration,
    getPinFunctions,
    getPinType,
    clearConfigurations,
    usageStats
  }
})
